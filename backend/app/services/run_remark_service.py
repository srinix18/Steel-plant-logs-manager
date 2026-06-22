import re
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.models import Department, Plant, ProcessRun, RunFieldValue, RunRemark, RunRemarkAttachment, User
from app.models.enums import RemarkAuthorRole, ValueSource
from app.schemas.moi import RunRemarkAttachmentResponse, RunRemarkCreate, RunRemarkResponse
from app.services.access_scope import assert_run_access, is_supervisor_tier

ALLOWED_MIME = {"image/jpeg", "image/png"}
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024


def _is_supervisor(user: User) -> bool:
    return is_supervisor_tier(user)


async def _mirror_legacy_remarks(session: AsyncSession, run_id: UUID) -> None:
    result = await session.execute(
        select(RunRemark)
        .where(RunRemark.run_id == run_id, RunRemark.role == RemarkAuthorRole.MELTER.value, RunRemark.parent_id.is_(None))
        .order_by(RunRemark.created_at.desc())
        .limit(1)
    )
    remark = result.scalar_one_or_none()
    if not remark:
        return
    existing = await session.execute(
        select(RunFieldValue).where(RunFieldValue.run_id == run_id, RunFieldValue.field_key == "remarks")
    )
    fv = existing.scalar_one_or_none()
    if fv:
        fv.value = remark.body
        fv.source = ValueSource.SYSTEM
    else:
        session.add(
            RunFieldValue(
                run_id=run_id,
                field_key="remarks",
                value=remark.body,
                source=ValueSource.SYSTEM,
            )
        )


class RunRemarkService:
    async def list_remarks(self, session: AsyncSession, run_id: UUID, user: User) -> list[RunRemarkResponse]:
        run = await session.get(ProcessRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Process run not found")
        await assert_run_access(session, run, user)

        result = await session.execute(
            select(RunRemark)
            .where(RunRemark.run_id == run_id)
            .options(
                selectinload(RunRemark.author),
                selectinload(RunRemark.attachments),
            )
            .order_by(RunRemark.created_at)
        )
        return [RunRemarkResponse.model_validate(r) for r in result.scalars()]

    async def create_remark(
        self, session: AsyncSession, run_id: UUID, user: User, data: RunRemarkCreate
    ) -> RunRemarkResponse:
        run = await session.get(ProcessRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Process run not found")
        await assert_run_access(session, run, user)

        if run.current_state in ("closed", "aborted"):
            raise HTTPException(status_code=400, detail="Cannot add remarks to a closed run")

        if not _is_supervisor(user) and run.current_state not in ("created", "in_progress", "waiting_for_sample", "refining", "ready_to_tap"):
            raise HTTPException(status_code=403, detail="Workers can only remark during active heat")

        role = RemarkAuthorRole.SUPERVISOR.value if _is_supervisor(user) else RemarkAuthorRole.MELTER.value
        if role == RemarkAuthorRole.MELTER.value:
            existing = await session.execute(
                select(RunRemark).where(
                    RunRemark.run_id == run_id,
                    RunRemark.role == RemarkAuthorRole.MELTER.value,
                    RunRemark.parent_id.is_(None),
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Melter remark already exists; use supervisor reply")

        remark = RunRemark(
            run_id=run_id,
            author_id=user.id,
            body=data.body.strip(),
            role=role,
        )
        session.add(remark)
        await session.flush()
        if role == RemarkAuthorRole.MELTER.value:
            await _mirror_legacy_remarks(session, run_id)
        await session.refresh(remark, ["author", "attachments"])
        return RunRemarkResponse.model_validate(remark)

    async def reply_to_remark(
        self, session: AsyncSession, run_id: UUID, parent_id: UUID, user: User, data: RunRemarkCreate
    ) -> RunRemarkResponse:
        if not _is_supervisor(user):
            raise HTTPException(status_code=403, detail="Only supervisors can reply")

        run = await session.get(ProcessRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Process run not found")
        await assert_run_access(session, run, user)

        if run.current_state not in ("completed", "approved", "closed"):
            raise HTTPException(status_code=400, detail="Supervisor replies are allowed after heat completion")

        parent = await session.get(RunRemark, parent_id)
        if not parent or parent.run_id != run_id:
            raise HTTPException(status_code=404, detail="Parent remark not found")
        if parent.parent_id is not None:
            raise HTTPException(status_code=400, detail="Can only reply to top-level remarks")

        remark = RunRemark(
            run_id=run_id,
            author_id=user.id,
            body=data.body.strip(),
            role=RemarkAuthorRole.SUPERVISOR.value,
            parent_id=parent_id,
        )
        session.add(remark)
        await session.flush()
        await session.refresh(remark, ["author", "attachments"])
        return RunRemarkResponse.model_validate(remark)

    async def add_attachment(
        self, session: AsyncSession, run_id: UUID, remark_id: UUID, user: User, file: UploadFile
    ) -> RunRemarkAttachmentResponse:
        run = await session.get(ProcessRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Process run not found")
        await assert_run_access(session, run, user)

        remark = await session.get(RunRemark, remark_id)
        if not remark or remark.run_id != run_id:
            raise HTTPException(status_code=404, detail="Remark not found")
        if remark.author_id != user.id and not _is_supervisor(user):
            raise HTTPException(status_code=403, detail="Cannot attach to another user's remark")

        content_type = file.content_type or ""
        if content_type not in ALLOWED_MIME:
            raise HTTPException(status_code=400, detail="Only JPEG and PNG images are allowed")

        data = await file.read()
        if len(data) > MAX_ATTACHMENT_BYTES:
            raise HTTPException(status_code=400, detail="File exceeds 5 MB limit")

        upload_root = Path(settings.UPLOAD_DIR)
        upload_root.mkdir(parents=True, exist_ok=True)
        safe_name = re.sub(r"[^\w.\-]", "_", file.filename or "image")
        storage_name = f"{uuid.uuid4().hex}_{safe_name}"
        storage_path = upload_root / storage_name
        storage_path.write_bytes(data)

        attachment = RunRemarkAttachment(
            remark_id=remark_id,
            file_name=file.filename or safe_name,
            storage_path=str(storage_path),
            mime_type=content_type,
            size_bytes=len(data),
            uploaded_by=user.id,
        )
        session.add(attachment)
        await session.flush()
        return RunRemarkAttachmentResponse.model_validate(attachment)

    async def get_attachment(
        self, session: AsyncSession, attachment_id: UUID, user: User
    ) -> tuple[Path, str, str]:
        result = await session.execute(
            select(RunRemarkAttachment)
            .where(RunRemarkAttachment.id == attachment_id)
            .options(selectinload(RunRemarkAttachment.remark))
        )
        attachment = result.scalar_one_or_none()
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")

        run = await session.get(ProcessRun, attachment.remark.run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Process run not found")
        await assert_run_access(session, run, user)

        path = Path(attachment.storage_path)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="File missing on server")
        return path, attachment.mime_type, attachment.file_name
