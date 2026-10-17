from uuid import UUID

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.pulse import InventoryAdjustRequest, InventoryItemResponse, InventoryReceiveRequest
from app.services.access_scope import assert_inventory_adjust, assert_inventory_view
from app.services.inventory_pulse_service import InventoryPulseService

router = APIRouter()
inventory_service = InventoryPulseService()


@router.get("/inventory-pulse/{plant_id}", response_model=list[InventoryItemResponse])
async def inventory_pulse(plant_id: UUID, session: DbSession, user: CurrentUser):
    await assert_inventory_view(session, user, plant_id)
    rows = await inventory_service.list_snapshots(session, plant_id)
    return [
        InventoryItemResponse(
            material_code=r.material_code,
            material_name=r.material_name,
            quantity=r.quantity,
            unit=r.unit,
            quality_grade=r.quality_grade,
            location=r.location,
            avg_daily_consumption=r.avg_daily_consumption,
            days_remaining=r.days_remaining,
            current_value=r.current_value,
            supplier=r.supplier,
            low_stock_threshold=r.low_stock_threshold,
            status=r.status,
            last_updated=r.snapshot_at,
        )
        for r in rows
    ]


@router.post("/inventory-pulse/{plant_id}/adjust")
async def adjust_inventory(
    plant_id: UUID, data: InventoryAdjustRequest, session: DbSession, user: CurrentUser
):
    await assert_inventory_adjust(session, user, plant_id)
    snap = await inventory_service.adjust(
        session,
        plant_id,
        data.material_code,
        data.quantity,
        quality_grade=data.quality_grade,
        location=data.location,
        user_id=user.id,
    )
    await session.commit()
    return {"material_code": snap.material_code, "quantity": snap.quantity, "status": snap.status}


@router.post("/inventory-pulse/{plant_id}/receive")
async def receive_inventory(
    plant_id: UUID, data: InventoryReceiveRequest, session: DbSession, user: CurrentUser
):
    """Goods received: adds to the stock."""
    await assert_inventory_adjust(session, user, plant_id)
    try:
        snap = await inventory_service.receive(
            session, plant_id, data.material_code, data.quantity, supplier=data.supplier, note=data.note, user_id=user.id
        )
    except ValueError as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail=str(exc))
    await session.commit()
    return {"material_code": snap.material_code, "quantity": snap.quantity, "status": snap.status}
