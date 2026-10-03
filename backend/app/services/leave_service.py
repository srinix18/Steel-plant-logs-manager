from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AttendanceRecord, LeaveRequest, LeaveType, Shift, ShiftAssignment, User
from app.models.enums import AttendanceStatus, LeaveRequestStatus
from app.schemas.workforce_ops import (
    LeaveRequestCreate,
    LeaveRequestDecision,
    LeaveRequestResponse,
    LeaveTypeCreate,
    LeaveTypeResponse,
    LeaveTypeUpdate,
)
from app.services.access_scope import (
    assert_workforce_manage,
    is_ceo_tier,
    is_hod_tier,
    is_hr,
    is_platform_admin,
)


class LeaveService:
    def _org_id(self, actor: User) -> UUID:
        if not actor.organisation_id:
            raise HTTPException(status_code=400, detail="User has no organisation")
        return actor.organisation_id

    async def list_leave_types(
        self, session: AsyncSession, actor: User
    ) -> list[LeaveTypeResponse]:
        result = await session.execute(
            select(LeaveType)
            .where(LeaveType.organisation_id == self._org_id(actor))
            .order_by(LeaveType.code)
        )
        return [LeaveTypeResponse.model_validate(lt) for lt in result.scalars()]

    async def create_leave_type(
        self, session: AsyncSession, actor: User, data: LeaveTypeCreate
    ) -> LeaveTypeResponse:
        if not (is_platform_admin(actor) or is_hr(actor)):
            raise HTTPException(status_code=403, detail="Access denied")
        existing = await session.execute(
            select(LeaveType).where(
                LeaveType.organisation_id == self._org_id(actor),
                LeaveType.code == data.code,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Leave type code exists")
        lt = LeaveType(organisation_id=self._org_id(actor), **data.model_dump())
        session.add(lt)
        await session.flush()
        return LeaveTypeResponse.model_validate(lt)

    async def update_leave_type(
        self, session: AsyncSession, actor: User, type_id: UUID, data: LeaveTypeUpdate
    ) -> LeaveTypeResponse:
        if not (is_platform_admin(actor) or is_hr(actor)):
            raise HTTPException(status_code=403, detail="Access denied")
        lt = await session.get(LeaveType, type_id)
        if not lt or lt.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Leave type not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(lt, field, value)
        await session.flush()
        return LeaveTypeResponse.model_validate(lt)

    def _leave_response(self, req: LeaveRequest, user_name: str | None = None, type_name: str | None = None) -> LeaveRequestResponse:
        resp = LeaveRequestResponse.model_validate(req)
        resp.user_name = user_name
        resp.leave_type_name = type_name
        return resp

    async def list_requests(
        self,
        session: AsyncSession,
        actor: User,
        *,
        user_id: UUID | None = None,
        status: str | None = None,
    ) -> list[LeaveRequestResponse]:
        query = (
            select(LeaveRequest, User.full_name, LeaveType.name)
            .join(User, LeaveRequest.user_id == User.id)
            .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
            .where(User.organisation_id == self._org_id(actor))
        )
        if is_platform_admin(actor) or is_hr(actor) or is_ceo_tier(actor):
            pass
        elif is_hod_tier(actor) and actor.department_id:
            query = query.where(User.department_id == actor.department_id)
        else:
            query = query.where(LeaveRequest.user_id == actor.id)
        if user_id:
            query = query.where(LeaveRequest.user_id == user_id)
        if status:
            query = query.where(LeaveRequest.status == status)
        result = await session.execute(query.order_by(LeaveRequest.created_at.desc()))
        return [
            self._leave_response(req, uname, tname)
            for req, uname, tname in result.all()
        ]

    async def create_request(
        self, session: AsyncSession, actor: User, data: LeaveRequestCreate
    ) -> LeaveRequestResponse:
        if data.to_date < data.from_date:
            raise HTTPException(status_code=400, detail="to_date must be >= from_date")
        lt = await session.get(LeaveType, data.leave_type_id)
        if not lt or lt.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Leave type not found")
        req = LeaveRequest(
            user_id=actor.id,
            leave_type_id=data.leave_type_id,
            from_date=data.from_date,
            to_date=data.to_date,
            remarks=data.remarks,
            status=LeaveRequestStatus.PENDING.value,
        )
        session.add(req)
        await session.flush()
        return self._leave_response(req, actor.full_name, lt.name)

    @staticmethod
    def _assert_can_decide(actor: User, requester: User) -> None:
        if actor.id == requester.id:
            raise HTTPException(status_code=403, detail="You cannot decide your own leave request")
        assert_workforce_manage(actor)
        if not (is_platform_admin(actor) or is_hr(actor)) and actor.department_id != requester.department_id:
            raise HTTPException(status_code=403, detail="Leave requests outside your department")

    async def approve_request(
        self, session: AsyncSession, actor: User, request_id: UUID, data: LeaveRequestDecision
    ) -> LeaveRequestResponse:
        assert_workforce_manage(actor)
        req = await session.get(LeaveRequest, request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Leave request not found")
        user = await session.get(User, req.user_id)
        if not user or user.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Leave request not found")
        self._assert_can_decide(actor, user)
        if req.status != LeaveRequestStatus.PENDING.value:
            raise HTTPException(status_code=400, detail="Request already decided")

        req.status = LeaveRequestStatus.APPROVED.value
        req.approver_id = actor.id
        req.decided_at = datetime.now(timezone.utc)
        if data.remarks:
            req.remarks = data.remarks

        await self._create_leave_attendance(session, actor, req, user)
        await session.flush()

        lt = await session.get(LeaveType, req.leave_type_id)
        return self._leave_response(req, user.full_name, lt.name if lt else None)

    async def reject_request(
        self, session: AsyncSession, actor: User, request_id: UUID, data: LeaveRequestDecision
    ) -> LeaveRequestResponse:
        assert_workforce_manage(actor)
        req = await session.get(LeaveRequest, request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Leave request not found")
        user = await session.get(User, req.user_id)
        if not user or user.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Leave request not found")
        self._assert_can_decide(actor, user)
        if req.status != LeaveRequestStatus.PENDING.value:
            raise HTTPException(status_code=400, detail="Request already decided")

        req.status = LeaveRequestStatus.REJECTED.value
        req.approver_id = actor.id
        req.decided_at = datetime.now(timezone.utc)
        if data.remarks:
            req.remarks = data.remarks
        await session.flush()
        lt = await session.get(LeaveType, req.leave_type_id)
        return self._leave_response(req, user.full_name, lt.name if lt else None)

    async def _create_leave_attendance(
        self, session: AsyncSession, actor: User, req: LeaveRequest, user: User
    ) -> None:
        if not user.department_id:
            return

        shift_id = await self._resolve_shift(session, user)
        if not shift_id:
            return

        day = req.from_date
        while day <= req.to_date:
            existing = await session.execute(
                select(AttendanceRecord).where(
                    AttendanceRecord.attendance_date == day,
                    AttendanceRecord.user_id == user.id,
                    AttendanceRecord.department_id == user.department_id,
                    AttendanceRecord.shift_id == shift_id,
                )
            )
            record = existing.scalar_one_or_none()
            if record:
                record.status = AttendanceStatus.LEAVE.value
                record.remarks = req.remarks or "Approved leave"
                record.marked_by_id = actor.id
                record.marked_at = datetime.now(timezone.utc)
            else:
                session.add(
                    AttendanceRecord(
                        attendance_date=day,
                        user_id=user.id,
                        department_id=user.department_id,
                        shift_id=shift_id,
                        status=AttendanceStatus.LEAVE.value,
                        remarks=req.remarks or "Approved leave",
                        marked_by_id=actor.id,
                    )
                )
            day += timedelta(days=1)

    async def _resolve_shift(self, session: AsyncSession, user: User) -> UUID | None:
        if not user.department_id:
            return None
        result = await session.execute(
            select(ShiftAssignment.shift_id)
            .where(
                ShiftAssignment.user_id == user.id,
                ShiftAssignment.department_id == user.department_id,
            )
            .order_by(ShiftAssignment.effective_date.desc())
            .limit(1)
        )
        shift_id = result.scalar_one_or_none()
        if shift_id:
            return shift_id
        if user.plant_id:
            shift = await session.execute(
                select(Shift).where(Shift.plant_id == user.plant_id).order_by(Shift.code).limit(1)
            )
            s = shift.scalar_one_or_none()
            return s.id if s else None
        return None
