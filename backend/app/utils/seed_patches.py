"""Idempotent DB patches for existing installations."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Asset, AssetGroup, GradeElementSpec, Organisation, Process, ProcessInstance, SteelGrade, TelemetryBinding

GRADE_ELEMENT_SPECS: dict[str, list[tuple[str, float, float]]] = {
    "304": [
        ("C", 0.0, 0.08),
        ("SI", 0.0, 1.0),
        ("MN", 0.0, 2.0),
        ("P", 0.0, 0.045),
        ("S", 0.0, 0.03),
        ("NI", 8.0, 10.5),
        ("CR", 18.0, 20.0),
        ("MO", 0.0, 0.75),
        ("SN", 0.0, 0.1),
        ("CO", 0.0, 0.5),
        ("W", 0.0, 0.5),
    ],
    "316": [
        ("C", 0.0, 0.08),
        ("SI", 0.0, 1.0),
        ("MN", 0.0, 2.0),
        ("P", 0.0, 0.045),
        ("S", 0.0, 0.03),
        ("NI", 10.0, 14.0),
        ("CR", 16.0, 18.0),
        ("MO", 2.0, 3.0),
        ("SN", 0.0, 0.1),
        ("CO", 0.0, 0.5),
        ("W", 0.0, 0.5),
    ],
    "410": [
        ("C", 0.08, 0.15),
        ("SI", 0.0, 1.0),
        ("MN", 0.0, 1.0),
        ("P", 0.0, 0.04),
        ("S", 0.0, 0.03),
        ("NI", 0.0, 0.75),
        ("CR", 11.5, 13.5),
        ("MO", 0.0, 0.5),
        ("SN", 0.0, 0.1),
        ("CO", 0.0, 0.5),
        ("W", 0.0, 0.5),
    ],
    "2205": [
        ("C", 0.0, 0.03),
        ("SI", 0.0, 0.8),
        ("MN", 0.0, 2.0),
        ("P", 0.0, 0.03),
        ("S", 0.0, 0.02),
        ("NI", 4.5, 6.5),
        ("CR", 21.0, 23.0),
        ("MO", 2.5, 3.5),
        ("N", 0.08, 0.2),
        ("SN", 0.0, 0.1),
        ("CO", 0.0, 0.5),
    ],
    "430": [
        ("C", 0.0, 0.12),
        ("SI", 0.0, 1.0),
        ("MN", 0.0, 1.0),
        ("P", 0.0, 0.04),
        ("S", 0.0, 0.03),
        ("NI", 0.0, 0.75),
        ("CR", 16.0, 18.0),
        ("MO", 0.0, 0.5),
        ("SN", 0.0, 0.1),
        ("CO", 0.0, 0.5),
        ("W", 0.0, 0.5),
    ],
}

GRADE_DESCRIPTIONS = {
    "304": "AISI 304",
    "316": "AISI 316",
    "410": "AISI 410",
    "2205": "Duplex 2205",
    "430": "AISI 430",
}


async def _add_grade_if_missing(session: AsyncSession, org_id, code: str) -> None:
    result = await session.execute(
        select(SteelGrade).where(SteelGrade.organisation_id == org_id, SteelGrade.code == code)
    )
    grade = result.scalar_one_or_none()
    if not grade:
        grade = SteelGrade(
            organisation_id=org_id,
            code=code,
            description=GRADE_DESCRIPTIONS.get(code, code),
        )
        session.add(grade)
        await session.flush()

    spec_result = await session.execute(
        select(GradeElementSpec).where(GradeElementSpec.grade_id == grade.id).limit(1)
    )
    if spec_result.scalar_one_or_none():
        return

    for element, min_v, max_v in GRADE_ELEMENT_SPECS[code]:
        session.add(
            GradeElementSpec(grade_id=grade.id, element=element, min_value=min_v, max_value=max_v)
        )


async def patch_eaf_to_iaf(session: AsyncSession) -> None:
    result = await session.execute(select(Process).where(Process.code == "EAF"))
    process = result.scalar_one_or_none()
    if process:
        process.code = "IAF"
        process.name = "Induction Furnace"

        grp_result = await session.execute(select(AssetGroup).where(AssetGroup.code == "furnaces"))
        grp = grp_result.scalar_one_or_none()
        if grp:
            grp.name = "Induction Furnaces"

        assets = await session.execute(select(Asset).where(Asset.asset_no.like("EAF-%")))
        for asset in assets.scalars():
            num = asset.asset_no.split("-")[-1]
            asset.asset_no = f"IAF-{num}"
            asset.name = asset.name.replace("EAF", "IAF")
            if asset.plc_tag_prefix and asset.plc_tag_prefix.startswith("EAF"):
                asset.plc_tag_prefix = asset.plc_tag_prefix.replace("EAF", "IAF", 1)

        bindings = await session.execute(select(TelemetryBinding).where(TelemetryBinding.tag_name.like("EAF%")))
        for binding in bindings.scalars():
            binding.tag_name = binding.tag_name.replace("EAF", "IAF", 1)

    instances = await session.execute(select(ProcessInstance))
    for instance in instances.scalars():
        if instance.name and "EAF" in instance.name:
            instance.name = instance.name.replace("EAF", "IAF")

    # Catch assets renamed in a prior partial patch
    iaf_assets = await session.execute(select(Asset).where(Asset.name.like("%EAF%")))
    for asset in iaf_assets.scalars():
        asset.name = asset.name.replace("EAF", "IAF")


async def patch_extra_steel_grades(session: AsyncSession) -> None:
    org_result = await session.execute(select(Organisation).where(Organisation.code == "CHANDAN"))
    org = org_result.scalar_one_or_none()
    if not org:
        return

    for code in ("316", "410", "2205", "430"):
        await _add_grade_if_missing(session, org.id, code)
