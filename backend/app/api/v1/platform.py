from uuid import UUID

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.db.models import (
    Asset,
    AssetGroup,
    Department,
    GradeElementSpec,
    MaterialCatalog,
    Organisation,
    Plant,
    Process,
    ProcessInstance,
    Shift,
    SteelGrade,
    User,
)
from app.schemas.moi import (
    AssetGroupResponse,
    AssetResponse,
    DepartmentResponse,
    OrganisationResponse,
    PlantResponse,
    ProcessInstanceResponse,
    ProcessResponse,
    UserBrief,
    UserProfile,
)

router = APIRouter()


@router.get("/organisations", response_model=list[OrganisationResponse])
async def list_organisations(session: DbSession, _: AdminUser):
    result = await session.execute(select(Organisation).order_by(Organisation.name))
    return [OrganisationResponse.model_validate(o) for o in result.scalars()]


@router.get("/users", response_model=list[UserBrief])
async def list_users(session: DbSession, _: AdminUser):
    result = await session.execute(select(User).order_by(User.full_name))
    return [UserBrief.model_validate(u) for u in result.scalars()]


@router.get("/plants", response_model=list[PlantResponse])
async def list_plants(session: DbSession, _: CurrentUser):
    result = await session.execute(select(Plant))
    return [PlantResponse.model_validate(p) for p in result.scalars()]


@router.get("/plants/{plant_id}/users", response_model=list[UserProfile])
async def plant_users(plant_id: UUID, session: DbSession, user: CurrentUser):
    result = await session.execute(
        select(User).where(User.plant_id == plant_id, User.is_active.is_(True)).order_by(User.full_name)
    )
    return [UserProfile.model_validate(u) for u in result.scalars()]


@router.get("/departments", response_model=list[DepartmentResponse])
async def list_departments(session: DbSession, user: CurrentUser, plant_id: UUID | None = None):
    query = select(Department)
    if plant_id:
        query = query.where(Department.plant_id == plant_id)
    result = await session.execute(query)
    return [DepartmentResponse.model_validate(d) for d in result.scalars()]


@router.get("/processes", response_model=list[ProcessResponse])
async def list_processes(session: DbSession, user: CurrentUser, department_id: UUID | None = None):
    query = select(Process)
    if department_id:
        query = query.where(Process.department_id == department_id)
    result = await session.execute(query)
    return [ProcessResponse.model_validate(p) for p in result.scalars()]


@router.get("/process-instances", response_model=list[ProcessInstanceResponse])
async def list_process_instances(session: DbSession, user: CurrentUser, process_id: UUID | None = None):
    query = select(ProcessInstance)
    if process_id:
        query = query.where(ProcessInstance.process_id == process_id)
    result = await session.execute(query)
    return [ProcessInstanceResponse.model_validate(i) for i in result.scalars()]


@router.get("/asset-groups", response_model=list[AssetGroupResponse])
async def list_asset_groups(session: DbSession, user: CurrentUser, plant_id: UUID | None = None):
    query = select(AssetGroup)
    if plant_id:
        query = query.where(AssetGroup.plant_id == plant_id)
    result = await session.execute(query)
    return [AssetGroupResponse.model_validate(g) for g in result.scalars()]


@router.get("/assets", response_model=list[AssetResponse])
async def list_assets(session: DbSession, user: CurrentUser, plant_id: UUID | None = None, group_id: UUID | None = None):
    query = select(Asset)
    if plant_id:
        query = query.where(Asset.plant_id == plant_id)
    if group_id:
        query = query.where(Asset.group_id == group_id)
    result = await session.execute(query)
    return [
        AssetResponse.model_validate(a).model_copy(update={"status": a.status.value})
        for a in result.scalars()
    ]


@router.get("/shifts")
async def list_shifts(session: DbSession, user: CurrentUser, plant_id: UUID | None = None):
    query = select(Shift)
    if plant_id:
        query = query.where(Shift.plant_id == plant_id)
    result = await session.execute(query)
    return [
        {
            "id": str(s.id),
            "plant_id": str(s.plant_id),
            "code": s.code,
            "name": s.name,
            "start_time": s.start_time.isoformat(),
            "end_time": s.end_time.isoformat(),
        }
        for s in result.scalars()
    ]


@router.get("/steel-grades")
async def list_grades(session: DbSession, user: CurrentUser):
    result = await session.execute(select(SteelGrade))
    return [{"id": str(g.id), "code": g.code, "description": g.description} for g in result.scalars()]


@router.get("/steel-grades/{grade_id}/elements")
async def list_grade_elements(grade_id: UUID, session: DbSession, _: CurrentUser):
    result = await session.execute(
        select(GradeElementSpec).where(GradeElementSpec.grade_id == grade_id).order_by(GradeElementSpec.element)
    )
    return [
        {
            "element": spec.element,
            "min_value": spec.min_value,
            "max_value": spec.max_value,
        }
        for spec in result.scalars()
    ]


@router.get("/materials")
async def list_materials(session: DbSession, _: CurrentUser, material_type: str | None = None):
    query = select(MaterialCatalog)
    if material_type:
        query = query.where(MaterialCatalog.type == material_type)
    result = await session.execute(query.order_by(MaterialCatalog.name))
    return [
        {
            "id": str(m.id),
            "code": m.code,
            "name": m.name,
            "type": m.type.value,
        }
        for m in result.scalars()
    ]
