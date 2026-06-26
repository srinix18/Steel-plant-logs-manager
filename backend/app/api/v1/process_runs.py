from uuid import UUID

from fastapi import APIRouter, File, Query, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, DbSession, SupervisorUser
from app.schemas.moi import (
    ProcessRunCreate,
    ProcessRunDetailResponse,
    ProcessRunResponse,
    ProcessRunUpdate,
    RunRemarkAttachmentResponse,
    RunRemarkCreate,
    RunRemarkResponse,
    TransitionRequest,
    WorkflowTransitionLogResponse,
)
from app.services.process_run_service import ProcessRunService
from app.services.run_remark_service import RunRemarkService
from app.services.workflow_service import WorkflowService

router = APIRouter()
run_service = ProcessRunService()
workflow_service = WorkflowService()
remark_service = RunRemarkService()


@router.post("/process-instances/{instance_id}/runs", response_model=ProcessRunDetailResponse, status_code=201)
async def create_run(instance_id: UUID, data: ProcessRunCreate, session: DbSession, user: CurrentUser):
    return await run_service.create_run(session, instance_id, user, data)


@router.get("/process-instances/{instance_id}/runs", response_model=list[ProcessRunResponse])
async def list_instance_runs(
    instance_id: UUID,
    session: DbSession,
    user: CurrentUser,
    state: str | None = None,
    active_only: bool = False,
):
    return await run_service.list_runs(
        session, user, instance_id=instance_id, state=state, active_only=active_only
    )


@router.get("/process-runs/mine", response_model=list[ProcessRunResponse])
async def list_my_runs(session: DbSession, user: CurrentUser, active_only: bool = Query(default=False)):
    return await run_service.list_runs(session, user, created_by=user.id, active_only=active_only)


@router.get("/process-runs", response_model=list[ProcessRunResponse])
async def list_runs(
    session: DbSession,
    user: CurrentUser,
    plant_id: UUID | None = None,
    organisation_id: UUID | None = None,
    department_id: UUID | None = None,
    process_id: UUID | None = None,
    process_code: str | None = None,
    instance_id: UUID | None = None,
    state: str | None = None,
    active_only: bool = Query(default=False),
    created_by: UUID | None = None,
):
    return await run_service.list_runs(
        session,
        user,
        plant_id=plant_id,
        organisation_id=organisation_id,
        department_id=department_id,
        process_id=process_id,
        process_code=process_code,
        instance_id=instance_id,
        state=state,
        active_only=active_only,
        created_by=created_by,
    )


@router.get("/process-runs/{run_id}", response_model=ProcessRunDetailResponse)
async def get_run(run_id: UUID, session: DbSession, user: CurrentUser):
    return await run_service.get_run(session, run_id, user)


@router.patch("/process-runs/{run_id}", response_model=ProcessRunDetailResponse)
async def update_run(run_id: UUID, data: ProcessRunUpdate, session: DbSession, user: CurrentUser):
    return await run_service.update_run(session, run_id, user, data)


@router.post("/process-runs/{run_id}/transitions", response_model=ProcessRunDetailResponse)
async def transition_run(run_id: UUID, data: TransitionRequest, session: DbSession, user: CurrentUser):
    from app.db.models import ProcessRun

    run = await session.get(ProcessRun, run_id)
    if not run:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Process run not found")
    await workflow_service.execute_transition(session, run, user, data)
    if data.to_state in ("completed", "closed", "approved"):
        await run_service.compute_analytics_facts(session, run_id)
        try:
            from app.services.cost_engine_service import CostEngineService

            await CostEngineService().compute_for_run(session, run_id, user=None)
        except Exception:
            pass
    return await run_service.get_run(session, run_id, user)


@router.get("/process-runs/{run_id}/transitions/history", response_model=list[WorkflowTransitionLogResponse])
async def transition_history(run_id: UUID, session: DbSession, _: CurrentUser):
    from sqlalchemy import select

    from app.db.models import WorkflowTransitionLog

    result = await session.execute(
        select(WorkflowTransitionLog)
        .where(WorkflowTransitionLog.run_id == run_id)
        .order_by(WorkflowTransitionLog.created_at)
    )
    return [WorkflowTransitionLogResponse.model_validate(t) for t in result.scalars()]


@router.get("/plants/{plant_id}/runs/active", response_model=list[ProcessRunResponse])
async def active_plant_runs(plant_id: UUID, session: DbSession, user: SupervisorUser):
    return await run_service.list_runs(session, user, plant_id=plant_id, active_only=True)


@router.get("/process-runs/{run_id}/remarks", response_model=list[RunRemarkResponse])
async def list_run_remarks(run_id: UUID, session: DbSession, user: CurrentUser):
    return await remark_service.list_remarks(session, run_id, user)


@router.post("/process-runs/{run_id}/remarks", response_model=RunRemarkResponse, status_code=201)
async def create_run_remark(run_id: UUID, data: RunRemarkCreate, session: DbSession, user: CurrentUser):
    return await remark_service.create_remark(session, run_id, user, data)


@router.post("/process-runs/{run_id}/remarks/{parent_id}/reply", response_model=RunRemarkResponse, status_code=201)
async def reply_run_remark(
    run_id: UUID, parent_id: UUID, data: RunRemarkCreate, session: DbSession, user: CurrentUser
):
    return await remark_service.reply_to_remark(session, run_id, parent_id, user, data)


@router.post(
    "/process-runs/{run_id}/remarks/{remark_id}/attachments",
    response_model=RunRemarkAttachmentResponse,
    status_code=201,
)
async def upload_remark_attachment(
    run_id: UUID,
    remark_id: UUID,
    session: DbSession,
    user: CurrentUser,
    file: UploadFile = File(...),
):
    return await remark_service.add_attachment(session, run_id, remark_id, user, file)


@router.get("/attachments/{attachment_id}")
async def get_attachment(attachment_id: UUID, session: DbSession, user: CurrentUser):
    path, mime_type, filename = await remark_service.get_attachment(session, attachment_id, user)
    return FileResponse(path, media_type=mime_type, filename=filename)
