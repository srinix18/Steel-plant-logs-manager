"""Rolling mill delay codes, delay events, and heat lookup."""

from datetime import datetime, time, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import String, cast, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    DelayCode,
    DelayEvent,
    Department,
    Observation,
    Plant,
    Process,
    ProcessRun,
    RunFieldValue,
    User,
)
from app.models.enums import (
    DelayCodeCategory,
    DelayEventStatus,
    ObservationCategory,
    ObservationSeverity,
)
from app.schemas.moi import (
    DelayCodeCreate,
    DelayCodeResponse,
    DelayCodeUpdate,
    DelayEventResponse,
    DelayEventUpdate,
    HeatLookupResponse,
)
from app.services.access_scope import is_ceo_tier, is_platform_admin


def _category_to_observation(cat: DelayCodeCategory) -> ObservationCategory:
    if cat == DelayCodeCategory.EQUIPMENT:
        return ObservationCategory.EQUIPMENT
    return ObservationCategory.PROCESS


def _parse_time(value: str | None) -> time | None:
    if not value:
        return None
    if len(value) == 5:
        h, m = value.split(":")
        return time(int(h), int(m))
    return None


def _time_to_str(value: time | None) -> str | None:
    if not value:
        return None
    return value.strftime("%H:%M")


def _minutes_between(time_from: time | None, time_to: time | None) -> int | None:
    if not time_from or not time_to:
        return None
    from_m = time_from.hour * 60 + time_from.minute
    to_m = time_to.hour * 60 + time_to.minute
    if to_m < from_m:
        to_m += 24 * 60
    return to_m - from_m


class DelayEventService:
    async def list_delay_codes(
        self, session: AsyncSession, plant_id: UUID, *, active_only: bool = True
    ) -> list[DelayCodeResponse]:
        query = select(DelayCode).where(DelayCode.plant_id == plant_id)
        if active_only:
            query = query.where(DelayCode.is_active.is_(True))
        result = await session.execute(query.order_by(DelayCode.code))
        return [DelayCodeResponse.model_validate(c) for c in result.scalars()]

    async def create_delay_code(
        self, session: AsyncSession, user: User, data: DelayCodeCreate
    ) -> DelayCodeResponse:
        if not is_platform_admin(user) and not is_ceo_tier(user):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        existing = await session.execute(
            select(DelayCode).where(DelayCode.plant_id == data.plant_id, DelayCode.code == data.code.upper())
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Delay code already exists")
        code = DelayCode(
            plant_id=data.plant_id,
            code=data.code.upper(),
            description=data.description,
            category=data.category,
            is_active=data.is_active,
        )
        session.add(code)
        await session.flush()
        return DelayCodeResponse.model_validate(code)

    async def update_delay_code(
        self, session: AsyncSession, user: User, code_id: UUID, data: DelayCodeUpdate
    ) -> DelayCodeResponse:
        if not is_platform_admin(user) and not is_ceo_tier(user):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        code = await session.get(DelayCode, code_id)
        if not code:
            raise HTTPException(status_code=404, detail="Delay code not found")
        if data.description is not None:
            code.description = data.description
        if data.category is not None:
            code.category = data.category
        if data.is_active is not None:
            code.is_active = data.is_active
        await session.flush()
        return DelayCodeResponse.model_validate(code)

    async def list_delay_events(
        self, session: AsyncSession, *, run_id: UUID | None = None, plant_id: UUID | None = None, status: str | None = None
    ) -> list[DelayEventResponse]:
        query = select(DelayEvent).options(selectinload(DelayEvent.delay_code))
        if run_id:
            query = query.where(DelayEvent.run_id == run_id)
        if plant_id:
            query = query.where(DelayEvent.plant_id == plant_id)
        if status:
            query = query.where(DelayEvent.status == status)
        result = await session.execute(query.order_by(DelayEvent.created_at.desc()))
        return [self._to_delay_event_response(e) for e in result.scalars()]

    async def update_delay_event(
        self, session: AsyncSession, user: User, event_id: UUID, data: DelayEventUpdate
    ) -> DelayEventResponse:
        event = await session.get(DelayEvent, event_id, options=[selectinload(DelayEvent.delay_code)])
        if not event:
            raise HTTPException(status_code=404, detail="Delay event not found")
        if data.assigned_to is not None:
            event.assigned_to = data.assigned_to
            await self._ensure_observation(session, user, event)
        if data.action_taken is not None:
            event.action_taken = data.action_taken
        if data.status is not None:
            event.status = data.status
            if data.status == DelayEventStatus.CLOSED:
                event.closed_at = datetime.now(timezone.utc)
                event.closed_by = user.id
        await session.flush()
        return self._to_delay_event_response(event)

    async def sync_delay_register(
        self, session: AsyncSession, user: User, run_id: UUID, plant_id: UUID, section_data: dict
    ) -> None:
        rows = section_data.get("rows", [])
        if not isinstance(rows, list):
            return

        active_keys: set[str] = set()
        for row in rows:
            if not isinstance(row, dict):
                continue
            row_key = str(row.get("id") or row.get("row_key") or "")
            if not row_key:
                continue
            active_keys.add(row_key)

            time_from = _parse_time(row.get("time_from"))
            time_to = _parse_time(row.get("time_to"))
            time_lost = row.get("time_lost_minutes")
            if time_lost is None:
                time_lost = _minutes_between(time_from, time_to)

            delay_code_id = row.get("delay_code_id")
            if isinstance(delay_code_id, str) and delay_code_id:
                delay_code_id = UUID(delay_code_id)
            elif not delay_code_id:
                delay_code_id = None

            assigned_to = row.get("assigned_to")
            if isinstance(assigned_to, str) and assigned_to:
                assigned_to = UUID(assigned_to)
            elif not assigned_to:
                assigned_to = None

            existing = await session.execute(
                select(DelayEvent).where(DelayEvent.run_id == run_id, DelayEvent.row_key == row_key)
            )
            event = existing.scalar_one_or_none()
            if not event:
                event = DelayEvent(run_id=run_id, plant_id=plant_id, row_key=row_key)
                session.add(event)

            event.delay_code_id = delay_code_id
            event.time_from = time_from
            event.time_to = time_to
            event.time_lost_minutes = int(time_lost) if time_lost is not None else None
            event.reason = row.get("reason") or None
            event.action_taken = row.get("action_taken") or None
            event.assigned_to = assigned_to
            if row.get("status") == "closed":
                event.status = DelayEventStatus.CLOSED
            elif event.status != DelayEventStatus.CLOSED:
                event.status = DelayEventStatus.OPEN

            if assigned_to:
                await self._ensure_observation(session, user, event)

        if active_keys:
            stale = await session.execute(select(DelayEvent).where(DelayEvent.run_id == run_id))
            for event in stale.scalars():
                if event.row_key not in active_keys:
                    await session.delete(event)

        await session.flush()

    async def _ensure_observation(self, session: AsyncSession, user: User, event: DelayEvent) -> None:
        if event.observation_id or not event.assigned_to:
            return
        category = ObservationCategory.PROCESS
        if event.delay_code_id:
            code = await session.get(DelayCode, event.delay_code_id)
            if code:
                category = _category_to_observation(code.category)
        description = event.reason or "Rolling mill delay"
        if event.action_taken:
            description = f"{description}\n\nAction: {event.action_taken}"
        obs = Observation(
            plant_id=event.plant_id,
            run_id=event.run_id,
            category=category,
            description=description,
            severity=ObservationSeverity.MEDIUM,
            observed_by=user.id,
            observed_at=datetime.now(timezone.utc),
            status="open",
        )
        session.add(obs)
        await session.flush()
        event.observation_id = obs.id

    def _to_delay_event_response(self, event: DelayEvent) -> DelayEventResponse:
        return DelayEventResponse(
            id=event.id,
            run_id=event.run_id,
            plant_id=event.plant_id,
            row_key=event.row_key,
            delay_code_id=event.delay_code_id,
            time_from=_time_to_str(event.time_from),
            time_to=_time_to_str(event.time_to),
            time_lost_minutes=event.time_lost_minutes,
            reason=event.reason,
            action_taken=event.action_taken,
            assigned_to=event.assigned_to,
            status=event.status,
            observation_id=event.observation_id,
            closed_at=event.closed_at,
            closed_by=event.closed_by,
            delay_code=DelayCodeResponse.model_validate(event.delay_code) if event.delay_code else None,
        )

    async def heat_lookup(
        self, session: AsyncSession, heat_no: str, *, limit: int = 20
    ) -> list[HeatLookupResponse]:
        pattern = heat_no.strip()
        if not pattern:
            return []
        result = await session.execute(
            select(RunFieldValue, ProcessRun, Process)
            .join(ProcessRun, RunFieldValue.run_id == ProcessRun.id)
            .join(Process, ProcessRun.process_id == Process.id)
            .join(Department, Process.department_id == Department.id)
            .where(
                RunFieldValue.field_key == "heat_no",
                cast(RunFieldValue.value, String).ilike(f"%{pattern}%"),
                Department.code == "SMS",
            )
            .order_by(ProcessRun.created_at.desc())
            .limit(limit)
        )
        matches: list[HeatLookupResponse] = []
        for fv, run, proc in result.all():
            heat_val = fv.value
            if isinstance(heat_val, str):
                heat_label = heat_val.strip('"')
            else:
                heat_label = str(heat_val)
            matches.append(
                HeatLookupResponse(
                    run_id=run.id,
                    run_number=run.run_number,
                    heat_no=heat_label,
                    grade_id=run.grade_id,
                    process_code=proc.code,
                )
            )
        return matches


DEFAULT_DELAY_CODES: list[tuple[str, str, DelayCodeCategory]] = [
    ("EL", "Electrical Breakdown", DelayCodeCategory.EQUIPMENT),
    ("MC", "Mechanical Breakdown", DelayCodeCategory.EQUIPMENT),
    ("HP", "Hydraulic", DelayCodeCategory.EQUIPMENT),
    ("OP", "Pneumatic / Operation", DelayCodeCategory.EQUIPMENT),
    ("OT", "Others", DelayCodeCategory.EQUIPMENT),
    ("SC", "Section Change", DelayCodeCategory.PROCESS),
    ("AG", "Assembly", DelayCodeCategory.PROCESS),
    ("SS", "Section Setting", DelayCodeCategory.PROCESS),
    ("QC", "Quality Control", DelayCodeCategory.PROCESS),
    ("RS", "Roll Turning Shop", DelayCodeCategory.PROCESS),
    ("GS", "Guide Shop", DelayCodeCategory.PROCESS),
    ("RM", "Raw Material", DelayCodeCategory.PROCESS),
    ("PC", "Pass Change", DelayCodeCategory.PROCESS),
]


async def seed_delay_codes(session: AsyncSession, plant_id: UUID) -> None:
    for code, description, category in DEFAULT_DELAY_CODES:
        existing = await session.execute(
            select(DelayCode).where(DelayCode.plant_id == plant_id, DelayCode.code == code)
        )
        if existing.scalar_one_or_none():
            continue
        session.add(
            DelayCode(
                plant_id=plant_id,
                code=code,
                description=description,
                category=category,
                is_active=True,
            )
        )
    await session.flush()
