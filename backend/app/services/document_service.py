from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import DepartmentDocument, User
from app.schemas.foundation import DocumentResponse, DocumentUploadMeta
from app.services.access_scope import is_ceo_tier, is_hod_tier, is_platform_admin, is_hr


class DocumentService:
    async def list_documents(
        self,
        session: AsyncSession,
        user: User,
        plant_id: UUID | None = None,
        department_id: UUID | None = None,
        category: str | None = None,
    ) -> list[DocumentResponse]:
        query = (
            select(DepartmentDocument, User.full_name)
            .join(User, DepartmentDocument.uploaded_by == User.id)
            .where(DepartmentDocument.is_active.is_(True))
            .order_by(DepartmentDocument.created_at.desc())
        )
        if plant_id:
            query = query.where(DepartmentDocument.plant_id == plant_id)
        if department_id:
            query = query.where(DepartmentDocument.department_id == department_id)
        elif not (is_platform_admin(user) or is_ceo_tier(user) or is_hr(user)):
            if user.department_id:
                query = query.where(DepartmentDocument.department_id == user.department_id)
            else:
                query = query.where(False)
        if category:
            query = query.where(DepartmentDocument.category == category)
        result = await session.execute(query)
        docs = []
        for doc, uploader_name in result.all():
            item = DocumentResponse.model_validate(doc)
            item.uploader_name = uploader_name
            docs.append(item)
        return docs

    async def upload_document(
        self,
        session: AsyncSession,
        user: User,
        meta: DocumentUploadMeta,
        file: UploadFile,
    ) -> DocumentResponse:
        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="Empty file")
        upload_root = Path(settings.UPLOAD_DIR) / "documents"
        upload_root.mkdir(parents=True, exist_ok=True)
        storage_name = f"{uuid4()}_{file.filename}"
        storage_path = upload_root / storage_name
        storage_path.write_bytes(data)

        doc = DepartmentDocument(
            plant_id=meta.plant_id,
            department_id=meta.department_id,
            category=meta.category.value,
            title=meta.title,
            version=meta.version,
            file_name=file.filename or storage_name,
            storage_path=str(storage_path),
            mime_type=file.content_type or "application/octet-stream",
            size_bytes=len(data),
            uploaded_by=user.id,
        )
        session.add(doc)
        await session.flush()
        item = DocumentResponse.model_validate(doc)
        item.uploader_name = user.full_name
        return item

    async def get_document_path(self, session: AsyncSession, doc_id: UUID) -> tuple[DepartmentDocument, Path]:
        doc = await session.get(DepartmentDocument, doc_id)
        if not doc or not doc.is_active:
            raise HTTPException(status_code=404, detail="Document not found")
        return doc, Path(doc.storage_path)
