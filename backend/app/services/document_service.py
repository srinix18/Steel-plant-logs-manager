from uuid import UUID

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DepartmentDocument, Plant, User
from app.schemas.foundation import DocumentResponse, DocumentUploadMeta
from app.services.access_scope import (
    apply_document_department_scope,
    is_ceo_tier,
    is_hod_tier,
    is_hr,
    is_platform_admin,
)
from app.services.storage import get_storage, make_key


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
        if not is_platform_admin(user):
            # Never leave the user's own organisation.
            query = query.where(
                DepartmentDocument.plant_id.in_(
                    select(Plant.id).where(Plant.organisation_id == user.organisation_id)
                )
            )
        if department_id:
            query = query.where(DepartmentDocument.department_id == department_id)
        if not (is_platform_admin(user) or is_ceo_tier(user) or is_hr(user)):
            # Everyone else sees only their own department, even if another one is requested.
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
        storage_key = make_key("documents", file.filename, "document")
        await get_storage().put(storage_key, data, file.content_type)

        doc = DepartmentDocument(
            plant_id=meta.plant_id,
            department_id=meta.department_id,
            category=meta.category.value,
            title=meta.title,
            version=meta.version,
            file_name=file.filename or storage_key.rsplit("/", 1)[-1],
            storage_path=storage_key,
            mime_type=file.content_type or "application/octet-stream",
            size_bytes=len(data),
            uploaded_by=user.id,
        )
        session.add(doc)
        await session.flush()
        item = DocumentResponse.model_validate(doc)
        item.uploader_name = user.full_name
        return item

    async def get_document_file(
        self, session: AsyncSession, doc_id: UUID, user: User
    ) -> tuple[DepartmentDocument, bytes]:
        doc = await session.get(DepartmentDocument, doc_id)
        if not doc or not doc.is_active:
            raise HTTPException(status_code=404, detail="Document not found")
        visible = await session.execute(
            apply_document_department_scope(select(DepartmentDocument.id), user).where(DepartmentDocument.id == doc_id)
        )
        if visible.scalar_one_or_none() is None:
            raise HTTPException(status_code=403, detail="Access denied")
        if not is_platform_admin(user):
            plant = await session.get(Plant, doc.plant_id) if doc.plant_id else None
            if plant and plant.organisation_id != user.organisation_id:
                raise HTTPException(status_code=403, detail="Access denied")
        return doc, await get_storage().get(doc.storage_path)
