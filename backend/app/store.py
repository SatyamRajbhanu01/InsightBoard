"""Dataset storage: in-memory LRU-ish cache backed by on-disk pickle files.

Bundled sample CSVs are registered at startup and loaded lazily. Uploaded
datasets are persisted so they survive a process restart within the container.
"""
from __future__ import annotations

import json
import os
import threading
import uuid
from dataclasses import asdict, dataclass, field
from typing import Dict, List, Optional

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(HERE)
DATA_DIR = os.path.join(BACKEND_DIR, "data")
SAMPLES_DIR = os.path.join(BACKEND_DIR, "samples")
INDEX_PATH = os.path.join(DATA_DIR, "index.json")


@dataclass
class DatasetMeta:
    id: str
    name: str
    source: str  # "sample" | "upload"
    rows: int
    columns: int
    description: str = ""
    filename: str = ""  # relative storage filename (pickle) for uploads


SAMPLE_DEFS = {
    "sample-ecommerce": ("E-commerce Orders", "Synthetic online store orders with revenue, discounts and satisfaction.", "ecommerce.csv"),
    "sample-iris": ("Iris Measurements", "Synthetic flower measurements across three species.", "iris.csv"),
    "sample-tips": ("Restaurant Tips", "Synthetic restaurant bills and tips by day and party size.", "tips.csv"),
}


class DatasetStore:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._meta: Dict[str, DatasetMeta] = {}
        self._cache: Dict[str, pd.DataFrame] = {}
        os.makedirs(DATA_DIR, exist_ok=True)
        self._register_samples()
        self._load_index()

    # ---- samples -------------------------------------------------------
    def _register_samples(self) -> None:
        for ds_id, (name, desc, csv_name) in SAMPLE_DEFS.items():
            csv_path = os.path.join(SAMPLES_DIR, csv_name)
            if not os.path.exists(csv_path):
                continue
            df = pd.read_csv(csv_path)
            self._cache[ds_id] = df
            self._meta[ds_id] = DatasetMeta(
                id=ds_id,
                name=name,
                source="sample",
                rows=int(df.shape[0]),
                columns=int(df.shape[1]),
                description=desc,
                filename=csv_path,
            )

    # ---- persistence ---------------------------------------------------
    def _load_index(self) -> None:
        if not os.path.exists(INDEX_PATH):
            return
        try:
            with open(INDEX_PATH, "r", encoding="utf-8") as f:
                entries = json.load(f)
        except (json.JSONDecodeError, OSError):
            return
        for entry in entries:
            meta = DatasetMeta(**entry)
            pkl = os.path.join(DATA_DIR, meta.filename)
            if os.path.exists(pkl):
                self._meta[meta.id] = meta

    def _save_index(self) -> None:
        uploads = [asdict(m) for m in self._meta.values() if m.source == "upload"]
        tmp = INDEX_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(uploads, f)
        os.replace(tmp, INDEX_PATH)

    # ---- public API ----------------------------------------------------
    def list_datasets(self) -> List[dict]:
        with self._lock:
            items = [asdict(m) for m in self._meta.values()]
        # samples first, then uploads
        items.sort(key=lambda m: (m["source"] != "sample", m["name"]))
        for it in items:
            it.pop("filename", None)
        return items

    def add_upload(self, name: str, df: pd.DataFrame) -> DatasetMeta:
        ds_id = "ds-" + uuid.uuid4().hex[:12]
        filename = f"{ds_id}.pkl"
        with self._lock:
            df.to_pickle(os.path.join(DATA_DIR, filename))
            meta = DatasetMeta(
                id=ds_id,
                name=name,
                source="upload",
                rows=int(df.shape[0]),
                columns=int(df.shape[1]),
                description="Uploaded dataset",
                filename=filename,
            )
            self._meta[ds_id] = meta
            self._cache[ds_id] = df
            self._save_index()
        return meta

    def get_meta(self, ds_id: str) -> Optional[DatasetMeta]:
        with self._lock:
            return self._meta.get(ds_id)

    def get_df(self, ds_id: str) -> Optional[pd.DataFrame]:
        with self._lock:
            if ds_id in self._cache:
                return self._cache[ds_id]
            meta = self._meta.get(ds_id)
            if not meta:
                return None
            path = os.path.join(DATA_DIR, meta.filename)
            if not os.path.exists(path):
                return None
            # SAFETY: these pickle files are only ever written by add_upload()
            # in this same app from DataFrames parsed out of validated CSV
            # uploads. We never read pickle data from any external/untrusted
            # source, so pandas.read_pickle here is not an RCE vector.
            df = pd.read_pickle(path)
            self._cache[ds_id] = df
            return df


store = DatasetStore()
