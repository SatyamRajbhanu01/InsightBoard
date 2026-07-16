"""InsightBoard API — a CSV data-analysis dashboard backend.

Serves a REST API under ``/api`` and the compiled React SPA at ``/``. Designed
to run as a single container listening on ``${PORT:-7860}``.

All API routes live on a single ``APIRouter`` (prefix ``/api``) included on the
main application, so ``/docs`` and ``/redoc`` present the complete, unified API
surface. Errors are returned as RFC 7807 Problem Details.
"""
from __future__ import annotations

import io
import os
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from . import analysis
from .errors import register_exception_handlers
from .observability import (
    CorrelationIdMiddleware,
    SecurityHeadersMiddleware,
    configure_logging,
)
from .schemas import (
    BarData,
    DatasetListResponse,
    HealthResponse,
    HistogramData,
    ProblemDetail,
    ProfileResponse,
    ReadinessResponse,
    RowsResponse,
    ScatterData,
    UploadResponse,
)
from .store import store

# --------------------------------------------------------------------------- #
# Configuration (env-driven, with dev-safe defaults)
# --------------------------------------------------------------------------- #
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", 10 * 1024 * 1024))  # 10 MB
MAX_ROWS = int(os.environ.get("MAX_ROWS", 200_000))
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")

# CORS: default permissive for the same-origin SPA / local dev; override in
# production via CORS_ALLOW_ORIGINS="https://a.com,https://b.com".
_cors_env = os.environ.get("CORS_ALLOW_ORIGINS", "*").strip()
CORS_ORIGINS = ["*"] if _cors_env in ("", "*") else [o.strip() for o in _cors_env.split(",") if o.strip()]
CORS_ALLOW_CREDENTIALS = os.environ.get("CORS_ALLOW_CREDENTIALS", "false").lower() == "true" and CORS_ORIGINS != ["*"]
ENABLE_HSTS = os.environ.get("ENABLE_HSTS", "true").lower() == "true"

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(HERE)
# The Dockerfile copies the built SPA here; in dev it may be absent.
STATIC_DIR = os.environ.get("STATIC_DIR", os.path.join(BACKEND_DIR, "static"))

configure_logging(LOG_LEVEL)

# --------------------------------------------------------------------------- #
# OpenAPI metadata
# --------------------------------------------------------------------------- #
TAGS_METADATA = [
    {"name": "Health", "description": "Liveness and readiness probes for load balancers and orchestrators."},
    {"name": "Datasets", "description": "Discover bundled sample datasets and upload your own CSV files."},
    {"name": "Analysis", "description": "Profile datasets, browse rows with pagination/sorting/filtering, and build charts and reports."},
]

DESCRIPTION = """
**InsightBoard** is a CSV data-analysis dashboard. Upload a CSV (or use a
bundled sample) and the API returns dataset profiles, per-column statistics,
correlation matrices, chart-ready aggregations, paginated row views and a
downloadable Markdown report.

### Conventions
* All endpoints are served under the `/api` prefix.
* List/row endpoints support **pagination, sorting and filtering** via query
  parameters.
* Errors follow **RFC 7807 Problem Details** (`application/problem+json`) with a
  `type`, `title`, `status`, `detail`, `instance`, `request_id` and — for
  validation failures — a per-field `errors` array.
* Every response carries an `X-Request-ID` correlation header (echo an inbound
  `X-Request-ID`/`X-Correlation-ID` to trace a call end-to-end).
""".strip()

_PROBLEM_RESPONSES = {
    400: {"model": ProblemDetail, "description": "Bad request (invalid file, unparseable CSV)."},
    404: {"model": ProblemDetail, "description": "Dataset not found."},
    413: {"model": ProblemDetail, "description": "Upload exceeds size/row limits."},
    422: {"model": ProblemDetail, "description": "Request validation failed (per-field errors)."},
    500: {"model": ProblemDetail, "description": "Unexpected internal error."},
}

app = FastAPI(
    title="InsightBoard API",
    version="1.1.0",
    description=DESCRIPTION,
    openapi_tags=TAGS_METADATA,
    contact={"name": "InsightBoard Maintainers", "url": "https://github.com/insightboard"},
    license_info={"name": "MIT", "url": "https://opensource.org/licenses/MIT"},
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Middleware order: security headers + correlation id wrap CORS.
app.add_middleware(SecurityHeadersMiddleware, hsts=ENABLE_HSTS)
app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

register_exception_handlers(app)

# --------------------------------------------------------------------------- #
# API router (unified under /api)
# --------------------------------------------------------------------------- #
api = APIRouter(prefix="/api", responses={422: _PROBLEM_RESPONSES[422]})


def _require_df(ds_id: str) -> pd.DataFrame:
    df = store.get_df(ds_id)
    if df is None:
        raise HTTPException(status_code=404, detail=f"Dataset '{ds_id}' not found")
    return df


@api.get(
    "/health",
    tags=["Health"],
    summary="Liveness probe",
    description="Returns `ok` while the process is serving traffic. Used as the container health check.",
    response_model=HealthResponse,
)
def health() -> dict:
    return {"status": "ok", "service": "insightboard"}


@api.get(
    "/ready",
    tags=["Health"],
    summary="Readiness probe",
    description="Reports `ready` once the dataset store can be queried, along with the number of registered datasets.",
    response_model=ReadinessResponse,
)
def ready() -> dict:
    try:
        count = len(store.list_datasets())
        return {"status": "ready", "service": "insightboard", "datasets": count}
    except Exception:  # pragma: no cover - defensive
        raise HTTPException(status_code=503, detail="Dataset store is not ready")


@api.get(
    "/datasets",
    tags=["Datasets"],
    summary="List datasets",
    description=(
        "Lists all registered datasets (samples first, then uploads). "
        "Optionally filter by `source` and sort by any metadata field."
    ),
    response_model=DatasetListResponse,
)
def list_datasets(
    source: Optional[str] = Query(
        None,
        pattern="^(sample|upload)$",
        description="Filter by dataset source.",
        examples=["sample"],
    ),
    sort_by: Optional[str] = Query(
        None,
        pattern="^(name|rows|columns|source|id)$",
        description="Metadata field to sort by. Omit to keep the default order (samples first, then uploads by name).",
    ),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$", description="Sort direction (applies only when sort_by is set)."),
) -> dict:
    # Default order (samples-first) is preserved when no sort_by is supplied.
    items: List[dict] = store.list_datasets()
    if source:
        items = [it for it in items if it.get("source") == source]
    if sort_by:
        reverse = sort_dir == "desc"
        items = sorted(items, key=lambda it: (it.get(sort_by) is None, it.get(sort_by)), reverse=reverse)
    return {"datasets": items}


@api.post(
    "/upload",
    tags=["Datasets"],
    summary="Upload a CSV dataset",
    description=(
        "Uploads a CSV file (multipart `file` field). The file is parsed with "
        f"pandas and stored. Limits: max {MAX_UPLOAD_BYTES} bytes and {MAX_ROWS} rows."
    ),
    response_model=UploadResponse,
    responses={k: _PROBLEM_RESPONSES[k] for k in (400, 413, 422)},
)
async def upload(file: UploadFile = File(..., description="A UTF-8 encoded .csv file with a header row.")) -> dict:
    name = file.filename or "uploaded.csv"
    if not name.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(raw)} bytes). Max is {MAX_UPLOAD_BYTES} bytes.",
        )

    try:
        df = pd.read_csv(io.BytesIO(raw))
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}") from exc

    if df.shape[0] == 0 or df.shape[1] == 0:
        raise HTTPException(status_code=400, detail="CSV contains no data rows or columns")
    if df.shape[0] > MAX_ROWS:
        raise HTTPException(
            status_code=413,
            detail=f"Too many rows ({df.shape[0]}). Max is {MAX_ROWS}.",
        )

    display_name = os.path.splitext(os.path.basename(name))[0][:80] or "Uploaded dataset"
    meta = store.add_upload(display_name, df)
    return {
        "id": meta.id,
        "name": meta.name,
        "source": meta.source,
        "rows": meta.rows,
        "columns": meta.columns,
    }


@api.get(
    "/datasets/{ds_id}/profile",
    tags=["Analysis"],
    summary="Profile a dataset",
    description="Returns overview metrics, per-column statistics and a numeric correlation matrix.",
    response_model=ProfileResponse,
    responses={404: _PROBLEM_RESPONSES[404]},
)
def profile(ds_id: str) -> dict:
    df = _require_df(ds_id)
    meta = store.get_meta(ds_id)
    prof = analysis.full_profile(df)
    prof["dataset"] = {"id": ds_id, "name": meta.name if meta else ds_id}
    return prof


@api.get(
    "/datasets/{ds_id}/rows",
    tags=["Analysis"],
    summary="Browse rows (paginated, sortable, filterable)",
    description=(
        "Returns a page of rows. Supports `page`/`page_size` pagination, "
        "`sort_by`/`sort_dir` sorting, and a case-insensitive substring "
        "`filter_col`/`filter_value` filter."
    ),
    response_model=RowsResponse,
    responses={404: _PROBLEM_RESPONSES[404], 422: _PROBLEM_RESPONSES[422]},
)
def rows(
    ds_id: str,
    page: int = Query(1, ge=1, description="1-based page number.", examples=[1]),
    page_size: int = Query(25, ge=1, le=200, description="Rows per page (1–200).", examples=[25]),
    sort_by: Optional[str] = Query(None, description="Column name to sort by.", examples=["total_bill"]),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$", description="Sort direction."),
    filter_col: Optional[str] = Query(None, description="Column to filter on.", examples=["day"]),
    filter_value: Optional[str] = Query(None, description="Case-insensitive substring to match.", examples=["Sun"]),
) -> dict:
    df = _require_df(ds_id)
    return analysis.paginate_rows(
        df,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_dir=sort_dir,
        filter_col=filter_col,
        filter_value=filter_value,
    )


@api.get(
    "/datasets/{ds_id}/chart",
    tags=["Analysis"],
    summary="Build chart-ready aggregations",
    description=(
        "Returns data shaped for a chart. The response body depends on `kind`:\n\n"
        "* `histogram` — requires numeric `column`; returns `{column, bins[]}`.\n"
        "* `bar` — requires `column`; returns `{column, data[]}` of top value counts.\n"
        "* `scatter` — requires numeric `x` and `y`; returns `{x, y, points[]}`.\n"
        "* `correlation` — returns `{columns[], matrix[][]}` across numeric columns."
    ),
    responses={
        200: {
            "description": "Chart payload (shape depends on `kind`).",
            "content": {
                "application/json": {
                    "examples": {
                        "histogram": {"value": {"column": "petal_length", "bins": [{"bin": "1.00–2.00", "start": 1.0, "end": 2.0, "count": 50}]}},
                        "bar": {"value": {"column": "species", "data": [{"label": "setosa", "count": 50}]}},
                        "scatter": {"value": {"x": "sepal_length", "y": "petal_length", "points": [{"x": 5.1, "y": 1.4}]}},
                        "correlation": {"value": {"columns": ["sepal_length", "petal_length"], "matrix": [[1.0, 0.87], [0.87, 1.0]]}},
                    }
                }
            },
        },
        400: _PROBLEM_RESPONSES[400],
        404: _PROBLEM_RESPONSES[404],
        422: _PROBLEM_RESPONSES[422],
    },
)
def chart(
    ds_id: str,
    kind: str = Query(..., pattern="^(histogram|bar|scatter|correlation)$", description="Chart type.", examples=["histogram"]),
    column: Optional[str] = Query(None, description="Column for histogram/bar.", examples=["petal_length"]),
    x: Optional[str] = Query(None, description="X column for scatter.", examples=["sepal_length"]),
    y: Optional[str] = Query(None, description="Y column for scatter.", examples=["petal_length"]),
    bins: int = Query(20, ge=2, le=100, description="Histogram bin count (2–100)."),
    top_n: int = Query(12, ge=1, le=50, description="Top-N categories for bar charts (1–50)."),
):
    df = _require_df(ds_id)
    try:
        if kind == "histogram":
            if not column or column not in df.columns:
                raise HTTPException(status_code=400, detail="A valid numeric 'column' is required")
            return analysis.histogram(df[column], bins=bins)
        if kind == "bar":
            if not column or column not in df.columns:
                raise HTTPException(status_code=400, detail="A valid 'column' is required")
            return analysis.bar_counts(df[column], top_n=top_n)
        if kind == "scatter":
            if not x or not y:
                raise HTTPException(status_code=400, detail="'x' and 'y' columns are required")
            return analysis.scatter_points(df, x, y)
        # correlation
        return analysis.correlation_matrix(df)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@api.get(
    "/datasets/{ds_id}/report",
    tags=["Analysis"],
    summary="Download a data report",
    description="Returns a full data report as downloadable Markdown (`fmt=markdown`, default) or the profile JSON (`fmt=json`).",
    responses={
        200: {
            "description": "Markdown report (attachment) or profile JSON.",
            "content": {
                "text/markdown": {"example": "# Data Report — Iris Measurements\n\n## Overview\n- Rows: 150\n"},
                "application/json": {"example": {"overview": {"rows": 150, "columns": 5}}},
            },
        },
        404: _PROBLEM_RESPONSES[404],
        422: _PROBLEM_RESPONSES[422],
    },
)
def report(
    ds_id: str,
    fmt: str = Query("markdown", pattern="^(markdown|json)$", description="Output format."),
):
    df = _require_df(ds_id)
    meta = store.get_meta(ds_id)
    name = meta.name if meta else ds_id
    rep = analysis.build_report(name, df)
    if fmt == "json":
        return JSONResponse(rep["profile"])
    return PlainTextResponse(
        rep["markdown"],
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{ds_id}-report.md"'},
    )


app.include_router(api)


# --------------------------------------------------------------------------- #
# SPA serving
# --------------------------------------------------------------------------- #
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        # Never let the catch-all swallow API/docs routes (they are registered
        # earlier and match first, but guard defensively regardless).
        if full_path.startswith(("api", "docs", "redoc", "openapi.json")):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        index = os.path.join(STATIC_DIR, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Frontend not built")
else:
    @app.get("/", include_in_schema=False)
    def root_dev() -> dict:
        return {
            "service": "insightboard",
            "message": "Frontend not built. Run the Vite dev server, or build and set STATIC_DIR.",
            "api_health": "/api/health",
            "docs": "/docs",
        }
