"""Shared Chandan Steel org/plant lookups for seeds and patches."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Asset, AssetGroup, Department, Organisation, Plant, Shift, User

CHANDAN_ORG_CODE = "CHANDAN"
CHANDAN_PLANT_CODE = "CS"
CHANDAN_PLANT_NAME = "Chandan Steels"
LEGACY_PLANT_CODE = "SMS"


async def get_chandan_organisation(session: AsyncSession) -> Organisation | None:
    result = await session.execute(select(Organisation).where(Organisation.code == CHANDAN_ORG_CODE))
    return result.scalar_one_or_none()


async def get_chandan_plant(session: AsyncSession, organisation_id: UUID) -> Plant | None:
    for code in (CHANDAN_PLANT_CODE, LEGACY_PLANT_CODE):
        result = await session.execute(
            select(Plant).where(Plant.organisation_id == organisation_id, Plant.code == code)
        )
        plant = result.scalar_one_or_none()
        if plant:
            return plant
    return None


async def get_or_create_chandan_plant(session: AsyncSession, organisation_id: UUID) -> Plant:
    plant = await get_chandan_plant(session, organisation_id)
    if plant:
        plant.name = CHANDAN_PLANT_NAME
        if plant.code != CHANDAN_PLANT_CODE:
            plant.code = CHANDAN_PLANT_CODE
        if not plant.location:
            plant.location = CHANDAN_PLANT_NAME
        return plant

    plant = Plant(
        organisation_id=organisation_id,
        name=CHANDAN_PLANT_NAME,
        code=CHANDAN_PLANT_CODE,
        timezone="Asia/Kolkata",
        location=CHANDAN_PLANT_NAME,
    )
    session.add(plant)
    await session.flush()
    return plant


async def get_chandan_department(
    session: AsyncSession, plant_id: UUID, department_code: str
) -> Department | None:
    result = await session.execute(
        select(Department).where(Department.plant_id == plant_id, Department.code == department_code)
    )
    return result.scalar_one_or_none()


async def patch_unified_chandan_plant(session: AsyncSession) -> None:
    """Merge legacy per-division plants into one Chandan Steels plant."""
    org = await get_chandan_organisation(session)
    if not org:
        return

    plants_result = await session.execute(select(Plant).where(Plant.organisation_id == org.id))
    plants = list(plants_result.scalars().all())
    if not plants:
        return

    canonical: Plant | None = None
    for plant in plants:
        if plant.code in (CHANDAN_PLANT_CODE, LEGACY_PLANT_CODE):
            canonical = plant
            break
    if not canonical:
        for plant in plants:
            sms_dept = await get_chandan_department(session, plant.id, "SMS")
            if sms_dept:
                canonical = plant
                break
    if not canonical:
        canonical = plants[0]

    canonical.name = CHANDAN_PLANT_NAME
    canonical.code = CHANDAN_PLANT_CODE
    canonical.location = CHANDAN_PLANT_NAME

    for plant in plants:
        if plant.id == canonical.id:
            continue

        depts_result = await session.execute(select(Department).where(Department.plant_id == plant.id))
        for dept in depts_result.scalars():
            existing = await get_chandan_department(session, canonical.id, dept.code)
            if existing and existing.id != dept.id:
                await session.delete(dept)
            else:
                dept.plant_id = canonical.id

        for model in (User, Asset, AssetGroup, Shift):
            rows = await session.execute(select(model).where(model.plant_id == plant.id))
            for row in rows.scalars():
                row.plant_id = canonical.id

        await session.delete(plant)

    await session.flush()
