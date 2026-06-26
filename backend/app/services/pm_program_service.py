from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    MaintenanceNotificationRule,
    MaintenanceProgram,
    MaintenanceProgramTrigger,
    MaintenanceTaskTemplate,
    User,
)
from app.models.enums import MaintenanceProgramStatus
from app.schemas.maintenance_pm import (
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
)
from app.services.access_scope import assert_pm_program_manage, can_view_pm_dashboard


class PmProgramService:
    def _org_id(self, actor: User) -> UUID:
        if not actor.organisation_id:
            raise HTTPException(status_code=400, detail="User has no organisation")
        return actor.organisation_id

    async def list_programs(
        self,
        session: AsyncSession,
        actor: User,
        *,
        plant_id: UUID | None = None,
        status: str | None = None,
    ) -> list[MaintenanceProgramResponse]:
        if not can_view_pm_dashboard(actor):
            raise HTTPException(status_code=403, detail="Access denied")
        query = select(MaintenanceProgram).where(
            MaintenanceProgram.organisation_id == self._org_id(actor)
        )
        if plant_id:
            query = query.where(MaintenanceProgram.plant_id == plant_id)
        if status:
            query = query.where(MaintenanceProgram.status == status)
        result = await session.execute(query.order_by(MaintenanceProgram.name))
        return [MaintenanceProgramResponse.model_validate(p) for p in result.scalars()]

    async def get_program(
        self, session: AsyncSession, actor: User, program_id: UUID
    ) -> MaintenanceProgramResponse:
        program = await self._get_program(session, actor, program_id)
        return MaintenanceProgramResponse.model_validate(program)

    async def _get_program(
        self, session: AsyncSession, actor: User, program_id: UUID
    ) -> MaintenanceProgram:
        program = await session.get(MaintenanceProgram, program_id)
        if not program or program.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Program not found")
        return program

    async def create_program(
        self, session: AsyncSession, actor: User, data: MaintenanceProgramCreate
    ) -> MaintenanceProgramResponse:
        assert_pm_program_manage(actor)
        payload = data.model_dump()
        payload["status"] = (
            data.status.value if hasattr(data.status, "value") else data.status
        )
        program = MaintenanceProgram(
            organisation_id=self._org_id(actor),
            **payload,
        )
        session.add(program)
        await session.flush()
        return MaintenanceProgramResponse.model_validate(program)

    async def update_program(
        self, session: AsyncSession, actor: User, program_id: UUID, data: MaintenanceProgramUpdate
    ) -> MaintenanceProgramResponse:
        assert_pm_program_manage(actor)
        program = await self._get_program(session, actor, program_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            if field == "status" and value is not None:
                value = value.value if hasattr(value, "value") else value
            setattr(program, field, value)
        await session.flush()
        return MaintenanceProgramResponse.model_validate(program)

    async def delete_program(self, session: AsyncSession, actor: User, program_id: UUID) -> None:
        assert_pm_program_manage(actor)
        program = await self._get_program(session, actor, program_id)
        program.is_active = False
        program.status = MaintenanceProgramStatus.INACTIVE.value
        await session.flush()

    # --- Triggers ---

    async def list_triggers(
        self, session: AsyncSession, actor: User, program_id: UUID
    ) -> list[MaintenanceTriggerResponse]:
        await self._get_program(session, actor, program_id)
        result = await session.execute(
            select(MaintenanceProgramTrigger).where(
                MaintenanceProgramTrigger.program_id == program_id
            )
        )
        return [MaintenanceTriggerResponse.model_validate(t) for t in result.scalars()]

    async def create_trigger(
        self, session: AsyncSession, actor: User, program_id: UUID, data: MaintenanceTriggerCreate
    ) -> MaintenanceTriggerResponse:
        assert_pm_program_manage(actor)
        await self._get_program(session, actor, program_id)
        trigger = MaintenanceProgramTrigger(
            program_id=program_id,
            trigger_type=data.trigger_type.value,
            threshold_value=data.threshold_value,
            interval_days=data.interval_days,
            is_active=data.is_active,
        )
        session.add(trigger)
        await session.flush()
        return MaintenanceTriggerResponse.model_validate(trigger)

    async def update_trigger(
        self,
        session: AsyncSession,
        actor: User,
        program_id: UUID,
        trigger_id: UUID,
        data: MaintenanceTriggerUpdate,
    ) -> MaintenanceTriggerResponse:
        assert_pm_program_manage(actor)
        trigger = await self._get_trigger(session, actor, program_id, trigger_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            if field == "trigger_type" and value is not None:
                value = value.value
            setattr(trigger, field, value)
        await session.flush()
        return MaintenanceTriggerResponse.model_validate(trigger)

    async def delete_trigger(
        self, session: AsyncSession, actor: User, program_id: UUID, trigger_id: UUID
    ) -> None:
        assert_pm_program_manage(actor)
        trigger = await self._get_trigger(session, actor, program_id, trigger_id)
        await session.delete(trigger)

    async def _get_trigger(
        self, session: AsyncSession, actor: User, program_id: UUID, trigger_id: UUID
    ) -> MaintenanceProgramTrigger:
        await self._get_program(session, actor, program_id)
        trigger = await session.get(MaintenanceProgramTrigger, trigger_id)
        if not trigger or trigger.program_id != program_id:
            raise HTTPException(status_code=404, detail="Trigger not found")
        return trigger

    # --- Task templates ---

    async def list_task_templates(
        self, session: AsyncSession, actor: User, program_id: UUID
    ) -> list[MaintenanceTaskTemplateResponse]:
        await self._get_program(session, actor, program_id)
        result = await session.execute(
            select(MaintenanceTaskTemplate)
            .where(MaintenanceTaskTemplate.program_id == program_id)
            .order_by(MaintenanceTaskTemplate.sort_order)
        )
        return [MaintenanceTaskTemplateResponse.model_validate(t) for t in result.scalars()]

    async def create_task_template(
        self, session: AsyncSession, actor: User, program_id: UUID, data: MaintenanceTaskTemplateCreate
    ) -> MaintenanceTaskTemplateResponse:
        assert_pm_program_manage(actor)
        await self._get_program(session, actor, program_id)
        task = MaintenanceTaskTemplate(program_id=program_id, **data.model_dump())
        session.add(task)
        await session.flush()
        return MaintenanceTaskTemplateResponse.model_validate(task)

    async def update_task_template(
        self,
        session: AsyncSession,
        actor: User,
        program_id: UUID,
        task_id: UUID,
        data: MaintenanceTaskTemplateUpdate,
    ) -> MaintenanceTaskTemplateResponse:
        assert_pm_program_manage(actor)
        task = await self._get_task_template(session, actor, program_id, task_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(task, field, value)
        await session.flush()
        return MaintenanceTaskTemplateResponse.model_validate(task)

    async def delete_task_template(
        self, session: AsyncSession, actor: User, program_id: UUID, task_id: UUID
    ) -> None:
        assert_pm_program_manage(actor)
        task = await self._get_task_template(session, actor, program_id, task_id)
        await session.delete(task)

    async def _get_task_template(
        self, session: AsyncSession, actor: User, program_id: UUID, task_id: UUID
    ) -> MaintenanceTaskTemplate:
        await self._get_program(session, actor, program_id)
        task = await session.get(MaintenanceTaskTemplate, task_id)
        if not task or task.program_id != program_id:
            raise HTTPException(status_code=404, detail="Task template not found")
        return task

    # --- Notification rules ---

    async def list_notification_rules(
        self, session: AsyncSession, actor: User, program_id: UUID
    ) -> list[MaintenanceNotificationRuleResponse]:
        await self._get_program(session, actor, program_id)
        result = await session.execute(
            select(MaintenanceNotificationRule).where(
                MaintenanceNotificationRule.program_id == program_id
            )
        )
        return [MaintenanceNotificationRuleResponse.model_validate(r) for r in result.scalars()]

    async def create_notification_rule(
        self,
        session: AsyncSession,
        actor: User,
        program_id: UUID,
        data: MaintenanceNotificationRuleCreate,
    ) -> MaintenanceNotificationRuleResponse:
        assert_pm_program_manage(actor)
        await self._get_program(session, actor, program_id)
        rule = MaintenanceNotificationRule(program_id=program_id, **data.model_dump())
        session.add(rule)
        await session.flush()
        return MaintenanceNotificationRuleResponse.model_validate(rule)

    async def update_notification_rule(
        self,
        session: AsyncSession,
        actor: User,
        program_id: UUID,
        rule_id: UUID,
        data: MaintenanceNotificationRuleUpdate,
    ) -> MaintenanceNotificationRuleResponse:
        assert_pm_program_manage(actor)
        rule = await self._get_notification_rule(session, actor, program_id, rule_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(rule, field, value)
        await session.flush()
        return MaintenanceNotificationRuleResponse.model_validate(rule)

    async def delete_notification_rule(
        self, session: AsyncSession, actor: User, program_id: UUID, rule_id: UUID
    ) -> None:
        assert_pm_program_manage(actor)
        rule = await self._get_notification_rule(session, actor, program_id, rule_id)
        await session.delete(rule)

    async def _get_notification_rule(
        self, session: AsyncSession, actor: User, program_id: UUID, rule_id: UUID
    ) -> MaintenanceNotificationRule:
        await self._get_program(session, actor, program_id)
        rule = await session.get(MaintenanceNotificationRule, rule_id)
        if not rule or rule.program_id != program_id:
            raise HTTPException(status_code=404, detail="Notification rule not found")
        return rule

    async def get_program_detail(
        self, session: AsyncSession, actor: User, program_id: UUID
    ) -> dict:
        result = await session.execute(
            select(MaintenanceProgram)
            .where(MaintenanceProgram.id == program_id)
            .options(
                selectinload(MaintenanceProgram.triggers),
                selectinload(MaintenanceProgram.task_templates),
                selectinload(MaintenanceProgram.notification_rules),
            )
        )
        program = result.scalar_one_or_none()
        if not program or program.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Program not found")
        return {
            "program": MaintenanceProgramResponse.model_validate(program),
            "triggers": [
                MaintenanceTriggerResponse.model_validate(t) for t in program.triggers
            ],
            "task_templates": [
                MaintenanceTaskTemplateResponse.model_validate(t)
                for t in sorted(program.task_templates, key=lambda x: x.sort_order)
            ],
            "notification_rules": [
                MaintenanceNotificationRuleResponse.model_validate(r)
                for r in program.notification_rules
            ],
        }
