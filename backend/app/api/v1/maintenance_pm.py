from datetime import date
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.maintenance_pm import (
    MaintenanceAnalyticsResponse,
    MaintenanceDowntimeCreate,
    MaintenanceDowntimeResponse,
    MaintenanceDowntimeUpdate,
    MaintenanceNotificationRuleCreate,
    MaintenanceNotificationRuleResponse,
    MaintenanceNotificationRuleUpdate,
    MaintenanceProgramCreate,
    MaintenanceProgramResponse,
    MaintenanceProgramUpdate,
    MaintenanceTaskTemplateCreate,
    MaintenanceTaskTemplateResponse,
    MaintenanceTaskTemplateUpdate,
    MaintenanceTriggerCreate,
    MaintenanceTriggerResponse,
    MaintenanceTriggerUpdate,
    MaintenanceWorkOrderCreate,
    MaintenanceWorkOrderPartCreate,
    MaintenanceWorkOrderPartResponse,
    MaintenanceWorkOrderPartUpdate,
    MaintenanceWorkOrderResponse,
    MaintenanceWorkOrderTaskExecute,
    MaintenanceWorkOrderTaskResponse,
    MaintenanceWorkOrderTransitionCreate,
    MaintenanceWorkOrderUpdate,
    PmEvaluateResponse,
)
from app.services.maintenance_analytics_service import MaintenanceAnalyticsService
from app.services.pm_program_service import PmProgramService
from app.services.pm_trigger_service import PmTriggerService
from app.services.pm_work_order_service import PmWorkOrderService

router = APIRouter()
program_service = PmProgramService()
wo_service = PmWorkOrderService()
trigger_service = PmTriggerService()
analytics_service = MaintenanceAnalyticsService()


# --- Programs ---


@router.get("/maintenance/pm/programs", response_model=list[MaintenanceProgramResponse])
async def list_programs(
    session: DbSession,
    user: CurrentUser,
    plant_id: UUID | None = None,
    status: str | None = None,
):
    return await program_service.list_programs(session, user, plant_id=plant_id, status=status)


@router.post("/maintenance/pm/programs", response_model=MaintenanceProgramResponse, status_code=201)
async def create_program(session: DbSession, user: CurrentUser, data: MaintenanceProgramCreate):
    result = await program_service.create_program(session, user, data)
    await session.commit()
    return result


@router.get("/maintenance/pm/programs/{program_id}")
async def get_program_detail(session: DbSession, user: CurrentUser, program_id: UUID):
    return await program_service.get_program_detail(session, user, program_id)


@router.patch("/maintenance/pm/programs/{program_id}", response_model=MaintenanceProgramResponse)
async def update_program(
    session: DbSession, user: CurrentUser, program_id: UUID, data: MaintenanceProgramUpdate
):
    result = await program_service.update_program(session, user, program_id, data)
    await session.commit()
    return result


@router.delete("/maintenance/pm/programs/{program_id}", status_code=204)
async def delete_program(session: DbSession, user: CurrentUser, program_id: UUID):
    await program_service.delete_program(session, user, program_id)
    await session.commit()


# --- Triggers ---


@router.get(
    "/maintenance/pm/programs/{program_id}/triggers",
    response_model=list[MaintenanceTriggerResponse],
)
async def list_triggers(session: DbSession, user: CurrentUser, program_id: UUID):
    return await program_service.list_triggers(session, user, program_id)


@router.post(
    "/maintenance/pm/programs/{program_id}/triggers",
    response_model=MaintenanceTriggerResponse,
    status_code=201,
)
async def create_trigger(
    session: DbSession, user: CurrentUser, program_id: UUID, data: MaintenanceTriggerCreate
):
    result = await program_service.create_trigger(session, user, program_id, data)
    await session.commit()
    return result


@router.patch(
    "/maintenance/pm/programs/{program_id}/triggers/{trigger_id}",
    response_model=MaintenanceTriggerResponse,
)
async def update_trigger(
    session: DbSession,
    user: CurrentUser,
    program_id: UUID,
    trigger_id: UUID,
    data: MaintenanceTriggerUpdate,
):
    result = await program_service.update_trigger(session, user, program_id, trigger_id, data)
    await session.commit()
    return result


@router.delete("/maintenance/pm/programs/{program_id}/triggers/{trigger_id}", status_code=204)
async def delete_trigger(
    session: DbSession, user: CurrentUser, program_id: UUID, trigger_id: UUID
):
    await program_service.delete_trigger(session, user, program_id, trigger_id)
    await session.commit()


# --- Task templates ---


@router.get(
    "/maintenance/pm/programs/{program_id}/tasks",
    response_model=list[MaintenanceTaskTemplateResponse],
)
async def list_task_templates(session: DbSession, user: CurrentUser, program_id: UUID):
    return await program_service.list_task_templates(session, user, program_id)


@router.post(
    "/maintenance/pm/programs/{program_id}/tasks",
    response_model=MaintenanceTaskTemplateResponse,
    status_code=201,
)
async def create_task_template(
    session: DbSession, user: CurrentUser, program_id: UUID, data: MaintenanceTaskTemplateCreate
):
    result = await program_service.create_task_template(session, user, program_id, data)
    await session.commit()
    return result


@router.patch(
    "/maintenance/pm/programs/{program_id}/tasks/{task_id}",
    response_model=MaintenanceTaskTemplateResponse,
)
async def update_task_template(
    session: DbSession,
    user: CurrentUser,
    program_id: UUID,
    task_id: UUID,
    data: MaintenanceTaskTemplateUpdate,
):
    result = await program_service.update_task_template(session, user, program_id, task_id, data)
    await session.commit()
    return result


@router.delete("/maintenance/pm/programs/{program_id}/tasks/{task_id}", status_code=204)
async def delete_task_template(
    session: DbSession, user: CurrentUser, program_id: UUID, task_id: UUID
):
    await program_service.delete_task_template(session, user, program_id, task_id)
    await session.commit()


# --- Notification rules ---


@router.get(
    "/maintenance/pm/programs/{program_id}/notifications",
    response_model=list[MaintenanceNotificationRuleResponse],
)
async def list_notification_rules(session: DbSession, user: CurrentUser, program_id: UUID):
    return await program_service.list_notification_rules(session, user, program_id)


@router.post(
    "/maintenance/pm/programs/{program_id}/notifications",
    response_model=MaintenanceNotificationRuleResponse,
    status_code=201,
)
async def create_notification_rule(
    session: DbSession,
    user: CurrentUser,
    program_id: UUID,
    data: MaintenanceNotificationRuleCreate,
):
    result = await program_service.create_notification_rule(session, user, program_id, data)
    await session.commit()
    return result


@router.patch(
    "/maintenance/pm/programs/{program_id}/notifications/{rule_id}",
    response_model=MaintenanceNotificationRuleResponse,
)
async def update_notification_rule(
    session: DbSession,
    user: CurrentUser,
    program_id: UUID,
    rule_id: UUID,
    data: MaintenanceNotificationRuleUpdate,
):
    result = await program_service.update_notification_rule(
        session, user, program_id, rule_id, data
    )
    await session.commit()
    return result


@router.delete(
    "/maintenance/pm/programs/{program_id}/notifications/{rule_id}", status_code=204
)
async def delete_notification_rule(
    session: DbSession, user: CurrentUser, program_id: UUID, rule_id: UUID
):
    await program_service.delete_notification_rule(session, user, program_id, rule_id)
    await session.commit()


# --- Work orders ---


@router.get("/maintenance/pm/work-orders", response_model=list[MaintenanceWorkOrderResponse])
async def list_work_orders(
    session: DbSession,
    user: CurrentUser,
    plant_id: UUID | None = None,
    status: str | None = None,
    asset_id: UUID | None = None,
):
    return await wo_service.list_work_orders(
        session, user, plant_id=plant_id, status=status, asset_id=asset_id
    )


@router.post("/maintenance/pm/work-orders", response_model=MaintenanceWorkOrderResponse, status_code=201)
async def create_work_order(session: DbSession, user: CurrentUser, data: MaintenanceWorkOrderCreate):
    result = await wo_service.create_work_order(session, user, data)
    await session.commit()
    return result


@router.get("/maintenance/pm/work-orders/{wo_id}", response_model=MaintenanceWorkOrderResponse)
async def get_work_order(session: DbSession, user: CurrentUser, wo_id: UUID):
    return await wo_service.get_work_order(session, user, wo_id)


@router.patch("/maintenance/pm/work-orders/{wo_id}", response_model=MaintenanceWorkOrderResponse)
async def update_work_order(
    session: DbSession, user: CurrentUser, wo_id: UUID, data: MaintenanceWorkOrderUpdate
):
    result = await wo_service.update_work_order(session, user, wo_id, data)
    await session.commit()
    return result


@router.post(
    "/maintenance/pm/programs/{program_id}/generate-work-order",
    response_model=MaintenanceWorkOrderResponse,
    status_code=201,
)
async def generate_work_order_from_program(
    session: DbSession, user: CurrentUser, program_id: UUID
):
    result = await wo_service.generate_from_program(session, user, program_id)
    await session.commit()
    return result


@router.post(
    "/maintenance/pm/work-orders/{wo_id}/transition",
    response_model=MaintenanceWorkOrderResponse,
)
async def transition_work_order(
    session: DbSession,
    user: CurrentUser,
    wo_id: UUID,
    data: MaintenanceWorkOrderTransitionCreate,
):
    result = await wo_service.transition(session, user, wo_id, data)
    await session.commit()
    return result


@router.post(
    "/maintenance/pm/work-orders/{wo_id}/tasks/{task_id}/execute",
    response_model=MaintenanceWorkOrderTaskResponse,
)
async def execute_work_order_task(
    session: DbSession,
    user: CurrentUser,
    wo_id: UUID,
    task_id: UUID,
    data: MaintenanceWorkOrderTaskExecute,
):
    result = await wo_service.execute_task(session, user, wo_id, task_id, data)
    await session.commit()
    return result


@router.post(
    "/maintenance/pm/work-orders/{wo_id}/parts",
    response_model=MaintenanceWorkOrderPartResponse,
    status_code=201,
)
async def add_work_order_part(
    session: DbSession, user: CurrentUser, wo_id: UUID, data: MaintenanceWorkOrderPartCreate
):
    result = await wo_service.add_part(session, user, wo_id, data)
    await session.commit()
    return result


@router.patch(
    "/maintenance/pm/work-orders/{wo_id}/parts/{part_id}",
    response_model=MaintenanceWorkOrderPartResponse,
)
async def update_work_order_part(
    session: DbSession,
    user: CurrentUser,
    wo_id: UUID,
    part_id: UUID,
    data: MaintenanceWorkOrderPartUpdate,
):
    result = await wo_service.update_part(session, user, wo_id, part_id, data)
    await session.commit()
    return result


@router.delete("/maintenance/pm/work-orders/{wo_id}/parts/{part_id}", status_code=204)
async def remove_work_order_part(
    session: DbSession, user: CurrentUser, wo_id: UUID, part_id: UUID
):
    await wo_service.remove_part(session, user, wo_id, part_id)
    await session.commit()


@router.post(
    "/maintenance/pm/work-orders/{wo_id}/downtime",
    response_model=MaintenanceDowntimeResponse,
    status_code=201,
)
async def add_downtime(
    session: DbSession, user: CurrentUser, wo_id: UUID, data: MaintenanceDowntimeCreate
):
    result = await wo_service.add_downtime(session, user, wo_id, data)
    await session.commit()
    return result


@router.patch(
    "/maintenance/pm/work-orders/{wo_id}/downtime/{downtime_id}",
    response_model=MaintenanceDowntimeResponse,
)
async def update_downtime(
    session: DbSession,
    user: CurrentUser,
    wo_id: UUID,
    downtime_id: UUID,
    data: MaintenanceDowntimeUpdate,
):
    result = await wo_service.update_downtime(session, user, wo_id, downtime_id, data)
    await session.commit()
    return result


# --- Analytics & evaluate ---


@router.get("/maintenance/pm/analytics", response_model=MaintenanceAnalyticsResponse)
async def pm_analytics(
    session: DbSession,
    user: CurrentUser,
    plant_id: UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
):
    return await analytics_service.get_analytics(
        session, user, plant_id=plant_id, from_date=from_date, to_date=to_date
    )


@router.post("/maintenance/pm/evaluate", response_model=PmEvaluateResponse)
async def evaluate_pm_triggers(session: DbSession, user: CurrentUser):
    result = await trigger_service.evaluate_all(session, user)
    await session.commit()
    return result
