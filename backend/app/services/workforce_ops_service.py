from __future__ import annotations

from datetime import date, timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    EmployeeSkill,
    Shift,
    ShiftRoster,
    ShiftRosterEntry,
    Skill,
    TrainingRecord,
    User,
)
from app.schemas.workforce_ops import (
    EmployeeSkillAssign,
    EmployeeSkillResponse,
    ShiftRosterCreate,
    ShiftRosterEntryResponse,
    ShiftRosterResponse,
    ShiftRosterUpdate,
    SkillCreate,
    SkillResponse,
    SkillUpdate,
    TrainingRecordCreate,
    TrainingRecordResponse,
    TrainingRecordUpdate,
)
from app.services.access_scope import assert_workforce_ops, assert_workforce_manage, is_hr, is_platform_admin
from app.services.notification_service import notify_training_expiry


class WorkforceOpsService:
    def _org_id(self, actor: User) -> UUID:
        if not actor.organisation_id:
            raise HTTPException(status_code=400, detail="User has no organisation")
        return actor.organisation_id

    # --- Roster ---

    async def list_rosters(
        self,
        session: AsyncSession,
        actor: User,
        department_id: UUID | None = None,
    ) -> list[ShiftRosterResponse]:
        query = select(ShiftRoster)
        if department_id:
            query = query.where(ShiftRoster.department_id == department_id)
        result = await session.execute(query.order_by(ShiftRoster.period_start.desc()))
        rosters = list(result.scalars())
        out: list[ShiftRosterResponse] = []
        for roster in rosters:
            entries = await self._roster_entries(session, roster.id)
            resp = ShiftRosterResponse.model_validate(roster)
            resp.entries = entries
            out.append(resp)
        return out

    async def _roster_entries(
        self, session: AsyncSession, roster_id: UUID
    ) -> list[ShiftRosterEntryResponse]:
        result = await session.execute(
            select(ShiftRosterEntry, User.full_name, Shift.code)
            .join(User, ShiftRosterEntry.user_id == User.id)
            .join(Shift, ShiftRosterEntry.shift_id == Shift.id)
            .where(ShiftRosterEntry.roster_id == roster_id)
            .order_by(ShiftRosterEntry.roster_date, User.full_name)
        )
        out: list[ShiftRosterEntryResponse] = []
        for entry, uname, scode in result.all():
            resp = ShiftRosterEntryResponse.model_validate(entry)
            resp.user_name = uname
            resp.shift_code = scode
            out.append(resp)
        return out

    async def create_roster(
        self, session: AsyncSession, actor: User, data: ShiftRosterCreate
    ) -> ShiftRosterResponse:
        assert_workforce_ops(actor, data.department_id)
        roster = ShiftRoster(
            department_id=data.department_id,
            period_start=data.period_start,
            period_end=data.period_end,
            period_type=data.period_type.value,
            status="draft",
            created_by=actor.id,
        )
        session.add(roster)
        await session.flush()

        for entry in data.entries:
            session.add(
                ShiftRosterEntry(
                    roster_id=roster.id,
                    user_id=entry.user_id,
                    shift_id=entry.shift_id,
                    roster_date=entry.roster_date,
                )
            )
        await session.flush()
        resp = ShiftRosterResponse.model_validate(roster)
        resp.entries = await self._roster_entries(session, roster.id)
        return resp

    async def update_roster(
        self, session: AsyncSession, actor: User, roster_id: UUID, data: ShiftRosterUpdate
    ) -> ShiftRosterResponse:
        roster = await session.get(ShiftRoster, roster_id)
        if not roster:
            raise HTTPException(status_code=404, detail="Roster not found")
        assert_workforce_ops(actor, roster.department_id)
        entries_data = data.entries
        payload = data.model_dump(exclude_unset=True, exclude={"entries"})
        for field, value in payload.items():
            setattr(roster, field, value)
        if entries_data is not None:
            existing = await session.execute(
                select(ShiftRosterEntry).where(ShiftRosterEntry.roster_id == roster.id)
            )
            for row in existing.scalars():
                await session.delete(row)
            await session.flush()
            for entry in entries_data:
                session.add(
                    ShiftRosterEntry(
                        roster_id=roster.id,
                        user_id=entry.user_id,
                        shift_id=entry.shift_id,
                        roster_date=entry.roster_date,
                    )
                )
        await session.flush()
        resp = ShiftRosterResponse.model_validate(roster)
        resp.entries = await self._roster_entries(session, roster.id)
        return resp

    async def publish_roster(
        self, session: AsyncSession, actor: User, roster_id: UUID
    ) -> ShiftRosterResponse:
        roster = await session.get(ShiftRoster, roster_id)
        if not roster:
            raise HTTPException(status_code=404, detail="Roster not found")
        assert_workforce_manage(actor, roster.department_id)
        roster.status = "published"
        await session.flush()
        resp = ShiftRosterResponse.model_validate(roster)
        resp.entries = await self._roster_entries(session, roster.id)
        return resp

    # --- Skills ---

    async def list_skills(
        self, session: AsyncSession, actor: User, department_id: UUID | None = None
    ) -> list[SkillResponse]:
        query = select(Skill).where(Skill.organisation_id == self._org_id(actor))
        if department_id:
            query = query.where(Skill.department_id == department_id)
        result = await session.execute(query.order_by(Skill.code))
        return [SkillResponse.model_validate(s) for s in result.scalars()]

    async def create_skill(
        self, session: AsyncSession, actor: User, data: SkillCreate
    ) -> SkillResponse:
        assert_workforce_manage(actor, data.department_id)
        existing = await session.execute(
            select(Skill).where(
                Skill.organisation_id == self._org_id(actor),
                Skill.code == data.code,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Skill code exists")
        skill = Skill(organisation_id=self._org_id(actor), **data.model_dump())
        session.add(skill)
        await session.flush()
        return SkillResponse.model_validate(skill)

    async def update_skill(
        self, session: AsyncSession, actor: User, skill_id: UUID, data: SkillUpdate
    ) -> SkillResponse:
        skill = await session.get(Skill, skill_id)
        if not skill or skill.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Skill not found")
        assert_workforce_manage(actor, skill.department_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(skill, field, value)
        await session.flush()
        return SkillResponse.model_validate(skill)

    async def list_employee_skills(
        self, session: AsyncSession, actor: User, user_id: UUID
    ) -> list[EmployeeSkillResponse]:
        result = await session.execute(
            select(EmployeeSkill, Skill.name, Skill.code)
            .join(Skill, EmployeeSkill.skill_id == Skill.id)
            .where(EmployeeSkill.user_id == user_id)
        )
        out: list[EmployeeSkillResponse] = []
        for es, sname, scode in result.all():
            resp = EmployeeSkillResponse.model_validate(es)
            resp.skill_name = sname
            resp.skill_code = scode
            out.append(resp)
        return out

    async def assign_skill(
        self, session: AsyncSession, actor: User, user_id: UUID, data: EmployeeSkillAssign
    ) -> EmployeeSkillResponse:
        user = await session.get(User, user_id)
        if not user or user.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Employee not found")
        assert_workforce_manage(actor, user.department_id)
        skill = await session.get(Skill, data.skill_id)
        if not skill or skill.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Skill not found")

        existing = await session.execute(
            select(EmployeeSkill).where(
                EmployeeSkill.user_id == user_id,
                EmployeeSkill.skill_id == data.skill_id,
            )
        )
        es = existing.scalar_one_or_none()
        if es:
            es.proficiency_level = data.proficiency_level
        else:
            es = EmployeeSkill(
                user_id=user_id,
                skill_id=data.skill_id,
                proficiency_level=data.proficiency_level,
            )
            session.add(es)
        await session.flush()
        resp = EmployeeSkillResponse.model_validate(es)
        resp.skill_name = skill.name
        resp.skill_code = skill.code
        return resp

    async def remove_skill(
        self, session: AsyncSession, actor: User, user_id: UUID, skill_id: UUID
    ) -> None:
        result = await session.execute(
            select(EmployeeSkill).where(
                EmployeeSkill.user_id == user_id,
                EmployeeSkill.skill_id == skill_id,
            )
        )
        es = result.scalar_one_or_none()
        if es:
            await session.delete(es)

    # --- Training ---

    async def list_training_records(
        self,
        session: AsyncSession,
        actor: User,
        user_id: UUID | None = None,
    ) -> list[TrainingRecordResponse]:
        query = select(TrainingRecord, User.full_name).join(
            User, TrainingRecord.user_id == User.id
        ).where(User.organisation_id == self._org_id(actor))
        if user_id:
            query = query.where(TrainingRecord.user_id == user_id)
        elif not (is_platform_admin(actor) or is_hr(actor)):
            query = query.where(TrainingRecord.user_id == actor.id)
        result = await session.execute(query.order_by(TrainingRecord.expiry_date.nulls_last()))
        return [
            self._training_response(tr, uname)
            for tr, uname in result.all()
        ]

    def _training_response(self, tr: TrainingRecord, user_name: str | None = None) -> TrainingRecordResponse:
        resp = TrainingRecordResponse.model_validate(tr)
        resp.user_name = user_name
        return resp

    async def create_training_record(
        self, session: AsyncSession, actor: User, data: TrainingRecordCreate
    ) -> TrainingRecordResponse:
        user = await session.get(User, data.user_id)
        if not user or user.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Employee not found")
        assert_workforce_manage(actor, user.department_id)
        record = TrainingRecord(**data.model_dump())
        session.add(record)
        await session.flush()
        return self._training_response(record, user.full_name)

    async def update_training_record(
        self, session: AsyncSession, actor: User, record_id: UUID, data: TrainingRecordUpdate
    ) -> TrainingRecordResponse:
        record = await session.get(TrainingRecord, record_id)
        if not record:
            raise HTTPException(status_code=404, detail="Training record not found")
        user = await session.get(User, record.user_id)
        if not user or user.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Training record not found")
        assert_workforce_manage(actor, user.department_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(record, field, value)
        await session.flush()
        return self._training_response(record, user.full_name)

    async def check_training_expiry(
        self, session: AsyncSession, days_ahead: int = 30
    ) -> int:
        threshold = date.today() + timedelta(days=days_ahead)
        result = await session.execute(
            select(TrainingRecord, User)
            .join(User, TrainingRecord.user_id == User.id)
            .where(
                TrainingRecord.expiry_date.isnot(None),
                TrainingRecord.expiry_date <= threshold,
                TrainingRecord.status == "active",
            )
        )
        notified = 0
        for record, user in result.all():
            await notify_training_expiry(session, user.id, record.id, record.name)
            notified += 1
        await session.flush()
        return notified

    async def list_all_employee_skills(
        self, session: AsyncSession, actor: User
    ) -> list[EmployeeSkillResponse]:
        if not (is_platform_admin(actor) or is_hr(actor)):
            raise HTTPException(status_code=403, detail="Access denied")
        result = await session.execute(
            select(EmployeeSkill, Skill.name, Skill.code)
            .join(Skill, EmployeeSkill.skill_id == Skill.id)
            .join(User, EmployeeSkill.user_id == User.id)
            .where(Skill.organisation_id == self._org_id(actor))
            .order_by(User.full_name, Skill.code)
        )
        out: list[EmployeeSkillResponse] = []
        for es, sname, scode in result.all():
            resp = EmployeeSkillResponse.model_validate(es)
            resp.skill_name = sname
            resp.skill_code = scode
            out.append(resp)
        return out

    async def get_ops_summary(self, session: AsyncSession, actor: User) -> dict[str, Any]:
        from app.db.models import LeaveRequest, PayrollLineItem, PayrollRun
        from app.models.enums import LeaveRequestStatus, PayrollRunStatus

        org_id = self._org_id(actor)
        pending_leave = await session.execute(
            select(func.count())
            .select_from(LeaveRequest)
            .join(User, LeaveRequest.user_id == User.id)
            .where(
                User.organisation_id == org_id,
                LeaveRequest.status == LeaveRequestStatus.PENDING.value,
            )
        )
        threshold = date.today() + timedelta(days=30)
        expiring = await session.execute(
            select(func.count())
            .select_from(TrainingRecord)
            .join(User, TrainingRecord.user_id == User.id)
            .where(
                User.organisation_id == org_id,
                TrainingRecord.expiry_date.isnot(None),
                TrainingRecord.expiry_date <= threshold,
                TrainingRecord.status == "active",
            )
        )
        run_query = select(PayrollRun).order_by(PayrollRun.year.desc(), PayrollRun.month.desc()).limit(1)
        if actor.plant_id:
            run_query = run_query.where(PayrollRun.plant_id == actor.plant_id)
        latest_run = await session.execute(run_query)
        run = latest_run.scalar_one_or_none()
        total_net = None
        if run and run.status == PayrollRunStatus.COMPLETED.value:
            net_result = await session.execute(
                select(func.coalesce(func.sum(PayrollLineItem.net_salary), 0)).where(
                    PayrollLineItem.payroll_run_id == run.id
                )
            )
            total_net = float(net_result.scalar() or 0)

        return {
            "pending_leave_requests": int(pending_leave.scalar() or 0),
            "certifications_expiring_soon": int(expiring.scalar() or 0),
            "latest_payroll_status": run.status if run else None,
            "latest_payroll_month": run.month if run else None,
            "latest_payroll_year": run.year if run else None,
            "total_payroll_net": total_net,
        }
