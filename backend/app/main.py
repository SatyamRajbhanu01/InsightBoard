"""InsightBoard API — a CSV data-analysis dashboard backend.

Serves a REST API under /api and the compiled React SPA at /. Designed to run
as a single container listening on ${PORT:-7860}.
"""
from __future__ import annotations

import io
import os
from typing import Optional

import pandas as pd
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import analysis
from .store import store

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", 10 * 1024 * 1024))  # 10 MB
MAX_ROWS = int(os.environ.get("MAX_ROWS", 200_000))

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(HERE)
# The Dockerfile copies the built SPA here; in dev it may be absent.
STATIC_DIR = os.environ.get("STATIC_DIR", os.path.join(BACKEND_DIR, "static"))

app = FastAPI(title="InsightBoard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = FastAPI(title="InsightBoard API routes")


@api.exception_handler(StarletteHTTPException)
async def api_http_exc_handler(_request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


def _require_df(ds_id: str) -> pd.DataFrame:
    df = store.get_df(ds_id)
    if df is None:
        raise HTTPException(status_code=404, detail=f"Dataset '{ds_id}' not found")
    return df


@api.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "insightboard"}


@api.get("/datasets")
def list_datasets() -> dict:
    return {"datasets": store.list_datasets()}


@api.post("/upload")
async def upload(file: UploadFile = File(...)) -> dict:
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


@api.get("/datasets/{ds_id}/profile")
def profile(ds_id: str) -> dict:
    df = _require_df(ds_id)
    meta = store.get_meta(ds_id)
    prof = analysis.full_profile(df)
    prof["dataset"] = {"id": ds_id, "name": meta.name if meta else ds_id}
    return prof


@api.get("/datasets/{ds_id}/rows")
def rows(
    ds_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    sort_by: Optional[str] = None,
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    filter_col: Optional[str] = None,
    filter_value: Optional[str] = None,
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


@api.get("/datasets/{ds_id}/chart")
def chart(
    ds_id: str,
    kind: str = Query(..., pattern="^(histogram|bar|scatter|correlation)$"),
    column: Optional[str] = None,
    x: Optional[str] = None,
    y: Optional[str] = None,
    bins: int = Query(20, ge=2, le=100),
    top_n: int = Query(12, ge=1, le=50),
) -> dict:
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


@api.get("/datasets/{ds_id}/report")
def report(ds_id: str, fmt: str = Query("markdown", pattern="^(markdown|json)$")):
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


app.mount("/api", api)


# ---- SPA serving -------------------------------------------------------------
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        # Never let the catch-all swallow API routes.
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(candidate):
            from fastapi.responses import FileResponse

            return FileResponse(candidate)
        index = os.path.join(STATIC_DIR, "index.html")
        if os.path.isfile(index):
            from fastapi.responses import FileResponse

            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Frontend not built")
else:
    @app.get("/")
    def root_dev() -> dict:
        return {
            "service": "insightboard",
            "message": "Frontend not built. Run the Vite dev server, or build and set STATIC_DIR.",
            "api_health": "/api/health",
        }


@app.exception_handler(StarletteHTTPException)
async def http_exc_handler(_request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
