from __future__ import annotations

import uuid
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import HTTPException, UploadFile
from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import ImportJob, ImportJobRow, User
from app.models.enums import ImportJobStatus, ImportRowStatus
from app.services.access_scope import assert_import_access
from app.services.import_engine import parser
from app.services.import_engine.registry import get_module, list_modules


class ImportEngineService:
    def _upload_root(self) -> Path:
        root = Path(settings.UPLOAD_DIR)
        root.mkdir(parents=True, exist_ok=True)
        return root

    def list_module_keys(self) -> list[str]:
        return list_modules()

    def get_template_bytes(self, module_key: str) -> bytes:
        mod = get_module(module_key)
        return parser.build_template(mod["columns"])

    async def upload(
        self,
        session: AsyncSession,
        actor: User,
        module_key: str,
        file: UploadFile,
    ) -> ImportJob:
        assert_import_access(actor)
        get_module(module_key)

        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty file")

        ext = Path(file.filename or "import.xlsx").suffix.lower() or ".xlsx"
        if ext not in (".xlsx", ".xls"):
            raise HTTPException(status_code=400, detail="Only .xlsx files are supported")

        file_id = uuid.uuid4()
        rel_path = f"imports/{file_id}{ext}"
        full_path = self._upload_root() / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(content)

        job = ImportJob(
            module_key=module_key,
            file_name=file.filename or "import.xlsx",
            storage_path=rel_path,
            status=ImportJobStatus.UPLOADED.value,
            created_by=actor.id,
            summary={},
        )
        session.add(job)
        await session.flush()
        return job

    async def _load_job(self, session: AsyncSession, job_id: UUID, actor: User) -> ImportJob:
        assert_import_access(actor)
        job = await session.get(ImportJob, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Import job not found")
        return job

    def _read_file(self, job: ImportJob) -> bytes:
        path = self._upload_root() / job.storage_path
        if not path.exists():
            raise HTTPException(status_code=404, detail="Import file not found on disk")
        return path.read_bytes()

    @staticmethod
    def _job_dict(job: ImportJob) -> dict[str, Any]:
        return {
            "id": str(job.id),
            "module_key": job.module_key,
            "file_name": job.file_name,
            "status": job.status,
            "summary": job.summary or {},
            "created_by": str(job.created_by),
            "created_at": job.created_at.isoformat() if job.created_at else None,
        }

    @staticmethod
    def _row_dict(row: ImportJobRow) -> dict[str, Any]:
        return {
            "id": str(row.id),
            "job_id": str(row.job_id),
            "row_number": row.row_number,
            "raw_data": row.raw_data,
            "status": row.status,
            "errors": row.errors or [],
            "entity_id": str(row.entity_id) if row.entity_id else None,
        }

    async def _load_rows(self, session: AsyncSession, job_id: UUID) -> list[ImportJobRow]:
        result = await session.execute(
            select(ImportJobRow)
            .where(ImportJobRow.job_id == job_id)
            .order_by(ImportJobRow.row_number)
        )
        return list(result.scalars())

    async def preview(self, session: AsyncSession, actor: User, job_id: UUID) -> dict[str, Any]:
        job = await self._load_job(session, job_id, actor)
        mod = get_module(job.module_key)
        content = self._read_file(job)
        rows = parser.parse_xlsx(content)

        existing = await session.execute(
            select(ImportJobRow).where(ImportJobRow.job_id == job.id)
        )
        for old in existing.scalars():
            await session.delete(old)
        await session.flush()

        db_rows: list[ImportJobRow] = []
        for idx, row_data in enumerate(rows, start=2):
            db_row = ImportJobRow(
                job_id=job.id,
                row_number=idx,
                raw_data=row_data,
                status=ImportRowStatus.PENDING.value,
                errors=[],
            )
            session.add(db_row)
            db_rows.append(db_row)

        job.status = ImportJobStatus.PREVIEWED.value
        job.summary = {"total_rows": len(rows)}
        await session.flush()

        return {
            "job": self._job_dict(job),
            "rows": [self._row_dict(r) for r in db_rows],
            "columns": mod["columns"],
            "total_rows": len(rows),
        }

    async def validate(self, session: AsyncSession, actor: User, job_id: UUID) -> dict[str, Any]:
        job = await self._load_job(session, job_id, actor)
        if not actor.organisation_id:
            raise HTTPException(status_code=400, detail="User has no organisation")

        mod = get_module(job.module_key)
        rows = await self._load_rows(session, job.id)

        valid_count = invalid_count = 0
        for row in rows:
            errors = await mod["validate_row"](
                session, actor, row.raw_data, org_id=actor.organisation_id
            )
            if errors:
                row.status = ImportRowStatus.INVALID.value
                row.errors = errors
                invalid_count += 1
            else:
                row.status = ImportRowStatus.VALID.value
                row.errors = []
                valid_count += 1

        job.status = ImportJobStatus.VALIDATED.value
        job.summary = {
            **(job.summary or {}),
            "valid_rows": valid_count,
            "invalid_rows": invalid_count,
        }
        await session.flush()
        return {
            "job": self._job_dict(job),
            "valid_count": valid_count,
            "invalid_count": invalid_count,
            "rows": [self._row_dict(r) for r in rows],
        }

    async def commit(self, session: AsyncSession, actor: User, job_id: UUID) -> dict[str, Any]:
        job = await self._load_job(session, job_id, actor)
        if job.status not in (ImportJobStatus.VALIDATED.value, ImportJobStatus.PREVIEWED.value):
            raise HTTPException(status_code=400, detail="Job must be validated before commit")

        if not actor.organisation_id:
            raise HTTPException(status_code=400, detail="User has no organisation")

        mod = get_module(job.module_key)
        result = await session.execute(
            select(ImportJobRow)
            .where(ImportJobRow.job_id == job.id, ImportJobRow.status == ImportRowStatus.VALID.value)
            .order_by(ImportJobRow.row_number)
        )
        rows = list(result.scalars())

        imported = failed = skipped = 0
        job.status = ImportJobStatus.IMPORTING.value
        await session.flush()

        for row in rows:
            try:
                outcome = await mod["import_row"](
                    session, actor, row.raw_data, org_id=actor.organisation_id
                )
                row.status = ImportRowStatus.IMPORTED.value
                row.entity_id = outcome.get("entity_id")
                imported += 1
            except Exception as exc:
                row.status = ImportRowStatus.INVALID.value
                row.errors = [str(exc)]
                failed += 1

        job.status = (
            ImportJobStatus.COMPLETED.value if failed == 0 else ImportJobStatus.FAILED.value
        )
        job.summary = {
            **(job.summary or {}),
            "imported": imported,
            "failed": failed,
            "skipped": skipped,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        await session.flush()
        return {
            "job": self._job_dict(job),
            "imported": imported,
            "failed": failed,
            "skipped": skipped,
        }

    async def get_job(self, session: AsyncSession, actor: User, job_id: UUID) -> ImportJob:
        job = await self._load_job(session, job_id, actor)
        await session.refresh(job, ["rows"])
        return job

    async def error_report_bytes(self, session: AsyncSession, actor: User, job_id: UUID) -> bytes:
        job = await self._load_job(session, job_id, actor)
        mod = get_module(job.module_key)
        columns = mod["columns"]

        rows = await self._load_rows(session, job.id)

        wb = Workbook()
        ws = wb.active
        ws.title = "Errors"
        headers = ["row_number", "status", "errors"] + columns
        for col_idx, h in enumerate(headers, start=1):
            ws.cell(row=1, column=col_idx, value=h)

        for r_idx, row in enumerate(rows, start=2):
            if row.status not in (ImportRowStatus.INVALID.value, ImportRowStatus.PENDING.value):
                continue
            ws.cell(row=r_idx, column=1, value=row.row_number)
            ws.cell(row=r_idx, column=2, value=row.status)
            ws.cell(row=r_idx, column=3, value="; ".join(str(e) for e in (row.errors or [])))
            for c_idx, col in enumerate(columns, start=4):
                ws.cell(row=r_idx, column=c_idx, value=row.raw_data.get(col, ""))

        buf = BytesIO()
        wb.save(buf)
        return buf.getvalue()
