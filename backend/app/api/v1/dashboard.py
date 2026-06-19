from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.schemas import DashboardMetrics
from app.services import DashboardService

router = APIRouter()
dashboard_service = DashboardService()


@router.get("", response_model=DashboardMetrics)
async def get_dashboard(current_user: CurrentUser):
    return await dashboard_service.get_metrics(current_user)
