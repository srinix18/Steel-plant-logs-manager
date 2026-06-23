"""Additive seed for Chandan Steel departments under the unified Chandan Steels plant."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.chandan_org import (
    get_chandan_department,
    get_chandan_organisation,
    get_or_create_chandan_plant,
)
from app.db.models import Department

DIVISIONS: list[tuple[str, str]] = [
    ("ROLLING", "Rolling Mill"),
    ("WIRE", "Wire Division"),
    ("BBD", "Bright Bar Division"),
]


async def _get_or_create_department(
    session: AsyncSession,
    plant_id,
    organisation_id,
    code: str,
    name: str,
) -> Department:
    dept = await get_chandan_department(session, plant_id, code)
    if dept:
        return dept
    dept = Department(
        plant_id=plant_id,
        organisation_id=organisation_id,
        name=name,
        code=code,
        description=f"{name} Department",
    )
    session.add(dept)
    await session.flush()
    return dept


async def seed_chandan_divisions(session: AsyncSession) -> None:
    org = await get_chandan_organisation(session)
    if not org:
        return

    plant = await get_or_create_chandan_plant(session, org.id)

    for code, name in DIVISIONS:
        await _get_or_create_department(session, plant.id, org.id, code, name)
