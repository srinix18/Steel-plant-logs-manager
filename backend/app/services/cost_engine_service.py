"""Operational cost engine — reads Process Runs, writes Finance tables only."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Asset,
    AttendanceRecord,
    CostCalculation,
    CostLineItem,
    CostMappingRule,
    Department,
    FuelCostRate,
    LabourCostRate,
    MaintenanceCostRate,
    MaintenanceIssue,
    MaterialCatalog,
    Plant,
    PowerCostRate,
    Process,
    ProcessRun,
    RawMaterialCostRate,
    RunFieldValue,
    RunSectionData,
    Shift,
    Template,
    TemplateField,
    TemplateSection,
    TemplateVersion,
    User,
)
from app.models.enums import AttendanceStatus, CostCalculationStatus, CostCategory, CostMappingSourceType
from app.services.access_scope import assert_finance_access


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def _section_rows(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [r for r in data if isinstance(r, dict)]
    if isinstance(data, dict) and isinstance(data.get("rows"), list):
        return [r for r in data["rows"] if isinstance(r, dict)]
    return []


def _run_date(run: ProcessRun) -> date:
    if run.completed_at:
        return run.completed_at.date()
    if run.started_at:
        return run.started_at.date()
    return run.created_at.date() if run.created_at else date.today()


class CostEngineService:
    async def compute_for_run(
        self, session: AsyncSession, run_id: UUID, user: User | None = None
    ) -> CostCalculation:
        if user:
            assert_finance_access(user)

        run = await session.get(ProcessRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Process run not found")

        field_map: dict[str, Any] = {}
        result = await session.execute(select(RunFieldValue).where(RunFieldValue.run_id == run_id))
        for fv in result.scalars():
            field_map[fv.field_key] = fv.value

        section_map: dict[str, Any] = {}
        result = await session.execute(select(RunSectionData).where(RunSectionData.run_id == run_id))
        for sd in result.scalars():
            section_map[sd.section_key] = sd.data

        rules_result = await session.execute(
            select(CostMappingRule)
            .where(
                CostMappingRule.template_version_id == run.template_version_id,
                CostMappingRule.is_active.is_(True),
            )
            .order_by(CostMappingRule.sort_order, CostMappingRule.source_key)
        )
        rules = list(rules_result.scalars())

        process = await session.get(Process, run.process_id)
        dept = await session.get(Department, process.department_id) if process else None
        plant_id = dept.plant_id if dept else None
        run_dt = _run_date(run)

        context = {
            "plant_id": str(plant_id) if plant_id else None,
            "department_id": str(process.department_id) if process else None,
            "process_id": str(run.process_id),
            "asset_id": str(run.primary_asset_id) if run.primary_asset_id else None,
            "run_date": run_dt.isoformat(),
            "mapping_count": len(rules),
        }

        line_items_data: list[dict[str, Any]] = []
        warnings: list[str] = []

        if not rules:
            warnings.append("No active cost mapping rules for this template version")

        for rule in rules:
            items = await self._apply_rule(
                session, rule, field_map, section_map, plant_id, run, run_dt, warnings
            )
            line_items_data.extend(items)

        maintenance_items = await self._compute_maintenance_costs(
            session, run, plant_id, warnings
        )
        line_items_data.extend(maintenance_items)

        total = sum(i["amount"] for i in line_items_data)
        status = CostCalculationStatus.COMPLETE
        if warnings:
            status = CostCalculationStatus.PARTIAL if line_items_data else CostCalculationStatus.FAILED

        version_result = await session.execute(
            select(func.coalesce(func.max(CostCalculation.version), 0)).where(
                CostCalculation.process_run_id == run_id
            )
        )
        next_version = (version_result.scalar() or 0) + 1

        calc = CostCalculation(
            process_run_id=run_id,
            calculated_at=datetime.now(timezone.utc),
            total_cost=total,
            version=next_version,
            status=status,
            warnings=warnings,
            context=context,
        )
        session.add(calc)
        await session.flush()

        for item in line_items_data:
            session.add(
                CostLineItem(
                    cost_calculation_id=calc.id,
                    cost_category=item["cost_category"],
                    item_name=item["item_name"],
                    quantity=item["quantity"],
                    unit=item["unit"],
                    rate=item["rate"],
                    amount=item["amount"],
                    source_mapping_id=item.get("source_mapping_id"),
                    source_ref=item.get("source_ref", {}),
                )
            )
        await session.flush()
        await session.refresh(calc, ["line_items"])
        return calc

    async def _apply_rule(
        self,
        session: AsyncSession,
        rule: CostMappingRule,
        field_map: dict[str, Any],
        section_map: dict[str, Any],
        plant_id: Optional[UUID],
        run: ProcessRun,
        run_dt: date,
        warnings: list[str],
    ) -> list[dict[str, Any]]:
        category = CostCategory(rule.cost_category)
        items: list[dict[str, Any]] = []

        if rule.source_type == CostMappingSourceType.SCALAR_FIELD.value or rule.source_type == CostMappingSourceType.SCALAR_FIELD:
            qty = _to_float(field_map.get(rule.source_key))
            if qty is None or qty == 0:
                return items
            item = await self._price_quantity(
                session, category, rule, qty, plant_id, run, run_dt, warnings,
                source_ref={"field_key": rule.source_key},
            )
            if item:
                items.append(item)

        elif rule.source_type in (
            CostMappingSourceType.SECTION_ROW.value,
            CostMappingSourceType.SECTION_AGGREGATE.value,
            CostMappingSourceType.SECTION_ROW,
            CostMappingSourceType.SECTION_AGGREGATE,
        ):
            rows = _section_rows(section_map.get(rule.source_key))
            child_key = rule.child_key or "quantity_kg"
            if rule.source_type in (
                CostMappingSourceType.SECTION_AGGREGATE.value,
                CostMappingSourceType.SECTION_AGGREGATE,
            ):
                total_qty = sum(_to_float(r.get(child_key)) or 0 for r in rows)
                if total_qty > 0:
                    item = await self._price_quantity(
                        session, category, rule, total_qty, plant_id, run, run_dt, warnings,
                        source_ref={"section_key": rule.source_key, "aggregate": True},
                        material_id=None,
                    )
                    if item:
                        items.append(item)
            else:
                for idx, row in enumerate(rows):
                    qty = _to_float(row.get(child_key))
                    if qty is None or qty == 0:
                        continue
                    material_id = None
                    if rule.material_field_key:
                        mat_val = row.get(rule.material_field_key)
                        if mat_val:
                            material_id = await self._resolve_material_id(session, mat_val)
                    item = await self._price_quantity(
                        session, category, rule, qty, plant_id, run, run_dt, warnings,
                        source_ref={"section_key": rule.source_key, "row_index": idx},
                        material_id=material_id,
                        row=row,
                    )
                    if item:
                        items.append(item)
        return items

    async def _price_quantity(
        self,
        session: AsyncSession,
        category: CostCategory,
        rule: CostMappingRule,
        quantity: float,
        plant_id: Optional[UUID],
        run: ProcessRun,
        run_dt: date,
        warnings: list[str],
        source_ref: dict[str, Any],
        material_id: Optional[UUID] = None,
        row: Optional[dict[str, Any]] = None,
    ) -> Optional[dict[str, Any]]:
        rate = 0.0
        unit = rule.unit_override or "unit"
        item_name = rule.item_label_override or rule.source_key

        if category == CostCategory.RAW_MATERIAL:
            if material_id:
                mat = await session.get(MaterialCatalog, material_id)
                if mat:
                    item_name = mat.name
                    rate_row = await self._lookup_material_rate(session, mat.id, run_dt)
                    if rate_row:
                        rate = rate_row.rate
                        unit = rate_row.unit
                    else:
                        warnings.append(f"No rate for material {mat.code}")
            else:
                warnings.append(f"No material reference for {rule.source_key}")

        elif category == CostCategory.POWER:
            unit = rule.unit_override or "kWh"
            item_name = rule.item_label_override or "Electricity"
            rate = await self._lookup_power_rate(session, plant_id, run_dt) or 0.0
            if rate == 0:
                warnings.append("No active power cost rate")

        elif category == CostCategory.FUEL:
            item_name = rule.item_label_override or rule.source_key
            rate = await self._lookup_fuel_rate(session, plant_id, item_name, run_dt) or 0.0
            if rate == 0:
                warnings.append(f"No fuel rate for {item_name}")

        elif category == CostCategory.LABOUR:
            unit = rule.unit_override or "hour"
            hours = quantity
            if hours <= 0:
                hours = await self._estimate_labour_hours(session, run, run_dt, rule)
            quantity = hours
            item_name = rule.item_label_override or rule.labour_role_label or "Labour"
            rate = await self._lookup_labour_rate(
                session, plant_id, run.process_id, rule.labour_role_label
            ) or 0.0
            if rate == 0:
                warnings.append(f"No labour rate for {item_name}")

        elif category in (CostCategory.CONSUMABLES, CostCategory.OTHER):
            item_name = rule.item_label_override or rule.source_key
            rate = 0.0
            warnings.append(f"No rate master for category {category.value}")

        amount = quantity * rate
        return {
            "cost_category": category,
            "item_name": item_name,
            "quantity": quantity,
            "unit": unit,
            "rate": rate,
            "amount": amount,
            "source_mapping_id": rule.id,
            "source_ref": source_ref,
        }

    async def _resolve_material_id(
        self, session: AsyncSession, mat_val: Any
    ) -> Optional[UUID]:
        """Material refs in log sheets may be stored as catalog UUID or material code."""
        if mat_val is None:
            return None
        try:
            return UUID(str(mat_val))
        except (ValueError, TypeError):
            pass
        code = str(mat_val).strip()
        if not code:
            return None
        result = await session.execute(
            select(MaterialCatalog.id).where(MaterialCatalog.code == code).limit(1)
        )
        return result.scalar_one_or_none()

    async def _lookup_material_rate(
        self, session: AsyncSession, material_id: UUID, run_dt: date
    ) -> Optional[RawMaterialCostRate]:
        result = await session.execute(
            select(RawMaterialCostRate)
            .where(
                RawMaterialCostRate.material_id == material_id,
                RawMaterialCostRate.is_active.is_(True),
                RawMaterialCostRate.effective_from <= run_dt,
            )
            .where(
                (RawMaterialCostRate.effective_to.is_(None))
                | (RawMaterialCostRate.effective_to >= run_dt)
            )
            .order_by(RawMaterialCostRate.effective_from.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _lookup_power_rate(
        self, session: AsyncSession, plant_id: Optional[UUID], run_dt: date
    ) -> Optional[float]:
        if not plant_id:
            return None
        result = await session.execute(
            select(PowerCostRate)
            .where(
                PowerCostRate.plant_id == plant_id,
                PowerCostRate.effective_from <= run_dt,
            )
            .where(
                (PowerCostRate.effective_to.is_(None)) | (PowerCostRate.effective_to >= run_dt)
            )
            .order_by(PowerCostRate.effective_from.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        return row.cost_per_unit if row else None

    async def _lookup_fuel_rate(
        self, session: AsyncSession, plant_id: Optional[UUID], fuel_name: str, run_dt: date
    ) -> Optional[float]:
        if not plant_id:
            return None
        result = await session.execute(
            select(FuelCostRate)
            .where(
                FuelCostRate.plant_id == plant_id,
                FuelCostRate.is_active.is_(True),
                FuelCostRate.fuel_name.ilike(fuel_name),
                FuelCostRate.effective_from <= run_dt,
            )
            .where((FuelCostRate.effective_to.is_(None)) | (FuelCostRate.effective_to >= run_dt))
            .order_by(FuelCostRate.effective_from.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        return row.rate if row else None

    async def _lookup_labour_rate(
        self,
        session: AsyncSession,
        plant_id: Optional[UUID],
        process_id: UUID,
        role_label: Optional[str],
    ) -> Optional[float]:
        if not plant_id:
            return None
        process = await session.get(Process, process_id)
        dept_id = process.department_id if process else None
        role = role_label or "Operator"
        for dept_filter in ([dept_id, None] if dept_id else [None]):
            q = select(LabourCostRate).where(
                LabourCostRate.plant_id == plant_id,
                LabourCostRate.is_active.is_(True),
                LabourCostRate.role_label.ilike(role),
            )
            if dept_filter:
                q = q.where(LabourCostRate.department_id == dept_filter)
            else:
                q = q.where(LabourCostRate.department_id.is_(None))
            result = await session.execute(q.limit(1))
            row = result.scalar_one_or_none()
            if row:
                return row.cost_per_hour
        return None

    async def _estimate_labour_hours(
        self, session: AsyncSession, run: ProcessRun, run_dt: date, rule: CostMappingRule
    ) -> float:
        process = await session.get(Process, run.process_id)
        if not process or not run.shift_id:
            return 8.0
        shift = await session.get(Shift, run.shift_id)
        shift_hours = 8.0
        if shift and shift.start_time and shift.end_time:
            start_m = shift.start_time.hour * 60 + shift.start_time.minute
            end_m = shift.end_time.hour * 60 + shift.end_time.minute
            if end_m > start_m:
                shift_hours = (end_m - start_m) / 60.0
        result = await session.execute(
            select(func.count(AttendanceRecord.id)).where(
                AttendanceRecord.attendance_date == run_dt,
                AttendanceRecord.department_id == process.department_id,
                AttendanceRecord.shift_id == run.shift_id,
                AttendanceRecord.status == AttendanceStatus.PRESENT,
            )
        )
        headcount = result.scalar() or 1
        return headcount * shift_hours

    async def _compute_maintenance_costs(
        self,
        session: AsyncSession,
        run: ProcessRun,
        plant_id: Optional[UUID],
        warnings: list[str],
    ) -> list[dict[str, Any]]:
        if not plant_id:
            return []
        q = select(MaintenanceIssue).where(MaintenanceIssue.run_id == run.id)
        result = await session.execute(q)
        issues = list(result.scalars())
        if not issues and run.primary_asset_id:
            result = await session.execute(
                select(MaintenanceIssue).where(MaintenanceIssue.asset_id == run.primary_asset_id)
            )
            issues = list(result.scalars())
        if not issues:
            return []

        items: list[dict[str, Any]] = []
        for issue in issues:
            cat = issue.category.value if hasattr(issue.category, "value") else str(issue.category)
            rate_result = await session.execute(
                select(MaintenanceCostRate)
                .where(
                    MaintenanceCostRate.plant_id == plant_id,
                    MaintenanceCostRate.is_active.is_(True),
                    MaintenanceCostRate.category == cat,
                )
                .limit(1)
            )
            rate_row = rate_result.scalar_one_or_none()
            rate = rate_row.default_cost if rate_row else 0.0
            if not rate_row:
                warnings.append(f"No maintenance rate for category {issue.category.value}")
            items.append(
                {
                    "cost_category": CostCategory.MAINTENANCE,
                    "item_name": issue.title,
                    "quantity": 1.0,
                    "unit": "issue",
                    "rate": rate,
                    "amount": rate,
                    "source_ref": {"maintenance_issue_id": str(issue.id)},
                }
            )
        return items

    async def bulk_compute(
        self,
        session: AsyncSession,
        user: User,
        *,
        plant_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        process_id: Optional[UUID] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> dict[str, int]:
        assert_finance_access(user)
        from app.db.models import ProcessInstance
        from app.services.access_scope import apply_finance_run_scope

        q = (
            select(ProcessRun)
            .join(Process, ProcessRun.process_id == Process.id)
            .join(Department, Process.department_id == Department.id)
            .join(Plant, Department.plant_id == Plant.id)
            .where(ProcessRun.current_state.in_(["completed", "closed", "approved"]))
        )
        if plant_id:
            q = q.where(Department.plant_id == plant_id)
        if department_id:
            q = q.where(Department.id == department_id)
        if process_id:
            q = q.where(ProcessRun.process_id == process_id)
        if from_date:
            q = q.where(ProcessRun.completed_at >= datetime.combine(from_date, datetime.min.time()).replace(tzinfo=timezone.utc))
        if to_date:
            q = q.where(ProcessRun.completed_at <= datetime.combine(to_date, datetime.max.time()).replace(tzinfo=timezone.utc))

        q = apply_finance_run_scope(q, user)
        result = await session.execute(q)
        runs = list(result.scalars())

        computed = failed = skipped = 0
        for run in runs:
            try:
                await self.compute_for_run(session, run.id, user=None)
                computed += 1
            except Exception:
                failed += 1
        return {"computed": computed, "failed": failed, "skipped": skipped}

    async def compute_for_work_order(
        self, session: AsyncSession, work_order_id: UUID, user: User | None = None
    ) -> dict[str, Any]:
        from app.db.models import MaintenanceWorkOrder, MaintenanceWorkOrderPart

        if user:
            assert_finance_access(user)

        wo = await session.get(MaintenanceWorkOrder, work_order_id)
        if not wo:
            raise HTTPException(status_code=404, detail="Work order not found")

        result = await session.execute(
            select(MaintenanceWorkOrderPart).where(
                MaintenanceWorkOrderPart.work_order_id == work_order_id
            )
        )
        parts = list(result.scalars())

        line_items: list[dict[str, Any]] = []
        total = 0.0
        for part in parts:
            amount = float(part.total_cost or (part.quantity * part.unit_cost))
            total += amount
            line_items.append(
                {
                    "part_id": str(part.id),
                    "part_name": part.part_name,
                    "quantity": part.quantity,
                    "unit_cost": part.unit_cost,
                    "amount": amount,
                    "cost_category": CostCategory.MAINTENANCE.value,
                }
            )

        return {
            "work_order_id": str(work_order_id),
            "wo_number": wo.wo_number,
            "total_parts_cost": round(total, 2),
            "line_items": line_items,
            "status": CostCalculationStatus.COMPLETE.value if line_items else CostCalculationStatus.PARTIAL.value,
        }
