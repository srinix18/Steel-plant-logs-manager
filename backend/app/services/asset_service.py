from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Asset, AssetGroup, AssetResponsibility, OperationalEvent, User
from app.models.enums import EventSeverity, EventSource
from app.schemas.foundation import (
    AssetAdminCreate,
    AssetAdminResponse,
    AssetAdminUpdate,
    AssetEventCreate,
    AssetEventResponse,
    AssetGroupCreate,
    AssetGroupResponse,
    AssetResponsibilityCreate,
    AssetResponsibilityResponse,
)


def _compute_remaining(expected: dict[str, Any], current: dict[str, Any]) -> dict[str, Any] | None:
    if not expected:
        return None
    unit = expected.get("unit")
    value = expected.get("value")
    if unit is None or value is None:
        return None
    used = current.get(unit, 0)
    try:
        remaining = float(value) - float(used)
    except (TypeError, ValueError):
        return None
    return {"unit": unit, "value": max(0, remaining)}


def _asset_response(asset: Asset, group: AssetGroup | None = None) -> AssetAdminResponse:
    grp = group or asset.group
    return AssetAdminResponse(
        id=asset.id,
        group_id=asset.group_id,
        plant_id=asset.plant_id,
        department_id=asset.department_id,
        asset_no=asset.asset_no,
        name=asset.name,
        status=asset.status.value if hasattr(asset.status, "value") else str(asset.status),
        life_counters=asset.life_counters or {},
        expected_life=asset.expected_life or {},
        remaining_life=_compute_remaining(asset.expected_life or {}, asset.life_counters or {}),
        installation_date=asset.installation_date,
        remarks=asset.remarks,
        last_inspection_at=asset.last_inspection_at,
        plc_tag_prefix=asset.plc_tag_prefix,
        group_code=grp.code if grp else None,
        group_name=grp.name if grp else None,
    )


class AssetService:
    async def list_groups(
        self, session: AsyncSession, plant_id: UUID | None = None
    ) -> list[AssetGroupResponse]:
        query = select(AssetGroup).order_by(AssetGroup.code)
        if plant_id:
            query = query.where(AssetGroup.plant_id == plant_id)
        result = await session.execute(query)
        return [AssetGroupResponse.model_validate(g) for g in result.scalars()]

    async def create_group(
        self, session: AsyncSession, data: AssetGroupCreate
    ) -> AssetGroupResponse:
        group = AssetGroup(plant_id=data.plant_id, code=data.code, name=data.name)
        session.add(group)
        await session.flush()
        return AssetGroupResponse.model_validate(group)

    async def list_assets(
        self,
        session: AsyncSession,
        plant_id: UUID | None = None,
        group_id: UUID | None = None,
        department_id: UUID | None = None,
        status: str | None = None,
    ) -> list[AssetAdminResponse]:
        query = select(Asset).options(selectinload(Asset.group))
        if plant_id:
            query = query.where(Asset.plant_id == plant_id)
        if group_id:
            query = query.where(Asset.group_id == group_id)
        if department_id:
            query = query.where(Asset.department_id == department_id)
        if status:
            query = query.where(Asset.status == status)
        result = await session.execute(query.order_by(Asset.asset_no))
        return [_asset_response(a) for a in result.scalars()]

    async def get_asset(self, session: AsyncSession, asset_id: UUID) -> AssetAdminResponse:
        result = await session.execute(
            select(Asset).options(selectinload(Asset.group)).where(Asset.id == asset_id)
        )
        asset = result.scalar_one_or_none()
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        return _asset_response(asset)

    async def create_asset(self, session: AsyncSession, data: AssetAdminCreate) -> AssetAdminResponse:
        asset = Asset(
            plant_id=data.plant_id,
            group_id=data.group_id,
            asset_no=data.asset_no,
            name=data.name,
            department_id=data.department_id,
            status=data.status,
            installation_date=data.installation_date,
            remarks=data.remarks,
            life_counters=data.life_counters,
            expected_life=data.expected_life,
            last_inspection_at=data.last_inspection_at,
            plc_tag_prefix=data.plc_tag_prefix,
        )
        session.add(asset)
        await session.flush()
        await session.refresh(asset, ["group"])
        return _asset_response(asset)

    async def update_asset(
        self, session: AsyncSession, asset_id: UUID, data: AssetAdminUpdate
    ) -> AssetAdminResponse:
        result = await session.execute(
            select(Asset).options(selectinload(Asset.group)).where(Asset.id == asset_id)
        )
        asset = result.scalar_one_or_none()
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        for field in (
            "name",
            "group_id",
            "department_id",
            "status",
            "installation_date",
            "remarks",
            "life_counters",
            "expected_life",
            "last_inspection_at",
            "plc_tag_prefix",
        ):
            val = getattr(data, field)
            if val is not None:
                setattr(asset, field, val)
        await session.flush()
        return _asset_response(asset)

    async def list_events(
        self, session: AsyncSession, asset_id: UUID
    ) -> list[AssetEventResponse]:
        result = await session.execute(
            select(OperationalEvent)
            .where(OperationalEvent.asset_id == asset_id)
            .order_by(OperationalEvent.occurred_at.desc())
        )
        return [AssetEventResponse.model_validate(e) for e in result.scalars()]

    async def create_manual_event(
        self, session: AsyncSession, asset_id: UUID, data: AssetEventCreate
    ) -> AssetEventResponse:
        asset = await session.get(Asset, asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        event = OperationalEvent(
            plant_id=asset.plant_id,
            asset_id=asset_id,
            event_type=data.event_type.value,
            severity=EventSeverity.INFO,
            occurred_at=data.occurred_at,
            source=EventSource.MANUAL,
            payload=data.payload,
            processed=True,
        )
        session.add(event)
        await session.flush()
        return AssetEventResponse.model_validate(event)

    async def list_responsibilities(
        self, session: AsyncSession, asset_id: UUID
    ) -> list[AssetResponsibilityResponse]:
        result = await session.execute(
            select(AssetResponsibility, User.full_name)
            .join(User, AssetResponsibility.user_id == User.id)
            .where(AssetResponsibility.asset_id == asset_id)
        )
        rows = []
        for resp, user_name in result.all():
            item = AssetResponsibilityResponse.model_validate(resp)
            item.user_name = user_name
            rows.append(item)
        return rows

    async def add_responsibility(
        self, session: AsyncSession, asset_id: UUID, data: AssetResponsibilityCreate
    ) -> AssetResponsibilityResponse:
        if not await session.get(Asset, asset_id):
            raise HTTPException(status_code=404, detail="Asset not found")
        resp = AssetResponsibility(
            asset_id=asset_id,
            user_id=data.user_id,
            role_label=data.role_label,
            is_primary=data.is_primary,
        )
        session.add(resp)
        await session.flush()
        user = await session.get(User, data.user_id)
        item = AssetResponsibilityResponse.model_validate(resp)
        item.user_name = user.full_name if user else None
        return item

    async def remove_responsibility(self, session: AsyncSession, resp_id: UUID) -> None:
        resp = await session.get(AssetResponsibility, resp_id)
        if not resp:
            raise HTTPException(status_code=404, detail="Responsibility not found")
        await session.delete(resp)
