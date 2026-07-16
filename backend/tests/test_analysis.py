import numpy as np
import pandas as pd
import pytest

from app import analysis


@pytest.fixture
def df():
    return pd.DataFrame(
        {
            "age": [10, 20, 30, 40, np.nan],
            "score": [1.0, 2.0, 3.0, 4.0, 5.0],
            "city": ["NY", "LA", "NY", "SF", "LA"],
        }
    )


def test_overview_counts(df):
    ov = analysis.dataframe_overview(df)
    assert ov["rows"] == 5
    assert ov["columns"] == 3
    assert ov["numeric_columns"] == 2
    assert ov["categorical_columns"] == 1
    assert ov["missing_cells"] == 1
    assert ov["missing_pct"] == pytest.approx(1 / 15 * 100, rel=1e-3)


def test_numeric_column_profile(df):
    prof = analysis.column_profile(df["score"])
    assert prof["is_numeric"] is True
    assert prof["stats"]["mean"] == pytest.approx(3.0)
    assert prof["stats"]["median"] == pytest.approx(3.0)
    assert prof["stats"]["min"] == 1.0
    assert prof["stats"]["max"] == 5.0
    assert prof["stats"]["q1"] == pytest.approx(2.0)
    assert prof["stats"]["q3"] == pytest.approx(4.0)


def test_categorical_column_profile(df):
    prof = analysis.column_profile(df["city"])
    assert prof["is_numeric"] is False
    assert prof["unique"] == 3
    top = {t["value"]: t["count"] for t in prof["top_values"]}
    assert top["NY"] == 2
    assert top["LA"] == 2


def test_missing_value_counted(df):
    prof = analysis.column_profile(df["age"])
    assert prof["missing"] == 1
    assert prof["missing_pct"] == pytest.approx(20.0)


def test_correlation_matrix_shape(df):
    corr = analysis.correlation_matrix(df)
    assert corr["columns"] == ["age", "score"]
    assert len(corr["matrix"]) == 2
    # diagonal is 1.0
    assert corr["matrix"][0][0] == pytest.approx(1.0)


def test_histogram_counts(df):
    hist = analysis.histogram(df["score"], bins=5)
    total = sum(b["count"] for b in hist["bins"])
    assert total == 5  # all non-null scores binned


def test_histogram_rejects_categorical(df):
    with pytest.raises(ValueError):
        analysis.histogram(df["city"])


def test_bar_counts(df):
    bar = analysis.bar_counts(df["city"])
    labels = {d["label"]: d["count"] for d in bar["data"]}
    assert labels["NY"] == 2


def test_scatter_drops_na(df):
    sc = analysis.scatter_points(df, "age", "score")
    assert len(sc["points"]) == 4  # one age is NaN


def test_paginate_and_sort(df):
    page = analysis.paginate_rows(df, page=1, page_size=2, sort_by="score", sort_dir="desc")
    assert page["total"] == 5
    assert page["total_pages"] == 3
    assert page["rows"][0]["score"] == 5.0
    # NaN serialized to None
    all_rows = analysis.paginate_rows(df, page=3, page_size=2)
    assert all_rows["rows"][0]["age"] is None


def test_paginate_filter(df):
    page = analysis.paginate_rows(df, filter_col="city", filter_value="ny")
    assert page["total"] == 2  # case-insensitive


def test_build_report_markdown(df):
    rep = analysis.build_report("Test", df)
    assert "# Data Report — Test" in rep["markdown"]
    assert "Rows: 5" in rep["markdown"]
    assert rep["profile"]["overview"]["rows"] == 5
