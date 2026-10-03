"""File storage: local disk by default, AWS S3 (or any S3-compatible store) when configured.

Switch to S3 by setting env vars — no code changes:

    S3_BUCKET=my-bucket                # or s3://my-bucket/optional/prefix
    S3_REGION=ap-south-1
    AWS_ACCESS_KEY_ID=...
    AWS_SECRET_ACCESS_KEY=...
    S3_ENDPOINT_URL=https://...        # only for S3-compatible stores (B2, R2, MinIO)

Files are addressed by a relative *key* (e.g. ``documents/<uuid>_report.pdf``),
which is what gets stored in the DB. Rows written before this module existed
hold a local filesystem path; the local backend still resolves those.
"""

from __future__ import annotations

import asyncio
import re
import uuid
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

from fastapi import HTTPException
from fastapi.responses import Response

from app.core.config import settings


def make_key(folder: str, filename: str | None, default: str = "file") -> str:
    """Unique, filesystem/S3-safe key; the original name is kept for readability."""
    safe = re.sub(r"[^\w.\-]", "_", Path(filename or default).name).lstrip(".") or default
    return f"{folder}/{uuid.uuid4().hex}_{safe[:150]}"


class LocalStorage:
    name = "local"

    def __init__(self, root: str):
        self.root = Path(root).resolve()

    def _path(self, key: str) -> Path:
        legacy = Path(key)
        if legacy.is_absolute() or (legacy.parts and legacy.parts[0] == Path(settings.UPLOAD_DIR).name):
            # Pre-storage-layer rows stored a filesystem path.
            path = legacy.resolve()
        else:
            path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise HTTPException(status_code=400, detail="Invalid file key")
        return path

    async def put(self, key: str, data: bytes, content_type: str | None = None) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(path.write_bytes, data)

    async def get(self, key: str) -> bytes:
        path = self._path(key)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="File missing on server")
        return await asyncio.to_thread(path.read_bytes)


class S3Storage:
    name = "s3"

    def __init__(self, bucket: str, prefix: str, region: str | None, endpoint_url: str | None):
        import boto3

        self.bucket = bucket
        self.prefix = prefix.strip("/")
        self.client = boto3.client("s3", region_name=region or None, endpoint_url=endpoint_url or None)

    def _key(self, key: str) -> str:
        key = key.replace("\\", "/").lstrip("/")
        return f"{self.prefix}/{key}" if self.prefix else key

    async def put(self, key: str, data: bytes, content_type: str | None = None) -> None:
        extra = {"ContentType": content_type} if content_type else {}
        await asyncio.to_thread(self.client.put_object, Bucket=self.bucket, Key=self._key(key), Body=data, **extra)

    async def get(self, key: str) -> bytes:
        from botocore.exceptions import ClientError

        def _read() -> bytes:
            obj = self.client.get_object(Bucket=self.bucket, Key=self._key(key))
            return obj["Body"].read()

        try:
            return await asyncio.to_thread(_read)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in ("NoSuchKey", "404"):
                raise HTTPException(status_code=404, detail="File missing in storage") from exc
            raise


def _parse_bucket(value: str) -> tuple[str, str]:
    value = value.strip()
    if value.startswith("s3://"):
        value = value[len("s3://"):]
    bucket, _, prefix = value.partition("/")
    return bucket, prefix


@lru_cache
def get_storage() -> LocalStorage | S3Storage:
    if settings.S3_BUCKET:
        bucket, prefix = _parse_bucket(settings.S3_BUCKET)
        return S3Storage(bucket, prefix or settings.S3_PREFIX, settings.S3_REGION, settings.S3_ENDPOINT_URL)
    return LocalStorage(settings.UPLOAD_DIR)


def file_response(data: bytes, media_type: str | None, filename: str | None) -> Response:
    name = filename or "download"
    return Response(
        content=data,
        media_type=media_type or "application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"},
    )
