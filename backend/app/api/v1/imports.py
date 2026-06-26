from uuid import UUID

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbSession
from app.services.import_engine.service import ImportEngineService

router = APIRouter()
service = ImportEngineService()


class ImportJobResponse(BaseModel):
    id: UUID
    module_key: str
    file_name: str
    status: str
    summary: dict
    created_by: UUID
    created_at: str | None = None

    model_config = {"from_attributes": True}


@router.get("/imports/modules")
async def list_import_modules(user: CurrentUser):
    return {"modules": service.list_module_keys()}


@router.get("/imports/{module_key}/template")
async def download_template(module_key: str, user: CurrentUser):
    content = service.get_template_bytes(module_key)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{module_key}_template.xlsx"'},
    )


@router.post("/imports/{module_key}/upload", response_model=ImportJobResponse)
async def upload_import(
    module_key: str,
    session: DbSession,
    user: CurrentUser,
    file: UploadFile = File(...),
):
    job = await service.upload(session, user, module_key, file)
    await session.commit()
    return ImportJobResponse(
        id=job.id,
        module_key=job.module_key,
        file_name=job.file_name,
        status=job.status,
        summary=job.summary or {},
        created_by=job.created_by,
        created_at=job.created_at.isoformat() if job.created_at else None,
    )


@router.post("/imports/jobs/{job_id}/preview")
async def preview_import(job_id: UUID, session: DbSession, user: CurrentUser):
    result = await service.preview(session, user, job_id)
    await session.commit()
    return result


@router.post("/imports/jobs/{job_id}/validate")
async def validate_import(job_id: UUID, session: DbSession, user: CurrentUser):
    result = await service.validate(session, user, job_id)
    await session.commit()
    return result


@router.post("/imports/jobs/{job_id}/commit")
async def commit_import(job_id: UUID, session: DbSession, user: CurrentUser):
    result = await service.commit(session, user, job_id)
    await session.commit()
    return result


@router.get("/imports/jobs/{job_id}")
async def get_import_job(job_id: UUID, session: DbSession, user: CurrentUser):
    job = await service.get_job(session, user, job_id)
    return {
        "id": job.id,
        "module_key": job.module_key,
        "file_name": job.file_name,
        "status": job.status,
        "summary": job.summary,
        "rows": [
            {
                "id": r.id,
                "row_number": r.row_number,
                "status": r.status,
                "errors": r.errors,
                "entity_id": r.entity_id,
                "raw_data": r.raw_data,
            }
            for r in job.rows
        ],
    }


@router.get("/imports/jobs/{job_id}/errors")
async def download_error_report(job_id: UUID, session: DbSession, user: CurrentUser):
    content = await service.error_report_bytes(session, user, job_id)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="import_errors_{job_id}.xlsx"'},
    )
