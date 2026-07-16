"""Generate bundled sample datasets for InsightBoard.

Run once to (re)create CSV files under ./samples. These are original, synthetic
datasets generated with numpy so no third-party data is redistributed.
"""
from __future__ import annotations

import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLES_DIR = os.path.join(HERE, "samples")


def make_ecommerce(n: int = 600, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    categories = ["Electronics", "Home", "Toys", "Apparel", "Books", "Sports"]
    regions = ["North", "South", "East", "West"]
    channels = ["Web", "Mobile", "Store"]
    start = pd.Timestamp("2024-01-01")
    order_date = start + pd.to_timedelta(rng.integers(0, 365, n), unit="D")
    category = rng.choice(categories, n, p=[0.24, 0.2, 0.12, 0.2, 0.13, 0.11])
    quantity = rng.integers(1, 8, n)
    unit_price = np.round(rng.gamma(4.0, 18.0, n) + 5, 2)
    discount = np.round(rng.choice([0, 0.05, 0.1, 0.15, 0.2], n, p=[0.5, 0.2, 0.15, 0.1, 0.05]), 2)
    revenue = np.round(quantity * unit_price * (1 - discount), 2)
    satisfaction = np.clip(np.round(rng.normal(4.1, 0.7, n), 1), 1.0, 5.0)
    df = pd.DataFrame(
        {
            "order_id": np.arange(100000, 100000 + n),
            "order_date": order_date.strftime("%Y-%m-%d"),
            "category": category,
            "region": rng.choice(regions, n),
            "channel": rng.choice(channels, n, p=[0.5, 0.35, 0.15]),
            "quantity": quantity,
            "unit_price": unit_price,
            "discount": discount,
            "revenue": revenue,
            "customer_age": rng.integers(18, 72, n),
            "satisfaction": satisfaction,
        }
    )
    # Inject a few missing values to make profiling interesting.
    miss_idx = rng.choice(n, size=int(n * 0.04), replace=False)
    df.loc[miss_idx, "satisfaction"] = np.nan
    miss_idx2 = rng.choice(n, size=int(n * 0.03), replace=False)
    df.loc[miss_idx2, "region"] = np.nan
    return df


def make_iris(seed: int = 3) -> pd.DataFrame:
    """Synthetic iris-like measurements (not the original dataset)."""
    rng = np.random.default_rng(seed)
    specs = {
        "setosa": ([5.0, 3.4, 1.5, 0.2], [0.35, 0.38, 0.17, 0.10]),
        "versicolor": ([5.9, 2.8, 4.3, 1.3], [0.52, 0.31, 0.47, 0.20]),
        "virginica": ([6.6, 3.0, 5.6, 2.0], [0.63, 0.32, 0.55, 0.27]),
    }
    frames = []
    for species, (means, stds) in specs.items():
        n = 50
        data = rng.normal(means, stds, size=(n, 4)).round(1)
        frames.append(
            pd.DataFrame(
                data,
                columns=["sepal_length", "sepal_width", "petal_length", "petal_width"],
            ).assign(species=species)
        )
    return pd.concat(frames, ignore_index=True)


def make_tips(n: int = 244, seed: int = 11) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    total_bill = np.round(rng.gamma(5.0, 4.0, n) + 3, 2)
    tip_rate = np.clip(rng.normal(0.16, 0.05, n), 0.05, 0.35)
    tip = np.round(total_bill * tip_rate, 2)
    df = pd.DataFrame(
        {
            "total_bill": total_bill,
            "tip": tip,
            "sex": rng.choice(["Female", "Male"], n),
            "smoker": rng.choice(["No", "Yes"], n, p=[0.62, 0.38]),
            "day": rng.choice(["Thur", "Fri", "Sat", "Sun"], n, p=[0.25, 0.08, 0.36, 0.31]),
            "time": rng.choice(["Lunch", "Dinner"], n, p=[0.28, 0.72]),
            "party_size": rng.integers(1, 7, n),
        }
    )
    return df


SAMPLES = {
    "ecommerce": ("E-commerce Orders", "Synthetic online store orders with revenue, discounts and satisfaction.", make_ecommerce),
    "iris": ("Iris Measurements", "Synthetic flower measurements across three species.", make_iris),
    "tips": ("Restaurant Tips", "Synthetic restaurant bills and tips by day and party size.", make_tips),
}


def main() -> None:
    os.makedirs(SAMPLES_DIR, exist_ok=True)
    for key, (_title, _desc, fn) in SAMPLES.items():
        df = fn()
        path = os.path.join(SAMPLES_DIR, f"{key}.csv")
        df.to_csv(path, index=False)
        print(f"wrote {path} ({df.shape[0]} rows x {df.shape[1]} cols)")


if __name__ == "__main__":
    main()
