from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Asset,
    MaintenanceNotificationRule,
    MaintenanceProgram,
    MaintenanceProgramTrigger,
    User,
)
from app.models.enums import MaintenanceProgramStatus, MaintenanceTriggerType
from app.schemas.maintenance_pm import PmEvaluateResponse
from app.services.notification_service import notify_pm_event
from app.services.pm_work_order_service import PmWorkOrderService

_METER_KEYS = {
    MaintenanceTriggerType.RUNTIME_HOURS.value: "runtime_hours",
    MaintenanceTriggerType.HEAT_COUNT.value: "heat_count",
    MaintenanceTriggerType.PRODUCTION_COUNT.value: "production_count",
    MaintenanceTriggerType.TONNAGE.value: "tonnage",
}


class PmTriggerService:
    def __init__(self) -> None:
        self._wo_service = PmWorkOrderService()

    async def evaluate_all(
        self, session: AsyncSession, actor: User | None = None
    ) -> PmEvaluateResponse:
        result = await session.execute(
            select(MaintenanceProgram)
            .where(
                MaintenanceProgram.is_active.is_(True),
                MaintenanceProgram.status == MaintenanceProgramStatus.ACTIVE.value,
            )
            .options(
                selectinload(MaintenanceProgram.triggers),
                selectinload(MaintenanceProgram.notification_rules),
            )
        )
        programs = list(result.scalars())

        triggers_evaluated = notifications_sent = work_orders_generated = 0
        now = datetime.now(timezone.utc)

        for program in programs:
            asset = None
            if program.asset_id:
                asset = await session.get(Asset, program.asset_id)

            for trigger in program.triggers:
                if not trigger.is_active:
                    continue
                triggers_evaluated += 1
                fired = await self._evaluate_trigger(session, trigger, asset, now)
                if not fired:
                    continue

                trigger.last_fired_at = now
                if trigger.trigger_type == MaintenanceTriggerType.TIME.value and trigger.interval_days:
                    trigger.next_due_at = now + timedelta(days=trigger.interval_days)

                notifications_sent += await self._fire_notifications(
                    session, program, trigger
                )

                if program.auto_generate_work_orders and actor:
                    await self._wo_service.generate_from_program(session, actor, program.id)
                    work_orders_generated += 1
                elif program.auto_generate_work_orders:
                    system_user = await self._system_actor(session, program.organisation_id)
                    if system_user:
                        await self._wo_service.generate_from_program(
                            session, system_user, program.id
                        )
                        work_orders_generated += 1

        await session.flush()
        return PmEvaluateResponse(
            triggers_evaluated=triggers_evaluated,
            notifications_sent=notifications_sent,
            work_orders_generated=work_orders_generated,
        )

    async def _system_actor(
        self, session: AsyncSession, organisation_id: UUID
    ) -> User | None:
        result = await session.execute(
            select(User)
            .where(User.organisation_id == organisation_id, User.is_active.is_(True))
            .order_by(User.created_at)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _evaluate_trigger(
        self,
        session: AsyncSession,
        trigger: MaintenanceProgramTrigger,
        asset: Asset | None,
        now: datetime,
    ) -> bool:
        ttype = trigger.trigger_type

        if ttype == MaintenanceTriggerType.TIME.value:
            if trigger.next_due_at and now >= trigger.next_due_at:
                return True
            if trigger.interval_days and trigger.last_fired_at:
                due = trigger.last_fired_at + timedelta(days=trigger.interval_days)
                return now >= due
            if trigger.interval_days and not trigger.last_fired_at:
                trigger.next_due_at = now
                return True
            return False

        if ttype == MaintenanceTriggerType.MANUAL.value:
            return False

        if not asset or trigger.threshold_value is None:
            return False

        meter_key = _METER_KEYS.get(ttype)
        if not meter_key:
            return False

        counters = asset.life_counters or {}
        current = float(counters.get(meter_key, 0))
        baseline = float((trigger.last_fired_at and counters.get(f"{meter_key}_baseline", 0)) or 0)
        if trigger.last_fired_at is None:
            counters[f"{meter_key}_baseline"] = current
            asset.life_counters = counters
            return False

        delta = current - baseline
        if delta >= trigger.threshold_value:
            counters[f"{meter_key}_baseline"] = current
            asset.life_counters = counters
            return True
        return False

    async def _fire_notifications(
        self,
        session: AsyncSession,
        program: MaintenanceProgram,
        trigger: MaintenanceProgramTrigger,
    ) -> int:
        sent = 0
        for rule in program.notification_rules:
            if not rule.is_active:
                continue
            count = await notify_pm_event(
                session,
                program_id=program.id,
                program_name=program.name,
                recipient_role=rule.recipient_role,
                organisation_id=program.organisation_id,
                plant_id=program.plant_id,
                channel=rule.channel,
                trigger_type=trigger.trigger_type,
            )
            sent += count
        return sent
