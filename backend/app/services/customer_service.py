"""Bright Bar customer master — list for production register picker."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Customer
from app.schemas.moi import CustomerResponse


class CustomerService:
    async def list_customers(
        self, session: AsyncSession, plant_id: UUID, *, active_only: bool = True
    ) -> list[CustomerResponse]:
        query = select(Customer).where(Customer.plant_id == plant_id)
        if active_only:
            query = query.where(Customer.is_active.is_(True))
        result = await session.execute(query.order_by(Customer.name))
        return [CustomerResponse.model_validate(c) for c in result.scalars()]
