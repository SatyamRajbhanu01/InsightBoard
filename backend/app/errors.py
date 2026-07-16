"""Global exception handling producing RFC 7807 Problem Details responses.

Every error path in the API funnels through here so clients always receive a
consistent, structured body and internal details/stack traces are never
leaked. The body also carries a flat ``error`` string for backward
compatibility with the existing frontend, which reads ``error`` first.
"""
from __future__ import annotations

import logging
from http import HTTPStatus
from typing import List

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .observability import current_request_id
from .schemas import FieldError, ProblemDetail

_log = logging.getLogger("insightboard.error")

PROBLEM_JSON = "application/problem+json"


def _title_for(status: int) -> str:
    try:
        return HTTPStatus(status).phrase
    except ValueError:
        return "Error"


def _problem_response(
    *,
    status: int,
    detail: str,
    instance: str,
    title: str | None = None,
    errors: List[FieldError] | None = None,
) -> JSONResponse:
    problem = ProblemDetail(
        title=title or _title_for(status),
        status=status,
        detail=detail,
        instance=instance,
        request_id=current_request_id(),
        errors=errors,
        error=detail,  # backward-compatible flat message
    )
    return JSONResponse(
        status_code=status,
        content=problem.model_dump(),
        media_type=PROBLEM_JSON,
        headers={"X-Request-ID": current_request_id()},
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return _problem_response(
        status=exc.status_code,
        detail=detail,
        instance=request.url.path,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors: List[FieldError] = []
    for err in exc.errors():
        loc = [str(p) for p in err.get("loc", []) if p not in ("body",)]
        field = ".".join(loc) if loc else "request"
        errors.append(FieldError(field=field, message=err.get("msg", "Invalid value")))
    detail = "Request validation failed: " + "; ".join(
        f"{e.field}: {e.message}" for e in errors
    ) if errors else "Request validation failed"
    return _problem_response(
        status=422,
        detail=detail,
        instance=request.url.path,
        title="Unprocessable Entity",
        errors=errors,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Log the full traceback server-side; never expose it to the client.
    _log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return _problem_response(
        status=500,
        detail="An unexpected internal error occurred. Please retry or contact support with the request id.",
        instance=request.url.path,
        title="Internal Server Error",
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
