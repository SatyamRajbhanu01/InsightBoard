"""Tests for the enterprise-hardening surface: unified OpenAPI docs, RFC 7807
error bodies, request validation, correlation ids, security headers and
list-endpoint pagination/sorting/filtering."""
import io

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

SMALL_CSV = "a,b,group\n1,4.5,x\n2,5.5,y\n3,6.5,x\n4,7.5,y\n"


# --- Unified OpenAPI / docs ------------------------------------------------- #
def test_docs_and_redoc_served():
    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200


def test_openapi_lists_all_api_routes_in_one_place():
    spec = client.get("/openapi.json").json()
    paths = set(spec["paths"].keys())
    expected = {
        "/api/health",
        "/api/ready",
        "/api/datasets",
        "/api/upload",
        "/api/datasets/{ds_id}/profile",
        "/api/datasets/{ds_id}/rows",
        "/api/datasets/{ds_id}/chart",
        "/api/datasets/{ds_id}/report",
    }
    assert expected.issubset(paths)
    # Every operation is tagged.
    for path, ops in spec["paths"].items():
        for method, op in ops.items():
            assert op.get("tags"), f"{method} {path} missing tag"
            assert op.get("summary"), f"{method} {path} missing summary"


def test_openapi_metadata():
    spec = client.get("/openapi.json").json()
    info = spec["info"]
    assert info["title"] == "InsightBoard API"
    assert info["version"]
    assert "contact" in info and "license" in info


# --- Health / readiness ----------------------------------------------------- #
def test_readiness():
    body = client.get("/api/ready").json()
    assert body["status"] == "ready"
    assert body["datasets"] >= 3


# --- RFC 7807 problem details ---------------------------------------------- #
def test_not_found_is_problem_detail():
    resp = client.get("/api/datasets/does-not-exist/profile")
    assert resp.status_code == 404
    assert resp.headers["content-type"].startswith("application/problem+json")
    body = resp.json()
    assert body["status"] == 404
    assert body["title"] == "Not Found"
    assert body["instance"] == "/api/datasets/does-not-exist/profile"
    assert body["request_id"]
    # Backward-compatible flat error the existing frontend reads.
    assert body["error"] == body["detail"]


def test_validation_error_has_field_errors():
    resp = client.get("/api/datasets/sample-iris/rows", params={"page": 0})
    assert resp.status_code == 422
    body = resp.json()
    assert body["status"] == 422
    assert body["errors"], "expected per-field errors"
    assert any(e["field"].endswith("page") for e in body["errors"])


def test_bad_chart_kind_rejected_with_field_error():
    resp = client.get("/api/datasets/sample-iris/chart", params={"kind": "pie"})
    assert resp.status_code == 422
    assert resp.json()["errors"]


# --- Correlation id / security headers -------------------------------------- #
def test_correlation_id_echoed():
    resp = client.get("/api/health", headers={"X-Request-ID": "trace-123"})
    assert resp.headers.get("X-Request-ID") == "trace-123"


def test_correlation_id_generated_when_absent():
    resp = client.get("/api/health")
    assert resp.headers.get("X-Request-ID")


def test_security_headers_present():
    h = client.get("/api/health").headers
    assert h["X-Content-Type-Options"] == "nosniff"
    assert h["X-Frame-Options"] == "DENY"
    assert "Referrer-Policy" in h


# --- List filtering / sorting ----------------------------------------------- #
def test_datasets_filter_by_source():
    resp = client.get("/api/datasets", params={"source": "sample"})
    assert resp.status_code == 200
    datasets = resp.json()["datasets"]
    assert datasets and all(d["source"] == "sample" for d in datasets)


def test_datasets_sort_by_rows_desc():
    resp = client.get("/api/datasets", params={"sort_by": "rows", "sort_dir": "desc"})
    rows = [d["rows"] for d in resp.json()["datasets"]]
    assert rows == sorted(rows, reverse=True)


def test_datasets_invalid_source_is_422():
    resp = client.get("/api/datasets", params={"source": "bogus"})
    assert resp.status_code == 422


# --- Pagination / sorting / filtering on rows ------------------------------- #
def test_rows_filter_and_sort():
    files = {"file": ("small.csv", io.BytesIO(SMALL_CSV.encode()), "text/csv")}
    ds_id = client.post("/api/upload", files=files).json()["id"]

    resp = client.get(
        f"/api/datasets/{ds_id}/rows",
        params={"filter_col": "group", "filter_value": "x", "sort_by": "a", "sort_dir": "desc"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert [r["a"] for r in body["rows"]] == [3, 1]


def test_rows_page_size_upper_bound_enforced():
    resp = client.get("/api/datasets/sample-tips/rows", params={"page_size": 999})
    assert resp.status_code == 422


# --- Report formats --------------------------------------------------------- #
def test_report_json_format():
    resp = client.get("/api/datasets/sample-iris/report", params={"fmt": "json"})
    assert resp.status_code == 200
    assert "overview" in resp.json()
