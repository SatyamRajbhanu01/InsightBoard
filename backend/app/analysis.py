"""Pure data-analysis helpers built on pandas/numpy.

These functions are intentionally framework-free so they can be unit tested in
isolation from FastAPI.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd


def _clean_float(value: Any) -> Optional[float]:
    """Convert numpy/pandas numeric to a JSON-safe float (NaN/inf -> None)."""
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def is_numeric(series: pd.Series) -> bool:
    return pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series)


def dataframe_overview(df: pd.DataFrame) -> Dict[str, Any]:
    """High-level shape/quality metrics for the overview cards."""
    total_cells = int(df.shape[0] * df.shape[1]) or 1
    missing_cells = int(df.isna().sum().sum())
    numeric_cols = [c for c in df.columns if is_numeric(df[c])]
    return {
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "numeric_columns": len(numeric_cols),
        "categorical_columns": int(df.shape[1] - len(numeric_cols)),
        "missing_cells": missing_cells,
        "missing_pct": round(missing_cells / total_cells * 100, 2),
        "duplicate_rows": int(df.duplicated().sum()),
        "memory_bytes": int(df.memory_usage(deep=True).sum()),
    }


def column_profile(series: pd.Series, top_n: int = 10) -> Dict[str, Any]:
    """Per-column statistics. Numeric columns get descriptive stats; others get
    top value counts."""
    n = int(len(series))
    missing = int(series.isna().sum())
    profile: Dict[str, Any] = {
        "name": str(series.name),
        "dtype": str(series.dtype),
        "count": n,
        "missing": missing,
        "missing_pct": round(missing / n * 100, 2) if n else 0.0,
        "unique": int(series.nunique(dropna=True)),
        "is_numeric": is_numeric(series),
    }

    if is_numeric(series):
        clean = series.dropna()
        desc = {
            "mean": _clean_float(clean.mean()) if len(clean) else None,
            "median": _clean_float(clean.median()) if len(clean) else None,
            "std": _clean_float(clean.std()) if len(clean) else None,
            "min": _clean_float(clean.min()) if len(clean) else None,
            "max": _clean_float(clean.max()) if len(clean) else None,
            "q1": _clean_float(clean.quantile(0.25)) if len(clean) else None,
            "q3": _clean_float(clean.quantile(0.75)) if len(clean) else None,
        }
        profile["stats"] = desc
    else:
        counts = series.value_counts(dropna=True).head(top_n)
        profile["top_values"] = [
            {"value": str(idx), "count": int(cnt)} for idx, cnt in counts.items()
        ]

    return profile


def full_profile(df: pd.DataFrame, top_n: int = 10) -> Dict[str, Any]:
    return {
        "overview": dataframe_overview(df),
        "columns": [column_profile(df[c], top_n=top_n) for c in df.columns],
        "correlation": correlation_matrix(df),
    }


def correlation_matrix(df: pd.DataFrame) -> Dict[str, Any]:
    """Pearson correlation across numeric columns, JSON-safe."""
    numeric_cols = [c for c in df.columns if is_numeric(df[c])]
    if len(numeric_cols) < 2:
        return {"columns": numeric_cols, "matrix": []}
    corr = df[numeric_cols].corr(numeric_only=True)
    matrix = [
        [_clean_float(corr.iloc[i, j]) for j in range(len(numeric_cols))]
        for i in range(len(numeric_cols))
    ]
    return {"columns": [str(c) for c in numeric_cols], "matrix": matrix}


def histogram(series: pd.Series, bins: int = 20) -> Dict[str, Any]:
    if not is_numeric(series):
        raise ValueError(f"Column '{series.name}' is not numeric")
    clean = series.dropna().to_numpy()
    if clean.size == 0:
        return {"bins": [], "column": str(series.name)}
    counts, edges = np.histogram(clean, bins=min(bins, max(1, len(np.unique(clean)))))
    out = []
    for i in range(len(counts)):
        lo, hi = float(edges[i]), float(edges[i + 1])
        out.append(
            {
                "bin": f"{lo:.2f}–{hi:.2f}",
                "start": round(lo, 4),
                "end": round(hi, 4),
                "count": int(counts[i]),
            }
        )
    return {"column": str(series.name), "bins": out}


def bar_counts(series: pd.Series, top_n: int = 12) -> Dict[str, Any]:
    counts = series.value_counts(dropna=True).head(top_n)
    return {
        "column": str(series.name),
        "data": [{"label": str(idx), "count": int(cnt)} for idx, cnt in counts.items()],
    }


def scatter_points(df: pd.DataFrame, x: str, y: str, limit: int = 2000) -> Dict[str, Any]:
    for col in (x, y):
        if col not in df.columns:
            raise ValueError(f"Column '{col}' not found")
        if not is_numeric(df[col]):
            raise ValueError(f"Column '{col}' is not numeric")
    sub = df[[x, y]].dropna()
    if len(sub) > limit:
        sub = sub.sample(limit, random_state=0)
    points = [
        {"x": _clean_float(rx), "y": _clean_float(ry)}
        for rx, ry in zip(sub[x].to_numpy(), sub[y].to_numpy())
    ]
    return {"x": x, "y": y, "points": points}


def paginate_rows(
    df: pd.DataFrame,
    page: int = 1,
    page_size: int = 25,
    sort_by: Optional[str] = None,
    sort_dir: str = "asc",
    filter_col: Optional[str] = None,
    filter_value: Optional[str] = None,
) -> Dict[str, Any]:
    """Return a page of rows with optional filtering and sorting."""
    view = df
    if filter_col and filter_col in df.columns and filter_value:
        mask = view[filter_col].astype(str).str.contains(
            str(filter_value), case=False, na=False
        )
        view = view[mask]

    if sort_by and sort_by in view.columns:
        view = view.sort_values(by=sort_by, ascending=(sort_dir != "desc"), kind="mergesort")

    total = int(len(view))
    page = max(1, int(page))
    page_size = max(1, min(int(page_size), 200))
    start = (page - 1) * page_size
    end = start + page_size
    page_df = view.iloc[start:end]

    # Build JSON-safe records (NaN -> None).
    records: List[Dict[str, Any]] = []
    for _, row in page_df.iterrows():
        rec: Dict[str, Any] = {}
        for col in df.columns:
            val = row[col]
            if pd.isna(val):
                rec[col] = None
            elif isinstance(val, (np.integer,)):
                rec[col] = int(val)
            elif isinstance(val, (np.floating,)):
                rec[col] = _clean_float(val)
            else:
                rec[col] = val if isinstance(val, (int, float, bool)) else str(val)
        records.append(rec)

    return {
        "columns": [str(c) for c in df.columns],
        "rows": records,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }


def build_report(name: str, df: pd.DataFrame) -> Dict[str, Any]:
    """Assemble a structured report plus a markdown rendering."""
    prof = full_profile(df)
    ov = prof["overview"]
    lines = [
        f"# Data Report — {name}",
        "",
        "## Overview",
        f"- Rows: {ov['rows']:,}",
        f"- Columns: {ov['columns']}",
        f"- Numeric columns: {ov['numeric_columns']}",
        f"- Categorical columns: {ov['categorical_columns']}",
        f"- Missing cells: {ov['missing_cells']:,} ({ov['missing_pct']}%)",
        f"- Duplicate rows: {ov['duplicate_rows']:,}",
        f"- Memory: {ov['memory_bytes'] / 1024:.1f} KB",
        "",
        "## Columns",
        "",
        "| Column | Type | Missing % | Unique | Summary |",
        "| --- | --- | ---: | ---: | --- |",
    ]
    for col in prof["columns"]:
        if col["is_numeric"] and col.get("stats"):
            s = col["stats"]
            mean = f"{s['mean']:.2f}" if s["mean"] is not None else "-"
            summary = f"mean {mean}, min {s['min']}, max {s['max']}"
        else:
            tops = col.get("top_values", [])[:3]
            summary = ", ".join(f"{t['value']} ({t['count']})" for t in tops) or "-"
        lines.append(
            f"| {col['name']} | {col['dtype']} | {col['missing_pct']} | {col['unique']} | {summary} |"
        )

    corr = prof["correlation"]
    if corr["columns"] and corr["matrix"]:
        lines += ["", "## Strongest correlations"]
        pairs = []
        cols = corr["columns"]
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                v = corr["matrix"][i][j]
                if v is not None:
                    pairs.append((abs(v), cols[i], cols[j], v))
        pairs.sort(reverse=True)
        for _, a, b, v in pairs[:5]:
            lines.append(f"- {a} ↔ {b}: {v:.2f}")

    return {"name": name, "profile": prof, "markdown": "\n".join(lines)}
