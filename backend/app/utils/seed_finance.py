"""Additive seed for Finance cost masters and mapping rules."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    CostMappingRule,
    FuelCostRate,
    LabourCostRate,
    MaintenanceCostRate,
    MaterialCatalog,
    PowerCostRate,
    RawMaterialCostRate,
    Template,
    TemplateVersion,
)
from app.models.enums import CostCategory, CostMappingSourceType, ObservationCategory, TemplateVersionStatus
from app.utils.chandan_org import get_chandan_organisation, get_chandan_plant


async def _get_published_version(session: AsyncSession, doc_no: str) -> TemplateVersion | None:
    result = await session.execute(
        select(TemplateVersion)
        .join(Template, TemplateVersion.template_id == Template.id)
        .where(Template.doc_no == doc_no, TemplateVersion.status == TemplateVersionStatus.PUBLISHED)
        .order_by(TemplateVersion.rev_no.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _ensure_mapping(
    session: AsyncSession,
    version_id,
    *,
    source_type: CostMappingSourceType,
    source_key: str,
    cost_category: CostCategory,
    child_key: str | None = None,
    material_field_key: str | None = None,
    item_label_override: str | None = None,
    unit_override: str | None = None,
    labour_role_label: str | None = None,
    sort_order: int = 0,
) -> None:
    existing = await session.execute(
        select(CostMappingRule).where(
            CostMappingRule.template_version_id == version_id,
            CostMappingRule.source_key == source_key,
            CostMappingRule.source_type == source_type.value,
        )
    )
    if existing.scalar_one_or_none():
        return
    session.add(
        CostMappingRule(
            template_version_id=version_id,
            source_type=source_type.value,
            source_key=source_key,
            child_key=child_key,
            material_field_key=material_field_key,
            cost_category=cost_category.value,
            item_label_override=item_label_override,
            unit_override=unit_override,
            labour_role_label=labour_role_label,
            is_active=True,
            sort_order=sort_order,
        )
    )


async def seed_finance(session: AsyncSession) -> None:
    org = await get_chandan_organisation(session)
    if not org:
        return
    plant = await get_chandan_plant(session, org.id)
    if not plant:
        return

    effective = date(2025, 1, 1)

    # Power rate
    power_exists = await session.execute(
        select(PowerCostRate).where(PowerCostRate.plant_id == plant.id).limit(1)
    )
    if not power_exists.scalar_one_or_none():
        session.add(
            PowerCostRate(
                plant_id=plant.id,
                cost_per_unit=8.50,
                effective_from=effective,
            )
        )

    # Fuel rates
    for fuel_name, rate in [("Diesel", 95.0), ("LPG", 72.0), ("Natural Gas", 45.0)]:
        exists = await session.execute(
            select(FuelCostRate).where(
                FuelCostRate.plant_id == plant.id, FuelCostRate.fuel_name == fuel_name
            ).limit(1)
        )
        if not exists.scalar_one_or_none():
            session.add(
                FuelCostRate(
                    plant_id=plant.id,
                    fuel_name=fuel_name,
                    unit="litre" if fuel_name != "Natural Gas" else "scm",
                    rate=rate,
                    effective_from=effective,
                )
            )

    # Labour rates
    for role, rate in [("Operator", 350.0), ("Supervisor", 500.0), ("Engineer", 750.0)]:
        exists = await session.execute(
            select(LabourCostRate).where(
                LabourCostRate.plant_id == plant.id, LabourCostRate.role_label == role
            ).limit(1)
        )
        if not exists.scalar_one_or_none():
            session.add(
                LabourCostRate(
                    plant_id=plant.id,
                    role_label=role,
                    cost_per_hour=rate,
                )
            )

    # Maintenance rates
    for cat in ObservationCategory:
        exists = await session.execute(
            select(MaintenanceCostRate).where(
                MaintenanceCostRate.plant_id == plant.id,
                MaintenanceCostRate.category == cat.value,
            ).limit(1)
        )
        if not exists.scalar_one_or_none():
            session.add(
                MaintenanceCostRate(
                    plant_id=plant.id,
                    category=cat.value,
                    default_cost=5000.0,
                )
            )

    # Gases and furnace oil are priced like fuels (per litre / per Nm3).
    for fuel_name, unit, rate in [("Furnace Oil", "litre", 62.0), ("Argon", "Nm3", 45.0), ("Oxygen", "Nm3", 8.0), ("Nitrogen", "Nm3", 7.0)]:
        exists = await session.execute(
            select(FuelCostRate).where(FuelCostRate.plant_id == plant.id, FuelCostRate.fuel_name == fuel_name).limit(1)
        )
        if not exists.scalar_one_or_none():
            session.add(FuelCostRate(plant_id=plant.id, fuel_name=fuel_name, unit=unit, rate=rate, effective_from=effective))

    # Raw material rates: every material in the catalogue has a price, so no log sheet row is left unpriced.
    material_rates = {
        "304_SCRAP": 45.0,
        "316_SCRAP": 48.0,
        "410_SCRAP": 42.0,
        "2205_SCRAP": 55.0,
        "CRCA": 50.0,
        "HC_FE_CR": 130.0,
        "HC_FESI": 95.0,
        "FE_NI": 1100.0,
        "FE_CR": 135.0,
        "FE_MN": 95.0,
        "FE_SI": 98.0,
        "FE_MO": 2200.0,
        "P_NI": 1250.0,
        "TI": 650.0,
        "LIME": 12.0,
        "DOLOMITE": 9.0,
        "CPC": 40.0,
        "OTHER": 20.0,
    }
    mats = await session.execute(
        select(MaterialCatalog).where(MaterialCatalog.organisation_id == org.id)
    )
    for mat in mats.scalars():
        rate = material_rates.get(mat.code)
        if rate is None:
            continue
        exists = await session.execute(
            select(RawMaterialCostRate).where(
                RawMaterialCostRate.material_id == mat.id,
                RawMaterialCostRate.effective_from == effective,
            ).limit(1)
        )
        if not exists.scalar_one_or_none():
            session.add(
                RawMaterialCostRate(
                    organisation_id=org.id,
                    material_id=mat.id,
                    unit="kg",
                    rate=rate,
                    effective_from=effective,
                )
            )

    await session.flush()

    # IAF F/PRD/02 mappings
    iaf_ver = await _get_published_version(session, "F/PRD/02")
    if iaf_ver:
        await _ensure_mapping(
            session, iaf_ver.id,
            source_type=CostMappingSourceType.SCALAR_FIELD,
            source_key="power_total",
            cost_category=CostCategory.POWER,
            item_label_override="Electricity",
            unit_override="kWh",
            sort_order=1,
        )
        await _ensure_mapping(
            session, iaf_ver.id,
            source_type=CostMappingSourceType.SECTION_ROW,
            source_key="charge_mix",
            child_key="quantity_kg",
            material_field_key="material",
            cost_category=CostCategory.RAW_MATERIAL,
            sort_order=2,
        )
        await _ensure_mapping(
            session, iaf_ver.id,
            source_type=CostMappingSourceType.SECTION_ROW,
            source_key="ferro_alloys",
            child_key="quantity_kg",
            material_field_key="material",
            cost_category=CostCategory.RAW_MATERIAL,
            sort_order=3,
        )

    # AOD F/PRD/03: alloys and fluxes added, plus the gases blown (oxygen, nitrogen, argon)
    aod_ver = await _get_published_version(session, "F/PRD/03")
    if aod_ver:
        for sort, key in ((10, "alloy_additions"), (11, "flux_additions")):
            await _ensure_mapping(
                session, aod_ver.id,
                source_type=CostMappingSourceType.SECTION_ROW, source_key=key, child_key="quantity_kg",
                material_field_key="material", cost_category=CostCategory.RAW_MATERIAL, sort_order=sort,
            )
        for sort, key, gas in ((12, "ar_nm3", "Argon"), (13, "o2_nm3", "Oxygen"), (14, "n2_nm3", "Nitrogen")):
            await _ensure_mapping(
                session, aod_ver.id,
                source_type=CostMappingSourceType.SCALAR_FIELD, source_key=key, cost_category=CostCategory.FUEL,
                item_label_override=gas, unit_override="Nm3", sort_order=sort,
            )
        await _ensure_mapping(
            session, aod_ver.id,
            source_type=CostMappingSourceType.SCALAR_FIELD,
            source_key="power_total",
            cost_category=CostCategory.POWER,
            item_label_override="Electricity",
            unit_override="kWh",
            sort_order=1,
        )

    # CCM F/PRD/04
    ccm_ver = await _get_published_version(session, "F/PRD/04")
    if ccm_ver:
        await _ensure_mapping(
            session, ccm_ver.id,
            source_type=CostMappingSourceType.SCALAR_FIELD,
            source_key="power_total",
            cost_category=CostCategory.POWER,
            item_label_override="Electricity",
            unit_override="kWh",
            sort_order=1,
        )

    # Rolling F/PRD/05
    rolling_ver = await _get_published_version(session, "F/PRD/05")
    if rolling_ver:
        await _ensure_mapping(
            session, rolling_ver.id,
            source_type=CostMappingSourceType.SCALAR_FIELD,
            source_key="power_consumption",
            cost_category=CostCategory.POWER,
            item_label_override="Electricity",
            unit_override="kWh",
            sort_order=1,
        )
        await _ensure_mapping(
            session, rolling_ver.id,
            source_type=CostMappingSourceType.SCALAR_FIELD,
            source_key="oil_consumption",
            cost_category=CostCategory.FUEL,
            item_label_override="Furnace Oil",
            unit_override="litre",
            sort_order=2,
        )

    await session.flush()
