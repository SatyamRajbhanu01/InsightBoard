import io

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

SMALL_CSV = "a,b,group\n1,4.5,x\n2,5.5,y\n3,6.5,x\n4,7.5,y\n"


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_list_datasets_has_samples():
    resp = client.get("/api/datasets")
    assert resp.status_code == 200
    ids = [d["id"] for d in resp.json()["datasets"]]
    assert "sample-iris" in ids
    assert "sample-ecommerce" in ids


def test_upload_then_profile():
    files = {"file": ("small.csv", io.BytesIO(SMALL_CSV.encode()), "text/csv")}
    up = client.post("/api/upload", files=files)
    assert up.status_code == 200, up.text
    ds_id = up.json()["id"]
    assert up.json()["rows"] == 4
    assert up.json()["columns"] == 3

    prof = client.get(f"/api/datasets/{ds_id}/profile")
    assert prof.status_code == 200
    body = prof.json()
    assert body["overview"]["rows"] == 4
    col_names = [c["name"] for c in body["columns"]]
    assert set(col_names) == {"a", "b", "group"}


def test_upload_rejects_non_csv():
    files = {"file": ("data.txt", io.BytesIO(b"hello"), "text/plain")}
    resp = client.post("/api/upload", files=files)
    assert resp.status_code == 400
    assert "csv" in resp.json()["error"].lower()


def test_upload_rejects_empty():
    files = {"file": ("empty.csv", io.BytesIO(b""), "text/csv")}
    resp = client.post("/api/upload", files=files)
    assert resp.status_code == 400


def test_chart_histogram_on_sample():
    resp = client.get("/api/datasets/sample-iris/chart", params={"kind": "histogram", "column": "petal_length"})
    assert resp.status_code == 200
    assert len(resp.json()["bins"]) > 0


def test_chart_scatter_requires_numeric():
    resp = client.get(
        "/api/datasets/sample-iris/chart",
        params={"kind": "scatter", "x": "species", "y": "petal_length"},
    )
    assert resp.status_code == 400


def test_rows_pagination():
    resp = client.get("/api/datasets/sample-tips/rows", params={"page": 1, "page_size": 10})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["rows"]) == 10
    assert body["page"] == 1


def test_report_download():
    resp = client.get("/api/datasets/sample-iris/report")
    assert resp.status_code == 200
    assert "Data Report" in resp.text


def test_unknown_dataset_404():
    resp = client.get("/api/datasets/does-not-exist/profile")
    assert resp.status_code == 404
