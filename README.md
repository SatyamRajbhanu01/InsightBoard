# 📊 InsightBoard

**Turn any CSV into an instant, interactive analytics dashboard.** Drop a
spreadsheet (or load a bundled sample) and InsightBoard profiles every column,
surfaces missing data, plots distributions and correlations, and lets you sort,
filter and page through the raw rows — all served from a single container.

> **Live demo:** _(deploying)_

---

## ✨ Features

- **Drag-and-drop CSV upload** with client-side validation and clean JSON errors
  (CSV only, size- and row-capped).
- **Three bundled sample datasets** (synthetic e-commerce orders, iris
  measurements, restaurant tips) so the demo is never empty — explore in one click.
- **Automatic profiling**: per-column dtype, missing count/%, unique count,
  numeric descriptive stats (mean, median, std, min/max, quartiles) and
  categorical top-value counts.
- **Overview cards**: rows, columns, missing %, duplicates and in-memory size.
- **Interactive charts** (Recharts): histogram with a column picker, categorical
  top-N bar chart, scatter plot with X/Y axis selectors, and a numeric
  correlation heatmap.
- **Data table**: server-side pagination, column sorting and text filtering.
- **Downloadable report** (Markdown) summarizing the dataset.
- Polished, responsive, dark UI with loading / empty / error states throughout.

## 🖼️ Screenshots

_Add screenshots here._

| Landing | Dashboard | Charts |
| --- | --- | --- |
| _(screenshot placeholder)_ | _(screenshot placeholder)_ | _(screenshot placeholder)_ |

## 🧱 Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · Recharts |
| Backend | FastAPI · Uvicorn · pandas · NumPy |
| Packaging | Multi-stage Docker (Node build → Python runtime) |
| Tests | pytest (analysis functions + API) |

## 🏗️ Architecture

```
┌──────────────────────────── single container ────────────────────────────┐
│  FastAPI (uvicorn) on ${PORT:-7860}                                       │
│                                                                           │
│   /api/*  ──►  REST API           /  ──►  StaticFiles (compiled React SPA)│
│   ├─ GET  /api/health                     + catch-all → index.html        │
│   ├─ POST /api/upload  (multipart CSV → pandas → parquet/pickle on disk)  │
│   ├─ GET  /api/datasets                                                   │
│   ├─ GET  /api/datasets/{id}/profile  (stats + correlation)               │
│   ├─ GET  /api/datasets/{id}/rows     (paginated / sorted / filtered)     │
│   ├─ GET  /api/datasets/{id}/chart    (histogram|bar|scatter|correlation) │
│   └─ GET  /api/datasets/{id}/report   (markdown / json)                   │
│                                                                           │
│   DatasetStore: in-memory cache + on-disk persistence under ./data        │
│   Bundled sample CSVs under ./samples (registered at startup)             │
└───────────────────────────────────────────────────────────────────────────┘
```

The backend serves the compiled frontend as static files, so the whole app is
**one deployable image**. API routes live under `/api/*`; every other non-file
route returns the SPA's `index.html` for client-side routing.

## 🚀 Run locally

### Option A — Docker (single container, production-like)

```bash
docker build -t insightboard .
docker run --rm -p 7860:7860 insightboard
# open http://localhost:7860
```

### Option B — Dev mode (hot reload)

Backend (FastAPI on :7860):

```bash
cd backend
# reuse an existing venv or create one:
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python generate_samples.py          # (re)create bundled sample CSVs
uvicorn app.main:app --reload --port 7860
```

Frontend (Vite dev server on :5173, proxies /api → :7860):

```bash
cd frontend
npm install
npm run dev
# open http://localhost:5173
```

### Option C — Serve the built SPA from the backend (no Docker)

```bash
cd frontend && npm install && npm run build
cp -r dist ../backend/static
cd ../backend && uvicorn app.main:app --port 7860
# open http://localhost:7860
```

## 🧪 Tests

```bash
cd backend
pip install -r requirements.txt
pytest -q
```

Covers the profiling/statistics helpers and the core API flow
(upload a small CSV → profile, chart, rows, report, error handling).

## 🕹️ Try it in one click

No login required. On the landing page, either **drag in a CSV** or click any
**sample dataset** card (E-commerce Orders, Iris Measurements, Restaurant Tips)
to jump straight into the dashboard.

## ⚙️ Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `7860` | Port the server binds to |
| `MAX_UPLOAD_BYTES` | `10485760` (10 MB) | Max upload size |
| `MAX_ROWS` | `200000` | Max rows per uploaded CSV |
| `STATIC_DIR` | `backend/static` | Location of the compiled SPA |

No secrets are required or committed. All sample data is synthetic and original.

## 📄 License

MIT © 2026 Bhargava Chandu Thalupuri
