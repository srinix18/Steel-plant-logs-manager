"""Idempotent seed for asset groups referenced by ASSET_REF fields but empty in initial seeds."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Asset, AssetGroup, Plant


_EMPTY_GROUP_ASSETS: dict[str, list[tuple[str, str, dict]]] = {
    "ladles": [
        ("LADLE-01", "Transfer Ladle #1", {"heats": 0}),
        ("LADLE-02", "Transfer Ladle #2", {"heats": 0}),
    ],
    "crucibles": [
        ("CRUC-01", "Crucible #1", {"heats": 0}),
        ("CRUC-02", "Crucible #2", {"heats": 0}),
    ],
    "transformers": [
        ("XFMR-01", "Transformer #1", {"days": 0}),
        ("XFMR-02", "Transformer #2", {"days": 0}),
    ],
    "casting_ladles": [
        ("CLADLE-01", "Casting Ladle #1", {"casts": 0}),
        ("CLADLE-02", "Casting Ladle #2", {"casts": 0}),
    ],
}


async def seed_asset_catalog(session: AsyncSession) -> None:
    plant = (
        await session.execute(select(Plant).where(Plant.code == "CS"))
    ).scalar_one_or_none()
    if not plant:
        return

    for group_code, assets in _EMPTY_GROUP_ASSETS.items():
        group = (
            await session.execute(
                select(AssetGroup).where(
                    AssetGroup.plant_id == plant.id,
                    AssetGroup.code == group_code,
                )
            )
        ).scalar_one_or_none()
        if not group:
            continue

        existing = (
            await session.execute(
                select(Asset).where(Asset.group_id == group.id)
            )
        ).scalars().first()
        if existing:
            continue

        for asset_no, name, life in assets:
            session.add(
                Asset(
                    group_id=group.id,
                    plant_id=plant.id,
                    asset_no=asset_no,
                    name=name,
                    life_counters=life,
                )
            )
