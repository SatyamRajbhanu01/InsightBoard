"""Pydantic models for request/response bodies and OpenAPI documentation.

These models power the schema definitions, examples and validation shown in
``/docs`` and ``/redoc``. They mirror the exact JSON shapes the backend has
always returned, so the existing frontend contract is preserved. Response
models allow extra fields (``extra="allow"``) as a safety net so serialisation
can never drop data the frontend already relies on.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class _Model(BaseModel):
    """Base for response models: tolerate (and preserve) extra fields."""

    model_config = ConfigDict(extra="allow")


# --------------------------------------------------------------------------- #
# Health / readiness
# --------------------------------------------------------------------------- #
class HealthResponse(_Model):
    status: str = Field("ok", description="Liveness marker; always 'ok' when the process serves traffic.")
    service: str = Field("insightboard", description="Service identifier.")

    model_config = ConfigDict(
        extra="allow",
        json_schema_extra={"example": {"status": "ok", "service": "insightboard"}},
    )


class ReadinessResponse(_Model):
    status: Literal["ready", "degraded"] = Field(..., description="'ready' once datasets can be listed.")
    service: str = Field("insightboard", description="Service identifier.")
    datasets: int = Field(..., description="Number of datasets currently registered (samples + uploads).")

    model_config = ConfigDict(
        extra="allow",
        json_schema_extra={"example": {"status": "ready", "service": "insightboard", "datasets": 3}},
    )


# --------------------------------------------------------------------------- #
# Datasets
# --------------------------------------------------------------------------- #
class DatasetMeta(_Model):
    id: str = Field(..., description="Stable dataset identifier used in all dataset-scoped routes.")
    name: str = Field(..., description="Human-friendly dataset name.")
    source: Literal["sample", "upload"] = Field(..., description="Whether the dataset ships with the app or was uploaded.")
    rows: int = Field(..., description="Row count.")
    columns: int = Field(..., description="Column count.")
    description: str = Field("", description="Optional description.")

    model_config = ConfigDict(
        extra="allow",
        json_schema_extra={
            "example": {
                "id": "sample-iris",
                "name": "Iris Measurements",
                "source": "sample",
                "rows": 150,
                "columns": 5,
                "description": "Synthetic flower measurements across three species.",
            }
        },
    )


class DatasetListResponse(_Model):
    datasets: List[DatasetMeta] = Field(..., description="Datasets, samples first then uploads.")


class UploadResponse(_Model):
    id: str
    name: str
    source: Literal["sample", "upload"]
    rows: int
    columns: int

    model_config = ConfigDict(
        extra="allow",
        json_schema_extra={
            "example": {
                "id": "ds-1a5cfbdcde04",
                "name": "quarterly_sales",
                "source": "upload",
                "rows": 1200,
                "columns": 8,
            }
        },
    )


# --------------------------------------------------------------------------- #
# Profiling
# --------------------------------------------------------------------------- #
class Overview(_Model):
    rows: int
    columns: int
    numeric_columns: int
    categorical_columns: int
    missing_cells: int
    missing_pct: float
    duplicate_rows: int
    memory_bytes: int


class NumericStats(_Model):
    mean: Optional[float] = None
    median: Optional[float] = None
    std: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    q1: Optional[float] = None
    q3: Optional[float] = None


class TopValue(_Model):
    value: str
    count: int


class ColumnProfile(_Model):
    name: str
    dtype: str
    count: int
    missing: int
    missing_pct: float
    unique: int
    is_numeric: bool
    stats: Optional[NumericStats] = Field(None, description="Present for numeric columns only.")
    top_values: Optional[List[TopValue]] = Field(None, description="Present for categorical columns only.")


class Correlation(_Model):
    columns: List[str] = Field(..., description="Numeric column names in matrix order.")
    matrix: List[List[Optional[float]]] = Field(..., description="Square Pearson correlation matrix; nulls where undefined.")


class DatasetRef(_Model):
    id: str
    name: str


class ProfileResponse(_Model):
    overview: Overview
    columns: List[ColumnProfile]
    correlation: Correlation
    dataset: DatasetRef


# --------------------------------------------------------------------------- #
# Rows (paginated / sorted / filtered)
# --------------------------------------------------------------------------- #
class RowsResponse(_Model):
    columns: List[str]
    rows: List[Dict[str, Any]]
    total: int = Field(..., description="Total rows after filtering, before pagination.")
    page: int
    page_size: int
    total_pages: int

    model_config = ConfigDict(
        extra="allow",
        json_schema_extra={
            "example": {
                "columns": ["day", "total_bill", "tip"],
                "rows": [{"day": "Sun", "total_bill": 16.99, "tip": 1.01}],
                "total": 244,
                "page": 1,
                "page_size": 25,
                "total_pages": 10,
            }
        },
    )


# --------------------------------------------------------------------------- #
# Charts
# --------------------------------------------------------------------------- #
class HistogramBin(_Model):
    bin: str
    start: float
    end: float
    count: int


class HistogramData(_Model):
    column: str
    bins: List[HistogramBin]


class BarDatum(_Model):
    label: str
    count: int


class BarData(_Model):
    column: str
    data: List[BarDatum]


class ScatterPoint(_Model):
    x: Optional[float] = None
    y: Optional[float] = None


class ScatterData(_Model):
    x: str
    y: str
    points: List[ScatterPoint]


# --------------------------------------------------------------------------- #
# Problem Details (RFC 7807)
# --------------------------------------------------------------------------- #
class FieldError(BaseModel):
    field: str = Field(..., description="Dotted path to the offending field/parameter.")
    message: str = Field(..., description="Human-readable validation message.")


class ProblemDetail(BaseModel):
    """RFC 7807 problem document returned for every error response.

    ``error`` duplicates ``detail`` for backward compatibility with existing
    clients that read a flat ``error`` string.
    """

    type: str = Field("about:blank", description="A URI reference identifying the problem type.")
    title: str = Field(..., description="Short, human-readable summary of the problem type.")
    status: int = Field(..., description="HTTP status code.")
    detail: Optional[str] = Field(None, description="Human-readable explanation specific to this occurrence.")
    instance: Optional[str] = Field(None, description="URI reference (request path) that generated the problem.")
    request_id: Optional[str] = Field(None, description="Correlation id echoed for support/debugging.")
    errors: Optional[List[FieldError]] = Field(None, description="Per-field validation errors, when applicable.")
    error: Optional[str] = Field(None, description="Backward-compatible flat error message (mirrors 'detail').")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "type": "about:blank",
                "title": "Not Found",
                "status": 404,
                "detail": "Dataset 'does-not-exist' not found",
                "instance": "/api/datasets/does-not-exist/profile",
                "request_id": "5f3e0c2a9b7d4e10",
                "errors": None,
                "error": "Dataset 'does-not-exist' not found",
            }
        }
    )
