# syntax=docker/dockerfile:1

# ---------- Stage 1: build the React/TS frontend ----------
FROM node:20-alpine AS frontend
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: python runtime serving API + SPA ----------
FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=7860

WORKDIR /app

# Install backend deps first for better layer caching.
# --timeout/--retries make the build resilient to slow PyPI mirrors (e.g. on CI/HF build hosts).
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --timeout 120 --retries 10 -r requirements.txt

# Backend source + bundled sample datasets.
COPY backend/ ./

# Copy the compiled frontend into the location the backend serves ("static").
COPY --from=frontend /web/dist ./static

# Regenerate samples in case they weren't committed (idempotent).
RUN python generate_samples.py || true

EXPOSE 7860

# Bind to the platform-provided port (HF Spaces = 7860, Render injects PORT).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
