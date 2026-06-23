from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.moi import CustomerResponse
from app.services.customer_service import CustomerService

router = APIRouter()
customer_service = CustomerService()


@router.get("/customers", response_model=list[CustomerResponse])
async def list_customers(
    session: DbSession,
    user: CurrentUser,
    plant_id: UUID = Query(...),
    active_only: bool = Query(default=True),
):
    return await customer_service.list_customers(session, plant_id, active_only=active_only)
