from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Asset,
    CostCalculation,
    CostLineItem,
    CostMappingRule,
    Department,
    FactProcessRun,
    FuelCostRate,
    LabourCostRate,
    MaintenanceCostRate,
    MaterialCatalog,
    Plant,
    PowerCostRate,
    Process,
    ProcessRun,
    RawMaterialCostRate,
    Template,
    TemplateField,
    TemplateSection,
    TemplateVersion,
    User,
)
from app.models.enums import CostCategory
from app.schemas.finance import (
    AssetCostDetail,
    BulkComputeResponse,
    CategoryBreakdown,
    CostCalculationResponse,
    CostCalculationSummary,
    CostLineItemResponse,
    CostMappingRuleCreate,
    CostMappingRuleResponse,
    CostMappingRuleUpdate,
    CostTrendPoint,
    DepartmentCostDetail,
    DepartmentCostSummary,
    FuelCostRateCreate,
    FuelCostRateResponse,
    FuelCostRateUpdate,
    LabourCostRateCreate,
    LabourCostRateResponse,
    LabourCostRateUpdate,
    MaintenanceCostRateCreate,
    MaintenanceCostRateResponse,
    MaintenanceCostRateUpdate,
    PlantCostSummary,
    PowerCostRateCreate,
    PowerCostRateResponse,
    PowerCostRateUpdate,
    ProcessCostDetail,
    RawMaterialCostRateCreate,
    RawMaterialCostRateResponse,
    RawMaterialCostRateUpdate,
    RunCostSheet,
    TemplateFieldOption,
    TemplateMappingContext,
    TopCostDriver,
)
from app.services.access_scope import (
    assert_finance_access,
    assert_finance_mapping_write,
    assert_finance_masters_write,
    apply_finance_run_scope,
)


def _calc_to_response(calc: CostCalculation) -> CostCalculationResponse:
    warnings = calc.warnings if isinstance(calc.warnings, list) else []
    return CostCalculationResponse(
        id=calc.id,
        process_run_id=calc.process_run_id,
        calculated_at=calc.calculated_at,
        total_cost=calc.total_cost,
        version=calc.version,
        status=calc.status,
        warnings=[str(w) for w in warnings],
        context=calc.context or {},
        line_items=[CostLineItemResponse.model_validate(li) for li in calc.line_items],
    )


def _category_breakdown(line_items: list[CostLineItem]) -> list[CategoryBreakdown]:
    totals: dict[str, float] = {}
    for li in line_items:
        cat = li.cost_category if isinstance(li.cost_category, str) else li.cost_category.value
        totals[cat] = totals.get(cat, 0) + li.amount
    grand = sum(totals.values()) or 1
    return [
        CategoryBreakdown(
            category=CostCategory(cat),
            amount=amt,
            percentage=round(amt / grand * 100, 1),
        )
        for cat, amt in sorted(totals.items(), key=lambda x: -x[1])
    ]


def _latest_calc_subquery():
    return (
        select(
            CostCalculation.process_run_id,
            func.max(CostCalculation.version).label("max_version"),
        )
        .group_by(CostCalculation.process_run_id)
        .subquery()
    )


def _scoped_cost_base(user: User):
    latest = _latest_calc_subquery()
    q = (
        select(CostCalculation, ProcessRun, Process, Department, Plant)
        .join(ProcessRun, CostCalculation.process_run_id == ProcessRun.id)
        .join(Process, ProcessRun.process_id == Process.id)
        .join(Department, Process.department_id == Department.id)
        .join(Plant, Department.plant_id == Plant.id)
        .join(
            latest,
            (CostCalculation.process_run_id == latest.c.process_run_id)
            & (CostCalculation.version == latest.c.max_version),
        )
    )
    return apply_finance_run_scope(q, user)


class FinanceService:
    # --- Raw material rates ---

    async def list_raw_material_rates(
        self, session: AsyncSession, user: User, organisation_id: Optional[UUID] = None
    ) -> list[RawMaterialCostRateResponse]:
        assert_finance_access(user)
        q = select(RawMaterialCostRate).options(selectinload(RawMaterialCostRate.material))
        if organisation_id:
            q = q.where(RawMaterialCostRate.organisation_id == organisation_id)
        result = await session.execute(q.order_by(RawMaterialCostRate.effective_from.desc()))
        rows = []
        for r in result.scalars():
            resp = RawMaterialCostRateResponse.model_validate(r)
            if r.material:
                resp.material_code = r.material.code
                resp.material_name = r.material.name
            rows.append(resp)
        return rows

    async def create_raw_material_rate(
        self, session: AsyncSession, user: User, data: RawMaterialCostRateCreate
    ) -> RawMaterialCostRateResponse:
        assert_finance_masters_write(user)
        row = RawMaterialCostRate(**data.model_dump())
        session.add(row)
        await session.flush()
        await session.refresh(row, ["material"])
        resp = RawMaterialCostRateResponse.model_validate(row)
        if row.material:
            resp.material_code = row.material.code
            resp.material_name = row.material.name
        return resp

    async def update_raw_material_rate(
        self, session: AsyncSession, user: User, rate_id: UUID, data: RawMaterialCostRateUpdate
    ) -> RawMaterialCostRateResponse:
        assert_finance_masters_write(user)
        row = await session.get(RawMaterialCostRate, rate_id)
        if not row:
            raise HTTPException(status_code=404, detail="Rate not found")
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(row, k, v)
        await session.flush()
        await session.refresh(row, ["material"])
        resp = RawMaterialCostRateResponse.model_validate(row)
        if row.material:
            resp.material_code = row.material.code
            resp.material_name = row.material.name
        return resp

    # --- Power rates ---

    async def list_power_rates(
        self, session: AsyncSession, user: User, plant_id: Optional[UUID] = None
    ) -> list[PowerCostRateResponse]:
        assert_finance_access(user)
        q = select(PowerCostRate)
        if plant_id:
            q = q.where(PowerCostRate.plant_id == plant_id)
        result = await session.execute(q.order_by(PowerCostRate.effective_from.desc()))
        return [PowerCostRateResponse.model_validate(r) for r in result.scalars()]

    async def create_power_rate(
        self, session: AsyncSession, user: User, data: PowerCostRateCreate
    ) -> PowerCostRateResponse:
        assert_finance_masters_write(user)
        row = PowerCostRate(**data.model_dump())
        session.add(row)
        await session.flush()
        return PowerCostRateResponse.model_validate(row)

    async def update_power_rate(
        self, session: AsyncSession, user: User, rate_id: UUID, data: PowerCostRateUpdate
    ) -> PowerCostRateResponse:
        assert_finance_masters_write(user)
        row = await session.get(PowerCostRate, rate_id)
        if not row:
            raise HTTPException(status_code=404, detail="Rate not found")
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(row, k, v)
        await session.flush()
        return PowerCostRateResponse.model_validate(row)

    # --- Fuel rates ---

    async def list_fuel_rates(
        self, session: AsyncSession, user: User, plant_id: Optional[UUID] = None
    ) -> list[FuelCostRateResponse]:
        assert_finance_access(user)
        q = select(FuelCostRate)
        if plant_id:
            q = q.where(FuelCostRate.plant_id == plant_id)
        result = await session.execute(q.order_by(FuelCostRate.fuel_name))
        return [FuelCostRateResponse.model_validate(r) for r in result.scalars()]

    async def create_fuel_rate(
        self, session: AsyncSession, user: User, data: FuelCostRateCreate
    ) -> FuelCostRateResponse:
        assert_finance_masters_write(user)
        row = FuelCostRate(**data.model_dump())
        session.add(row)
        await session.flush()
        return FuelCostRateResponse.model_validate(row)

    async def update_fuel_rate(
        self, session: AsyncSession, user: User, rate_id: UUID, data: FuelCostRateUpdate
    ) -> FuelCostRateResponse:
        assert_finance_masters_write(user)
        row = await session.get(FuelCostRate, rate_id)
        if not row:
            raise HTTPException(status_code=404, detail="Rate not found")
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(row, k, v)
        await session.flush()
        return FuelCostRateResponse.model_validate(row)

    # --- Labour rates ---

    async def list_labour_rates(
        self, session: AsyncSession, user: User, plant_id: Optional[UUID] = None
    ) -> list[LabourCostRateResponse]:
        assert_finance_access(user)
        q = select(LabourCostRate)
        if plant_id:
            q = q.where(LabourCostRate.plant_id == plant_id)
        result = await session.execute(q.order_by(LabourCostRate.role_label))
        return [LabourCostRateResponse.model_validate(r) for r in result.scalars()]

    async def create_labour_rate(
        self, session: AsyncSession, user: User, data: LabourCostRateCreate
    ) -> LabourCostRateResponse:
        assert_finance_masters_write(user)
        row = LabourCostRate(**data.model_dump())
        session.add(row)
        await session.flush()
        return LabourCostRateResponse.model_validate(row)

    async def update_labour_rate(
        self, session: AsyncSession, user: User, rate_id: UUID, data: LabourCostRateUpdate
    ) -> LabourCostRateResponse:
        assert_finance_masters_write(user)
        row = await session.get(LabourCostRate, rate_id)
        if not row:
            raise HTTPException(status_code=404, detail="Rate not found")
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(row, k, v)
        await session.flush()
        return LabourCostRateResponse.model_validate(row)

    # --- Maintenance rates ---

    async def list_maintenance_rates(
        self, session: AsyncSession, user: User, plant_id: Optional[UUID] = None
    ) -> list[MaintenanceCostRateResponse]:
        assert_finance_access(user)
        q = select(MaintenanceCostRate)
        if plant_id:
            q = q.where(MaintenanceCostRate.plant_id == plant_id)
        result = await session.execute(q.order_by(MaintenanceCostRate.category))
        return [MaintenanceCostRateResponse.model_validate(r) for r in result.scalars()]

    async def create_maintenance_rate(
        self, session: AsyncSession, user: User, data: MaintenanceCostRateCreate
    ) -> MaintenanceCostRateResponse:
        assert_finance_masters_write(user)
        row = MaintenanceCostRate(**data.model_dump())
        session.add(row)
        await session.flush()
        return MaintenanceCostRateResponse.model_validate(row)

    async def update_maintenance_rate(
        self, session: AsyncSession, user: User, rate_id: UUID, data: MaintenanceCostRateUpdate
    ) -> MaintenanceCostRateResponse:
        assert_finance_masters_write(user)
        row = await session.get(MaintenanceCostRate, rate_id)
        if not row:
            raise HTTPException(status_code=404, detail="Rate not found")
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(row, k, v)
        await session.flush()
        return MaintenanceCostRateResponse.model_validate(row)

    # --- Mapping rules ---

    async def get_mapping_context(
        self, session: AsyncSession, user: User, version_id: UUID
    ) -> TemplateMappingContext:
        assert_finance_access(user)
        version = await session.get(
            TemplateVersion,
            version_id,
            options=[
                selectinload(TemplateVersion.sections).selectinload(TemplateSection.fields),
                selectinload(TemplateVersion.template),
            ],
        )
        if not version:
            raise HTTPException(status_code=404, detail="Template version not found")

        fields: list[TemplateFieldOption] = []
        for section in sorted(version.sections, key=lambda s: s.sort_order):
            if section.section_type == "fields":
                for field in sorted(section.fields, key=lambda f: f.sort_order):
                    fields.append(
                        TemplateFieldOption(
                            section_key=section.key,
                            section_title=section.title,
                            field_name=field.name,
                            field_label=field.label,
                            field_type=field.field_type.value if hasattr(field.field_type, "value") else str(field.field_type),
                            section_type=section.section_type,
                        )
                    )
            else:
                fields.append(
                    TemplateFieldOption(
                        section_key=section.key,
                        section_title=section.title,
                        field_name=section.key,
                        field_label=section.title,
                        field_type=section.section_type,
                        section_type=section.section_type,
                    )
                )

        rules_result = await session.execute(
            select(CostMappingRule)
            .where(CostMappingRule.template_version_id == version_id)
            .order_by(CostMappingRule.sort_order)
        )
        rules = [CostMappingRuleResponse.model_validate(r) for r in rules_result.scalars()]
        template_name = version.template.name if version.template else None
        return TemplateMappingContext(
            template_version_id=version_id,
            template_name=template_name,
            rev_no=version.rev_no,
            available_fields=fields,
            rules=rules,
        )

    async def create_mapping_rule(
        self, session: AsyncSession, user: User, data: CostMappingRuleCreate
    ) -> CostMappingRuleResponse:
        assert_finance_mapping_write(user)
        row = CostMappingRule(**data.model_dump())
        session.add(row)
        await session.flush()
        return CostMappingRuleResponse.model_validate(row)

    async def update_mapping_rule(
        self, session: AsyncSession, user: User, rule_id: UUID, data: CostMappingRuleUpdate
    ) -> CostMappingRuleResponse:
        assert_finance_mapping_write(user)
        row = await session.get(CostMappingRule, rule_id)
        if not row:
            raise HTTPException(status_code=404, detail="Mapping rule not found")
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(row, k, v)
        await session.flush()
        return CostMappingRuleResponse.model_validate(row)

    async def delete_mapping_rule(self, session: AsyncSession, user: User, rule_id: UUID) -> None:
        assert_finance_mapping_write(user)
        row = await session.get(CostMappingRule, rule_id)
        if not row:
            raise HTTPException(status_code=404, detail="Mapping rule not found")
        await session.delete(row)

    async def clone_mappings(
        self, session: AsyncSession, user: User, target_version_id: UUID, source_version_id: UUID
    ) -> list[CostMappingRuleResponse]:
        assert_finance_mapping_write(user)
        source_result = await session.execute(
            select(CostMappingRule).where(CostMappingRule.template_version_id == source_version_id)
        )
        cloned = []
        for src in source_result.scalars():
            row = CostMappingRule(
                template_version_id=target_version_id,
                source_type=src.source_type,
                source_key=src.source_key,
                child_key=src.child_key,
                material_field_key=src.material_field_key,
                cost_category=src.cost_category,
                item_label_override=src.item_label_override,
                unit_override=src.unit_override,
                labour_role_label=src.labour_role_label,
                is_active=src.is_active,
                sort_order=src.sort_order,
            )
            session.add(row)
            cloned.append(row)
        await session.flush()
        return [CostMappingRuleResponse.model_validate(r) for r in cloned]

    # --- Calculations read ---

    async def list_run_calculations(
        self, session: AsyncSession, user: User, run_id: UUID
    ) -> list[CostCalculationSummary]:
        assert_finance_access(user)
        result = await session.execute(
            select(CostCalculation, ProcessRun.run_number)
            .join(ProcessRun, CostCalculation.process_run_id == ProcessRun.id)
            .where(CostCalculation.process_run_id == run_id)
            .order_by(CostCalculation.version.desc())
        )
        return [
            CostCalculationSummary(
                id=calc.id,
                process_run_id=calc.process_run_id,
                run_number=run_number,
                calculated_at=calc.calculated_at,
                total_cost=calc.total_cost,
                version=calc.version,
                status=calc.status,
            )
            for calc, run_number in result.all()
        ]

    async def get_calculation_version(
        self, session: AsyncSession, user: User, run_id: UUID, version: int
    ) -> CostCalculationResponse:
        assert_finance_access(user)
        result = await session.execute(
            select(CostCalculation)
            .options(selectinload(CostCalculation.line_items))
            .where(CostCalculation.process_run_id == run_id, CostCalculation.version == version)
        )
        calc = result.scalar_one_or_none()
        if not calc:
            raise HTTPException(status_code=404, detail="Calculation not found")
        return _calc_to_response(calc)

    # --- Dashboard ---

    async def plant_summary(
        self, session: AsyncSession, user: User, plant_id: UUID
    ) -> PlantCostSummary:
        assert_finance_access(user)
        today = date.today()
        month_start = today.replace(day=1)

        base = _scoped_cost_base(user).where(Department.plant_id == plant_id)
        result = await session.execute(base)
        rows = result.all()

        total_today = total_month = 0.0
        runs_today = runs_month = 0
        dept_totals: dict[UUID, dict] = {}
        cat_totals: dict[str, float] = {}

        for calc, run, process, dept, plant in rows:
            calc_date = calc.calculated_at.date() if calc.calculated_at else today
            if calc_date == today:
                total_today += calc.total_cost
                runs_today += 1
            if calc_date >= month_start:
                total_month += calc.total_cost
                runs_month += 1
            if dept.id not in dept_totals:
                dept_totals[dept.id] = {
                    "code": dept.code,
                    "name": dept.name,
                    "total": 0.0,
                    "count": 0,
                }
            dept_totals[dept.id]["total"] += calc.total_cost
            dept_totals[dept.id]["count"] += 1

        latest = _latest_calc_subquery()
        line_result = await session.execute(
            select(CostLineItem.cost_category, func.sum(CostLineItem.amount))
            .join(CostCalculation, CostLineItem.cost_calculation_id == CostCalculation.id)
            .join(
                latest,
                (CostCalculation.process_run_id == latest.c.process_run_id)
                & (CostCalculation.version == latest.c.max_version),
            )
            .join(ProcessRun, CostCalculation.process_run_id == ProcessRun.id)
            .join(Process, ProcessRun.process_id == Process.id)
            .join(Department, Process.department_id == Department.id)
            .where(Department.plant_id == plant_id)
            .group_by(CostLineItem.cost_category)
        )
        for cat, amt in line_result.all():
            cat_totals[str(cat)] = float(amt or 0)

        grand = sum(cat_totals.values()) or 1
        by_category = [
            CategoryBreakdown(
                category=CostCategory(cat),
                amount=amt,
                percentage=round(amt / grand * 100, 1),
            )
            for cat, amt in sorted(cat_totals.items(), key=lambda x: -x[1])
        ]

        by_department = [
            DepartmentCostSummary(
                department_id=did,
                department_code=d["code"],
                department_name=d["name"],
                total_cost=d["total"],
                run_count=d["count"],
            )
            for did, d in sorted(dept_totals.items(), key=lambda x: -x[1]["total"])
        ]

        return PlantCostSummary(
            total_cost_today=total_today,
            total_cost_month=total_month,
            run_count_today=runs_today,
            run_count_month=runs_month,
            by_department=by_department,
            by_category=by_category,
        )

    async def department_detail(
        self, session: AsyncSession, user: User, department_id: UUID
    ) -> DepartmentCostDetail:
        assert_finance_access(user)
        dept = await session.get(Department, department_id)
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found")

        latest = _latest_calc_subquery()
        q = (
            select(CostCalculation, ProcessRun, FactProcessRun)
            .join(ProcessRun, CostCalculation.process_run_id == ProcessRun.id)
            .join(Process, ProcessRun.process_id == Process.id)
            .join(Department, Process.department_id == Department.id)
            .join(Plant, Department.plant_id == Plant.id)
            .outerjoin(FactProcessRun, FactProcessRun.run_id == ProcessRun.id)
            .join(
                latest,
                (CostCalculation.process_run_id == latest.c.process_run_id)
                & (CostCalculation.version == latest.c.max_version),
            )
            .where(Department.id == department_id)
        )
        q = apply_finance_run_scope(q, user)
        result = await session.execute(q)
        rows = result.all()

        total = sum(c.total_cost for c, _, _ in rows)
        run_count = len(rows)
        production_kg = sum(f.charge_kg or 0 for _, _, f in rows if f)

        line_result = await session.execute(
            select(CostLineItem)
            .join(CostCalculation, CostLineItem.cost_calculation_id == CostCalculation.id)
            .join(
                latest,
                (CostCalculation.process_run_id == latest.c.process_run_id)
                & (CostCalculation.version == latest.c.max_version),
            )
            .join(ProcessRun, CostCalculation.process_run_id == ProcessRun.id)
            .join(Process, ProcessRun.process_id == Process.id)
            .where(Process.department_id == department_id)
        )
        breakdown = _category_breakdown(list(line_result.scalars()))

        return DepartmentCostDetail(
            department_id=dept.id,
            department_code=dept.code,
            department_name=dept.name,
            total_cost=total,
            run_count=run_count,
            cost_per_run=total / run_count if run_count else 0,
            cost_per_ton=(total / (production_kg / 1000)) if production_kg > 0 else None,
            breakdown=breakdown,
        )

    async def process_detail(
        self, session: AsyncSession, user: User, process_id: UUID
    ) -> ProcessCostDetail:
        assert_finance_access(user)
        process = await session.get(Process, process_id)
        if not process:
            raise HTTPException(status_code=404, detail="Process not found")

        latest = _latest_calc_subquery()
        q = (
            select(CostCalculation, ProcessRun)
            .join(ProcessRun, CostCalculation.process_run_id == ProcessRun.id)
            .join(Process, ProcessRun.process_id == Process.id)
            .join(Department, Process.department_id == Department.id)
            .join(Plant, Department.plant_id == Plant.id)
            .join(
                latest,
                (CostCalculation.process_run_id == latest.c.process_run_id)
                & (CostCalculation.version == latest.c.max_version),
            )
            .where(Process.id == process_id)
        )
        q = apply_finance_run_scope(q, user)
        result = await session.execute(q)
        rows = result.all()

        costs = [(calc.total_cost, calc.process_run_id, run.run_number) for calc, run in rows]
        total = sum(c[0] for c in costs)
        run_count = len(costs)
        highest = max(costs, key=lambda x: x[0], default=None)
        lowest = min(costs, key=lambda x: x[0], default=None)

        return ProcessCostDetail(
            process_id=process.id,
            process_code=process.code,
            process_name=process.name,
            total_cost=total,
            run_count=run_count,
            average_cost=total / run_count if run_count else 0,
            highest_cost_run_id=highest[1] if highest else None,
            highest_cost_run_number=highest[2] if highest else None,
            highest_cost=highest[0] if highest else 0,
            lowest_cost_run_id=lowest[1] if lowest else None,
            lowest_cost_run_number=lowest[2] if lowest else None,
            lowest_cost=lowest[0] if lowest else 0,
        )

    async def asset_detail(
        self, session: AsyncSession, user: User, asset_id: UUID
    ) -> AssetCostDetail:
        assert_finance_access(user)
        asset = await session.get(Asset, asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")

        latest = _latest_calc_subquery()
        q = (
            select(CostCalculation, ProcessRun, FactProcessRun)
            .join(ProcessRun, CostCalculation.process_run_id == ProcessRun.id)
            .join(Process, ProcessRun.process_id == Process.id)
            .join(Department, Process.department_id == Department.id)
            .join(Plant, Department.plant_id == Plant.id)
            .outerjoin(FactProcessRun, FactProcessRun.run_id == ProcessRun.id)
            .join(
                latest,
                (CostCalculation.process_run_id == latest.c.process_run_id)
                & (CostCalculation.version == latest.c.max_version),
            )
            .where(ProcessRun.primary_asset_id == asset_id)
        )
        q = apply_finance_run_scope(q, user)
        result = await session.execute(q)
        rows = result.all()

        total = sum(c.total_cost for c, _, _ in rows)
        production_kg = sum(f.charge_kg or 0 for _, _, f in rows if f)

        calc_ids = [c.id for c, _, _ in rows]
        power_cost = maintenance_cost = 0.0
        if calc_ids:
            li_result = await session.execute(
                select(CostLineItem).where(CostLineItem.cost_calculation_id.in_(calc_ids))
            )
            for li in li_result.scalars():
                cat = li.cost_category if isinstance(li.cost_category, str) else li.cost_category.value
                if cat == CostCategory.POWER.value:
                    power_cost += li.amount
                elif cat == CostCategory.MAINTENANCE.value:
                    maintenance_cost += li.amount

        return AssetCostDetail(
            asset_id=asset.id,
            asset_no=asset.asset_no,
            asset_name=asset.name,
            total_production_kg=production_kg,
            power_cost=power_cost,
            maintenance_cost=maintenance_cost,
            total_cost=total,
            cost_per_ton=(total / (production_kg / 1000)) if production_kg > 0 else None,
        )

    async def run_cost_sheet(
        self, session: AsyncSession, user: User, run_id: UUID
    ) -> RunCostSheet:
        assert_finance_access(user)
        run = await session.get(ProcessRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Process run not found")

        result = await session.execute(
            select(CostCalculation)
            .options(selectinload(CostCalculation.line_items))
            .where(CostCalculation.process_run_id == run_id)
            .order_by(CostCalculation.version.desc())
            .limit(1)
        )
        calc = result.scalar_one_or_none()
        if not calc:
            raise HTTPException(status_code=404, detail="No cost calculation for this run")

        process = await session.get(Process, run.process_id)
        dept = await session.get(Department, process.department_id) if process else None
        breakdown = _category_breakdown(calc.line_items)

        return RunCostSheet(
            run_id=run.id,
            run_number=run.run_number,
            process_code=process.code if process else None,
            department_code=dept.code if dept else None,
            calculation=_calc_to_response(calc),
            breakdown=breakdown,
        )

    async def top_drivers(
        self, session: AsyncSession, user: User, plant_id: UUID
    ) -> list[TopCostDriver]:
        assert_finance_access(user)
        latest = _latest_calc_subquery()
        result = await session.execute(
            select(CostLineItem.cost_category, func.sum(CostLineItem.amount))
            .join(CostCalculation, CostLineItem.cost_calculation_id == CostCalculation.id)
            .join(
                latest,
                (CostCalculation.process_run_id == latest.c.process_run_id)
                & (CostCalculation.version == latest.c.max_version),
            )
            .join(ProcessRun, CostCalculation.process_run_id == ProcessRun.id)
            .join(Process, ProcessRun.process_id == Process.id)
            .join(Department, Process.department_id == Department.id)
            .where(Department.plant_id == plant_id)
            .group_by(CostLineItem.cost_category)
        )
        rows = [(cat, float(amt or 0)) for cat, amt in result.all()]
        grand = sum(a for _, a in rows) or 1
        return [
            TopCostDriver(
                category=CostCategory(str(cat)),
                amount=amt,
                percentage=round(amt / grand * 100, 1),
            )
            for cat, amt in sorted(rows, key=lambda x: -x[1])
        ]

    async def cost_trends(
        self,
        session: AsyncSession,
        user: User,
        plant_id: UUID,
        group_by: str = "day",
    ) -> list[CostTrendPoint]:
        assert_finance_access(user)
        latest = _latest_calc_subquery()
        base = (
            select(CostCalculation, ProcessRun, Process, Department, Asset)
            .join(ProcessRun, CostCalculation.process_run_id == ProcessRun.id)
            .join(Process, ProcessRun.process_id == Process.id)
            .join(Department, Process.department_id == Department.id)
            .join(Plant, Department.plant_id == Plant.id)
            .outerjoin(Asset, ProcessRun.primary_asset_id == Asset.id)
            .join(
                latest,
                (CostCalculation.process_run_id == latest.c.process_run_id)
                & (CostCalculation.version == latest.c.max_version),
            )
            .where(Department.plant_id == plant_id)
        )
        base = apply_finance_run_scope(base, user)
        result = await session.execute(base)
        rows = result.all()

        buckets: dict[str, dict] = {}
        for calc, run, process, dept, asset in rows:
            if group_by == "department":
                label = dept.code
            elif group_by == "process":
                label = process.code
            elif group_by == "asset":
                label = asset.asset_no if asset else "unknown"
            else:
                label = calc.calculated_at.date().isoformat() if calc.calculated_at else "unknown"
            if label not in buckets:
                buckets[label] = {"total": 0.0, "count": 0}
            buckets[label]["total"] += calc.total_cost
            buckets[label]["count"] += 1

        return [
            CostTrendPoint(label=label, total_cost=data["total"], run_count=data["count"])
            for label, data in sorted(buckets.items())
        ]
