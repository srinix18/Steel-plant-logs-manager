from __future__ import annotations

import calendar
from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AttendanceRecord,
    PayrollLineItem,
    PayrollRun,
    SalaryStructure,
    ShiftAssignment,
    User,
)
from app.models.enums import AttendanceStatus, PayrollRunStatus
from app.schemas.workforce_ops import (
    PayrollLineItemResponse,
    PayrollRunCreate,
    PayrollRunResponse,
    PayslipResponse,
    SalaryStructureCreate,
    SalaryStructureResponse,
    SalaryStructureUpdate,
)
from app.services.access_scope import is_hr, is_platform_admin

_PRESENT_STATUSES = {AttendanceStatus.PRESENT.value, AttendanceStatus.HALF_DAY.value}


class PayrollService:
    def _org_id(self, actor: User) -> UUID:
        if not actor.organisation_id:
            raise HTTPException(status_code=400, detail="User has no organisation")
        return actor.organisation_id

    def _assert_payroll_admin(self, actor: User) -> None:
        if not (is_platform_admin(actor) or is_hr(actor)):
            raise HTTPException(status_code=403, detail="Payroll access denied")

    async def list_salary_structures(
        self, session: AsyncSession, actor: User, user_id: UUID | None = None
    ) -> list[SalaryStructureResponse]:
        self._assert_payroll_admin(actor)
        query = (
            select(SalaryStructure, User.full_name)
            .join(User, SalaryStructure.user_id == User.id)
            .where(User.organisation_id == self._org_id(actor))
        )
        if user_id:
            query = query.where(SalaryStructure.user_id == user_id)
        result = await session.execute(query.order_by(SalaryStructure.effective_from.desc()))
        out: list[SalaryStructureResponse] = []
        for struct, name in result.all():
            resp = SalaryStructureResponse.model_validate(struct)
            resp.user_name = name
            out.append(resp)
        return out

    async def create_salary_structure(
        self, session: AsyncSession, actor: User, data: SalaryStructureCreate
    ) -> SalaryStructureResponse:
        self._assert_payroll_admin(actor)
        user = await session.get(User, data.user_id)
        if not user or user.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Employee not found")
        struct = SalaryStructure(**data.model_dump())
        session.add(struct)
        await session.flush()
        resp = SalaryStructureResponse.model_validate(struct)
        resp.user_name = user.full_name
        return resp

    async def update_salary_structure(
        self, session: AsyncSession, actor: User, struct_id: UUID, data: SalaryStructureUpdate
    ) -> SalaryStructureResponse:
        self._assert_payroll_admin(actor)
        struct = await session.get(SalaryStructure, struct_id)
        if not struct:
            raise HTTPException(status_code=404, detail="Salary structure not found")
        user = await session.get(User, struct.user_id)
        if not user or user.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Salary structure not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(struct, field, value)
        await session.flush()
        resp = SalaryStructureResponse.model_validate(struct)
        resp.user_name = user.full_name
        return resp

    async def list_payroll_runs(
        self, session: AsyncSession, actor: User, plant_id: UUID | None = None
    ) -> list[PayrollRunResponse]:
        self._assert_payroll_admin(actor)
        query = select(PayrollRun)
        if plant_id:
            query = query.where(PayrollRun.plant_id == plant_id)
        result = await session.execute(query.order_by(PayrollRun.year.desc(), PayrollRun.month.desc()))
        return [PayrollRunResponse.model_validate(r) for r in result.scalars()]

    async def create_payroll_run(
        self, session: AsyncSession, actor: User, data: PayrollRunCreate
    ) -> PayrollRunResponse:
        self._assert_payroll_admin(actor)
        existing = await session.execute(
            select(PayrollRun).where(
                PayrollRun.plant_id == data.plant_id,
                PayrollRun.month == data.month,
                PayrollRun.year == data.year,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Payroll run already exists for period")
        run = PayrollRun(**data.model_dump(), status=PayrollRunStatus.DRAFT.value)
        session.add(run)
        await session.flush()
        return PayrollRunResponse.model_validate(run)

    async def process_payroll_run(
        self, session: AsyncSession, actor: User, run_id: UUID
    ) -> PayrollRunResponse:
        self._assert_payroll_admin(actor)
        run = await session.get(PayrollRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Payroll run not found")
        if run.status == PayrollRunStatus.COMPLETED.value:
            raise HTTPException(status_code=400, detail="Payroll run already completed")

        run.status = PayrollRunStatus.PROCESSING.value
        await session.flush()

        days_in_month = calendar.monthrange(run.year, run.month)[1]
        period_start = date(run.year, run.month, 1)
        period_end = date(run.year, run.month, days_in_month)

        employees = await session.execute(
            select(User).where(
                User.organisation_id == self._org_id(actor),
                User.plant_id == run.plant_id,
                User.is_active.is_(True),
            )
        )
        for emp in employees.scalars():
            struct = await self._active_structure(session, emp.id, period_end)
            if not struct:
                continue

            payable_days = await self._payable_days(
                session, emp, period_start, period_end
            )
            gross = struct.basic + struct.hra + struct.allowances
            deductions = struct.pf + struct.esi + struct.other_deductions
            daily_rate = gross / days_in_month if days_in_month else 0
            earned_gross = daily_rate * payable_days
            earned_deductions = (deductions / days_in_month) * payable_days if days_in_month else 0
            net = earned_gross - earned_deductions

            payslip_data = {
                "employee_name": emp.full_name,
                "employee_uid": emp.employee_uid,
                "month": run.month,
                "year": run.year,
                "payable_days": payable_days,
                "basic": struct.basic,
                "hra": struct.hra,
                "allowances": struct.allowances,
                "gross_salary": round(earned_gross, 2),
                "pf": struct.pf,
                "esi": struct.esi,
                "other_deductions": struct.other_deductions,
                "deductions": round(earned_deductions, 2),
                "net_salary": round(net, 2),
            }

            existing = await session.execute(
                select(PayrollLineItem).where(
                    PayrollLineItem.payroll_run_id == run.id,
                    PayrollLineItem.user_id == emp.id,
                )
            )
            line = existing.scalar_one_or_none()
            if line:
                line.payable_days = payable_days
                line.gross_salary = round(earned_gross, 2)
                line.deductions = round(earned_deductions, 2)
                line.net_salary = round(net, 2)
                line.payslip_data = payslip_data
            else:
                session.add(
                    PayrollLineItem(
                        payroll_run_id=run.id,
                        user_id=emp.id,
                        payable_days=payable_days,
                        gross_salary=round(earned_gross, 2),
                        deductions=round(earned_deductions, 2),
                        net_salary=round(net, 2),
                        payslip_data=payslip_data,
                    )
                )

        run.status = PayrollRunStatus.COMPLETED.value
        run.processed_by = actor.id
        run.processed_at = datetime.now(timezone.utc)
        await session.flush()
        return PayrollRunResponse.model_validate(run)

    async def _active_structure(
        self, session: AsyncSession, user_id: UUID, on_date: date
    ) -> SalaryStructure | None:
        result = await session.execute(
            select(SalaryStructure)
            .where(
                SalaryStructure.user_id == user_id,
                SalaryStructure.effective_from <= on_date,
            )
            .order_by(SalaryStructure.effective_from.desc())
            .limit(1)
        )
        struct = result.scalar_one_or_none()
        if struct and struct.effective_to and struct.effective_to < on_date:
            return None
        return struct

    async def _payable_days(
        self, session: AsyncSession, user: User, start: date, end: date
    ) -> float:
        if not user.department_id:
            return float((end - start).days + 1)

        result = await session.execute(
            select(AttendanceRecord.status).where(
                AttendanceRecord.user_id == user.id,
                AttendanceRecord.department_id == user.department_id,
                AttendanceRecord.attendance_date >= start,
                AttendanceRecord.attendance_date <= end,
            )
        )
        statuses = list(result.scalars())
        if not statuses:
            return float((end - start).days + 1)

        total = 0.0
        for s in statuses:
            if s == AttendanceStatus.PRESENT.value:
                total += 1.0
            elif s == AttendanceStatus.HALF_DAY.value:
                total += 0.5
            elif s == AttendanceStatus.LEAVE.value:
                total += 1.0
        return total

    async def list_line_items(
        self, session: AsyncSession, actor: User, run_id: UUID
    ) -> list[PayrollLineItemResponse]:
        self._assert_payroll_admin(actor)
        result = await session.execute(
            select(PayrollLineItem, User.full_name)
            .join(User, PayrollLineItem.user_id == User.id)
            .where(PayrollLineItem.payroll_run_id == run_id)
        )
        out: list[PayrollLineItemResponse] = []
        for line, name in result.all():
            resp = PayrollLineItemResponse.model_validate(line)
            resp.user_name = name
            out.append(resp)
        return out

    async def get_payslip_html(
        self, session: AsyncSession, actor: User, line_item_id: UUID
    ) -> PayslipResponse:
        line = await session.get(PayrollLineItem, line_item_id)
        if not line:
            raise HTTPException(status_code=404, detail="Payslip not found")
        user = await session.get(User, line.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Payslip not found")
        if not (is_platform_admin(actor) or is_hr(actor) or actor.id == line.user_id):
            raise HTTPException(status_code=403, detail="Access denied")

        data = line.payslip_data or {}
        html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Payslip</title>
<style>
body {{ font-family: Arial, sans-serif; margin: 2rem; }}
h1 {{ color: #1a365d; }}
table {{ border-collapse: collapse; width: 100%; margin-top: 1rem; }}
th, td {{ border: 1px solid #ccc; padding: 8px; text-align: left; }}
th {{ background: #edf2f7; }}
</style></head><body>
<h1>Payslip — {data.get('month', '')}/{data.get('year', '')}</h1>
<p><strong>{data.get('employee_name', user.full_name)}</strong>
 ({data.get('employee_uid', user.employee_uid or 'N/A')})</p>
<p>Payable days: {data.get('payable_days', line.payable_days)}</p>
<table>
<tr><th>Earnings</th><th>Amount</th></tr>
<tr><td>Basic</td><td>{data.get('basic', 0):.2f}</td></tr>
<tr><td>HRA</td><td>{data.get('hra', 0):.2f}</td></tr>
<tr><td>Allowances</td><td>{data.get('allowances', 0):.2f}</td></tr>
<tr><th>Gross (earned)</th><th>{line.gross_salary:.2f}</th></tr>
<tr><th>Deductions</th><th>{line.deductions:.2f}</th></tr>
<tr><th>Net Salary</th><th>{line.net_salary:.2f}</th></tr>
</table>
</body></html>"""
        return PayslipResponse(line_item_id=line.id, html=html)

    async def list_my_payslips(
        self, session: AsyncSession, actor: User
    ) -> list[PayrollLineItemResponse]:
        result = await session.execute(
            select(PayrollLineItem)
            .where(PayrollLineItem.user_id == actor.id)
            .order_by(PayrollLineItem.created_at.desc())
        )
        return [PayrollLineItemResponse.model_validate(line) for line in result.scalars()]
