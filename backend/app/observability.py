"""Cross-cutting concerns: request/correlation ids, structured logging and
security-header middleware.

Everything here is deploy-safe: it adds headers/logging around the existing
request pipeline without altering routes, ports or response bodies.
"""
from __future__ import annotations

import logging
import time
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

# Correlation id for the in-flight request; surfaced in logs and responses.
_request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

REQUEST_ID_HEADER = "X-Request-ID"
_INBOUND_ID_HEADERS = ("X-Request-ID", "X-Correlation-ID")


def current_request_id() -> str:
    """Return the correlation id bound to the active request (or '-')."""
    return _request_id_ctx.get()


class _RequestIdFilter(logging.Filter):
    """Inject the active correlation id into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003
        record.request_id = current_request_id()
        return True


def configure_logging(level: str = "INFO") -> None:
    """Configure root logging once, with a request-id-aware line format."""
    handler = logging.StreamHandler()
    handler.addFilter(_RequestIdFilter())
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)s [%(name)s] [request_id=%(request_id)s] %(message)s"
        )
    )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())
    # Keep uvicorn access logs flowing through the same handler/format.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers = [handler]
        lg.propagate = False


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Assign/propagate a correlation id and log a one-line request summary."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._log = logging.getLogger("insightboard.request")

    async def dispatch(self, request: Request, call_next):
        rid = ""
        for header in _INBOUND_ID_HEADERS:
            rid = request.headers.get(header, "")
            if rid:
                break
        rid = (rid or uuid.uuid4().hex[:16])[:64]
        token = _request_id_ctx.set(rid)
        start = time.perf_counter()
        try:
            response: Response = await call_next(request)
        except Exception:
            elapsed = (time.perf_counter() - start) * 1000
            # Log while the correlation id is still bound to the context.
            self._log.exception(
                "%s %s -> 500 (%.1fms)", request.method, request.url.path, elapsed
            )
            raise
        else:
            elapsed = (time.perf_counter() - start) * 1000
            response.headers[REQUEST_ID_HEADER] = rid
            self._log.info(
                "%s %s -> %s (%.1fms)",
                request.method,
                request.url.path,
                response.status_code,
                elapsed,
            )
            return response
        finally:
            _request_id_ctx.reset(token)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach a conservative set of security headers to every response.

    Kept SPA-friendly: no strict CSP that would block the bundled React app,
    and HSTS is only meaningful over HTTPS (Render terminates TLS upstream).
    """

    def __init__(self, app: ASGIApp, hsts: bool = True) -> None:
        super().__init__(app)
        self._hsts = hsts

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        headers = response.headers
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        headers.setdefault("X-XSS-Protection", "0")
        headers.setdefault(
            "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
        )
        if self._hsts:
            headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response
