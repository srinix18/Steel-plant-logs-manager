from uuid import UUID

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.moi import AssetHealthResponse, DashboardMetrics, KPIDefinitionResponse, ShiftKPIResponse
from app.services.operations_service import AnalyticsService

router = APIRouter()
analytics = AnalyticsService()


@router.get("/dashboard", response_model=DashboardMetrics)
async def dashboard(session: DbSession, user: CurrentUser):
    data = await analytics.dashboard_metrics(session, user)
    return DashboardMetrics(**data)


@router.get("/kpis/definitions", response_model=list[KPIDefinitionResponse])
async def kpi_definitions(session: DbSession, _: CurrentUser):
    return await analytics.list_kpi_definitions(session)


@router.get("/analytics/shifts/{shift_id}")
async def shift_kpis(shift_id: UUID, session: DbSession, _: CurrentUser):
    from sqlalchemy import select

    from app.db.models import AggShiftKPI

    result = await session.execute(select(AggShiftKPI).where(AggShiftKPI.shift_id == shift_id))
    rows = result.scalars().all()
    return [ShiftKPIResponse.model_validate(r) for r in rows]


@router.get("/assets/{asset_id}/health", response_model=AssetHealthResponse)
async def asset_health(asset_id: UUID, session: DbSession, _: CurrentUser):
    from sqlalchemy import func, select

    from app.db.models import Asset, CorrectiveAction, Observation, OperationalEvent

    asset = await session.get(Asset, asset_id)
    if not asset:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Asset not found")
    events = await session.execute(
        select(func.count()).select_from(OperationalEvent).where(OperationalEvent.asset_id == asset_id)
    )
    actions = await session.execute(
        select(func.count())
        .select_from(CorrectiveAction)
        .join(Observation)
        .where(Observation.asset_id == asset_id)
    )
    return AssetHealthResponse(
        asset_id=asset_id,
        asset_name=asset.name,
        event_count=events.scalar() or 0,
        open_actions=actions.scalar() or 0,
    )
