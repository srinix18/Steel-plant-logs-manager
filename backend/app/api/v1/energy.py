from uuid import UUID

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.pulse import EnergyDashboardResponse
from app.services.energy_service import EnergyService

router = APIRouter()
energy_service = EnergyService()


@router.get("/energy/plant/{plant_id}", response_model=EnergyDashboardResponse)
async def energy_plant(plant_id: UUID, session: DbSession, user: CurrentUser):
    data = await energy_service.plant_dashboard(session, plant_id)
    return EnergyDashboardResponse(**data)


@router.get("/energy/departments/{plant_id}")
async def energy_departments(plant_id: UUID, session: DbSession, user: CurrentUser):
    data = await energy_service.plant_dashboard(session, plant_id)
    return data["departments"]


@router.get("/energy/assets/{plant_id}")
async def energy_assets(plant_id: UUID, session: DbSession, user: CurrentUser):
    data = await energy_service.plant_dashboard(session, plant_id)
    return data["assets"]


@router.get("/energy/history/{plant_id}")
async def energy_history(plant_id: UUID, session: DbSession, user: CurrentUser):
    data = await energy_service.plant_dashboard(session, plant_id)
    return data["history"]
