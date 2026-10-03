"""Uploads/downloads through the storage layer, on local disk and on S3 (mocked with moto)."""

import pytest

from app.core.config import settings
from app.services import storage
from tests.test_process_runs import BY_CODE, create_run

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.4\n%pytest\n"


async def _roundtrip_all(api) -> list[str]:
    """Upload one file through each feature and download it back. Returns storage keys."""
    keys = []

    # Remark photo on a logbook run
    run = await create_run(api, BY_CODE["IAF"])
    remark = await api.ok("worker_sms", "POST", f"/process-runs/{run['id']}/remarks", status=201, json={"body": "photo"})
    att = await api.ok("worker_sms", "POST", f"/process-runs/{run['id']}/remarks/{remark['id']}/attachments",
                       status=201, files={"file": ("../../evil name.png", PNG, "image/png")})
    r = await api.get("sup_iaf", f"/attachments/{att['id']}")
    assert r.status_code == 200 and r.content == PNG
    assert (await api.get("worker_rolling", f"/attachments/{att['id']}")).status_code == 403

    # Message attachment
    msg = await api.ok("worker_sms", "POST", "/messages", status=(200, 201), json={
        "subject": "file", "body": "see attached", "recipient_ids": [api.user("sup_iaf")["id"]],
    })
    matt = await api.ok("worker_sms", "POST", f"/messages/{msg['id']}/attachments", status=201,
                        files={"file": ("report.pdf", PDF, "application/pdf")})
    r = await api.get("sup_iaf", f"/messages/attachments/{matt['id']}")
    assert r.status_code == 200 and r.content == PDF
    assert "report.pdf" in r.headers["content-disposition"]
    assert (await api.get("worker_rolling", f"/messages/attachments/{matt['id']}")).status_code == 403

    # Department document
    hod = api.user("hod_sms")
    doc = await api.ok("hod_sms", "POST", "/foundation/documents", status=201,
                       data={"plant_id": hod["plant_id"], "department_id": hod["department_id"],
                             "category": "sop", "title": "Furnace SOP"},
                       files={"file": ("sop.pdf", PDF, "application/pdf")})
    r = await api.get("sup_iaf", f"/foundation/documents/{doc['id']}/download")
    assert r.status_code == 200 and r.content == PDF
    # Another department cannot download SMS documents.
    assert (await api.get("worker_rolling", f"/foundation/documents/{doc['id']}/download")).status_code == 403

    from sqlalchemy import select

    from app.db.models import DepartmentDocument, MessageAttachment, RunRemarkAttachment
    from app.db.session import async_session_factory

    async with async_session_factory() as s:
        keys.append(await s.scalar(select(RunRemarkAttachment.storage_path).where(RunRemarkAttachment.id == att["id"])))
        keys.append(await s.scalar(select(MessageAttachment.storage_path).where(MessageAttachment.id == matt["id"])))
        keys.append(await s.scalar(select(DepartmentDocument.storage_path).where(DepartmentDocument.id == doc["id"])))
    for key in keys:
        assert ".." not in key and not key.startswith("/"), key
    return keys


async def test_local_storage_roundtrip(api, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(settings, "S3_BUCKET", "")
    storage.get_storage.cache_clear()
    try:
        assert storage.get_storage().name == "local"
        keys = await _roundtrip_all(api)
        for key in keys:
            assert (tmp_path / key).is_file()
    finally:
        storage.get_storage.cache_clear()


async def test_s3_storage_roundtrip(api, monkeypatch):
    moto = pytest.importorskip("moto")
    import boto3

    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "test")
    monkeypatch.setattr(settings, "S3_BUCKET", "s3://moi-test-bucket/chandan")
    monkeypatch.setattr(settings, "S3_REGION", "ap-south-1")
    storage.get_storage.cache_clear()
    with moto.mock_aws():
        s3 = boto3.client("s3", region_name="ap-south-1")
        s3.create_bucket(Bucket="moi-test-bucket", CreateBucketConfiguration={"LocationConstraint": "ap-south-1"})
        try:
            assert storage.get_storage().name == "s3"
            keys = await _roundtrip_all(api)
            stored = {o["Key"] for o in s3.list_objects_v2(Bucket="moi-test-bucket")["Contents"]}
            for key in keys:
                assert f"chandan/{key}" in stored
        finally:
            storage.get_storage.cache_clear()


def test_local_storage_rejects_path_escape(tmp_path):
    local = storage.LocalStorage(str(tmp_path))
    with pytest.raises(Exception):
        local._path("../../etc/passwd")


def test_make_key_sanitises_names():
    key = storage.make_key("documents", "../../secret plan.pdf")
    folder, name = key.split("/", 1)
    assert folder == "documents" and "/" not in name and ".." not in name and name.endswith("secret_plan.pdf")


async def test_import_upload_and_preview_use_storage(api):
    template = await api.get("hr", "/imports/employees/template")
    assert template.status_code == 200
    xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    job = await api.ok("hr", "POST", "/imports/employees/upload", files={"file": ("emp.xlsx", template.content, xlsx)})
    await api.ok("hr", "POST", f"/imports/jobs/{job['id']}/preview")
    assert (await api.post("worker_sms", "/imports/employees/upload",
                           files={"file": ("emp.xlsx", template.content, xlsx)})).status_code == 403
