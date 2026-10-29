# 📊 InsightBoard

**Turn any CSV into an interactive analytics dashboard.**

InsightBoard is a web application that transforms CSV datasets into meaningful insights through automatic data profiling, interactive visualizations, and data exploration.

## ✨ Features

- 📂 Upload CSV files or explore sample datasets.
- 📊 Automatically analyze columns, missing values, and statistics.
- 📈 Visualize data using histograms, bar charts, scatter plots, and correlation heatmaps.
- 🔍 Sort, filter, and paginate through dataset records.
- 📄 Generate downloadable Markdown reports.
- 🐳 Run the application using Docker.

## 🖥️ Tech Stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS, Recharts  
**Backend:** Python, FastAPI, Uvicorn  
**Data Processing:** Pandas, NumPy  
**Testing:** pytest  
**Containerization:** Docker

## 🚀 Getting Started

### Prerequisites
- Python 3.12
- Node.js and npm

### 1. Clone the repository

```bash
git clone https://github.com/SatyamRajbhanu01/InsightBoard.git
cd InsightBoard
```

### 2. Start the backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python generate_samples.py
python -m uvicorn app.main:app --reload --port 7860
```

### 3. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.