"""Wire division coil master — upsert from input register, picker list, lookup."""

from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Coil
from app.models.enums import CoilStatus
from app.schemas.moi import CoilLookupResponse, CoilResponse


def _row_values(row: dict) -> dict:
    values = row.get("values")
    if isinstance(values, dict):
        return values
    return row


def _parse_uuid(value) -> UUID | None:
    if not value:
        return None
    if isinstance(value, UUID):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return UUID(value.strip())
        except ValueError:
            return None
    return None


def _parse_heat(values: dict) -> tuple[UUID | None, str | None]:
    heat_val = values.get("heat_no") or values.get("heat_ref")
    if isinstance(heat_val, dict):
        return _parse_uuid(heat_val.get("run_id")), (heat_val.get("heat_no") or None)
    if isinstance(heat_val, str) and heat_val.strip():
        return None, heat_val.strip()
    return None, None


def _parse_size(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_coil_ref(values: dict, *keys: str) -> UUID | None:
    for key in keys:
        ref = values.get(key)
        if isinstance(ref, dict):
            coil_id = _parse_uuid(ref.get("coil_id"))
            if coil_id:
                return coil_id
    return None


class CoilService:
    async def upsert_coils_from_input_register(
        self,
        session: AsyncSession,
        run_id: UUID,
        plant_id: UUID,
        dept_id: UUID,
        user_id: UUID,
        section_data: dict,
    ) -> None:
        rows = section_data.get("rows", [])
        if not isinstance(rows, list):
            return

        for row in rows:
            if not isinstance(row, dict):
                continue
            values = _row_values(row)
            coil_no = values.get("coil_no")
            if not coil_no or not str(coil_no).strip():
                continue
            coil_no = str(coil_no).strip()

            heat_run_id, heat_no = _parse_heat(values)
            grade_id = _parse_uuid(values.get("grade_id"))
            work_order_no = values.get("work_order_no")
            work_order_no = str(work_order_no).strip() if work_order_no else None
            size_mm = _parse_size(values.get("size_mm"))

            existing = await session.execute(
                select(Coil).where(Coil.plant_id == plant_id, Coil.coil_no == coil_no)
            )
            coil = existing.scalar_one_or_none()
            if coil:
                coil.work_order_no = work_order_no
                coil.grade_id = grade_id
                coil.heat_run_id = heat_run_id
                coil.heat_no = heat_no
                coil.size_mm = size_mm
                coil.source_run_id = run_id
                coil.department_id = dept_id
                if coil.status == CoilStatus.COMPLETED:
                    coil.status = CoilStatus.REGISTERED
            else:
                session.add(
                    Coil(
                        plant_id=plant_id,
                        department_id=dept_id,
                        coil_no=coil_no,
                        work_order_no=work_order_no,
                        grade_id=grade_id,
                        heat_run_id=heat_run_id,
                        heat_no=heat_no,
                        size_mm=size_mm,
                        status=CoilStatus.REGISTERED,
                        source_run_id=run_id,
                        registered_by=user_id,
                    )
                )

    async def sync_furnace_output(
        self,
        session: AsyncSession,
        plant_id: UUID,
        section_data: dict,
    ) -> None:
        rows = section_data.get("rows", [])
        if not isinstance(rows, list):
            return

        for row in rows:
            if not isinstance(row, dict):
                continue
            values = _row_values(row)
            coil_id = _parse_coil_ref(values, "coil_ref")
            if not coil_id:
                continue
            coil = await session.get(Coil, coil_id)
            if coil and coil.plant_id == plant_id:
                coil.status = CoilStatus.COMPLETED

    async def sync_drawing_input(
        self,
        session: AsyncSession,
        plant_id: UUID,
        section_data: dict,
    ) -> None:
        rows = section_data.get("rows", [])
        if not isinstance(rows, list):
            return

        for row in rows:
            if not isinstance(row, dict):
                continue
            values = _row_values(row)
            coil_id = _parse_coil_ref(values, "inlet_coil_ref", "coil_ref")
            if not coil_id:
                continue
            coil = await session.get(Coil, coil_id)
            if not coil or coil.plant_id != plant_id:
                continue

            work_order_no = values.get("work_order_no")
            coil.work_order_no = str(work_order_no).strip() if work_order_no else coil.work_order_no
            grade_id = _parse_uuid(values.get("grade_id"))
            if grade_id:
                coil.grade_id = grade_id
            heat_run_id, heat_no = _parse_heat(values)
            if heat_run_id:
                coil.heat_run_id = heat_run_id
            if heat_no:
                coil.heat_no = heat_no
            inlet_size = _parse_size(values.get("inlet_size_mm"))
            if inlet_size is not None:
                coil.size_mm = inlet_size

    async def sync_drawing_output(
        self,
        session: AsyncSession,
        run_id: UUID,
        plant_id: UUID,
        dept_id: UUID,
        user_id: UUID,
        section_data: dict,
    ) -> None:
        rows = section_data.get("rows", [])
        if not isinstance(rows, list):
            return

        for row in rows:
            if not isinstance(row, dict):
                continue
            values = _row_values(row)
            inlet_id = _parse_coil_ref(values, "inlet_coil_ref", "coil_ref")
            finish_no = values.get("finish_coil_no")
            if not finish_no or not str(finish_no).strip():
                continue
            finish_no = str(finish_no).strip()

            outlet_size = _parse_size(values.get("outlet_size_mm"))
            weight_kg = _parse_size(values.get("weight_kg"))

            if inlet_id:
                inlet = await session.get(Coil, inlet_id)
                if inlet and inlet.plant_id == plant_id:
                    inlet.status = CoilStatus.CONSUMED

            heat_run_id, heat_no = _parse_heat(values)
            grade_id = _parse_uuid(values.get("grade_id"))
            if inlet_id and not grade_id:
                inlet = await session.get(Coil, inlet_id)
                if inlet:
                    grade_id = inlet.grade_id
                    heat_run_id = heat_run_id or inlet.heat_run_id
                    heat_no = heat_no or inlet.heat_no

            existing = await session.execute(
                select(Coil).where(Coil.plant_id == plant_id, Coil.coil_no == finish_no)
            )
            finish = existing.scalar_one_or_none()
            if finish:
                finish.size_mm = outlet_size if outlet_size is not None else finish.size_mm
                finish.weight_kg = weight_kg if weight_kg is not None else finish.weight_kg
                finish.parent_coil_id = inlet_id or finish.parent_coil_id
                finish.source_run_id = run_id
                finish.department_id = dept_id
            else:
                session.add(
                    Coil(
                        plant_id=plant_id,
                        department_id=dept_id,
                        coil_no=finish_no,
                        grade_id=grade_id,
                        heat_run_id=heat_run_id,
                        heat_no=heat_no,
                        size_mm=outlet_size,
                        weight_kg=weight_kg,
                        status=CoilStatus.REGISTERED,
                        parent_coil_id=inlet_id,
                        source_run_id=run_id,
                        registered_by=user_id,
                    )
                )

    async def list_coils_for_run(
        self, session: AsyncSession, run_id: UUID, plant_id: UUID
    ) -> list[CoilResponse]:
        result = await session.execute(
            select(Coil)
            .where(
                Coil.plant_id == plant_id,
                or_(
                    Coil.source_run_id == run_id,
                    Coil.status.in_([CoilStatus.REGISTERED, CoilStatus.IN_FURNACE]),
                ),
            )
            .order_by(Coil.coil_no)
        )
        coils = result.scalars().unique().all()
        return [CoilResponse.model_validate(c) for c in coils]

    async def list_coils_for_drawing(
        self, session: AsyncSession, run_id: UUID, plant_id: UUID
    ) -> list[CoilResponse]:
        result = await session.execute(
            select(Coil)
            .where(
                Coil.plant_id == plant_id,
                or_(
                    Coil.source_run_id == run_id,
                    Coil.status == CoilStatus.COMPLETED,
                ),
            )
            .order_by(Coil.coil_no)
        )
        coils = result.scalars().unique().all()
        return [CoilResponse.model_validate(c) for c in coils]

    async def lookup_coil(
        self, session: AsyncSession, plant_id: UUID, coil_no: str, *, limit: int = 20
    ) -> list[CoilLookupResponse]:
        pattern = coil_no.strip()
        if not pattern:
            return []
        result = await session.execute(
            select(Coil)
            .where(Coil.plant_id == plant_id, Coil.coil_no.ilike(f"%{pattern}%"))
            .order_by(Coil.coil_no)
            .limit(limit)
        )
        return [
            CoilLookupResponse(
                id=c.id,
                coil_no=c.coil_no,
                status=c.status,
                work_order_no=c.work_order_no,
                grade_id=c.grade_id,
                heat_no=c.heat_no,
                size_mm=c.size_mm,
                weight_kg=c.weight_kg,
                parent_coil_id=c.parent_coil_id,
            )
            for c in result.scalars()
        ]
