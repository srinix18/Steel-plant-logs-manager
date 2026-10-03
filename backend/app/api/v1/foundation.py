from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from app.services.storage import file_response

from app.api.deps import CeoUser, CurrentUser, DbSession
from app.schemas.foundation import (
    ApprovalRecordResponse,
    ApprovalTransition,
    AssetAdminCreate,
    AssetAdminResponse,
    AssetAdminUpdate,
    AssetEventCreate,
    AssetEventResponse,
    AssetGroupCreate,
    AssetGroupResponse,
    AssetResponsibilityCreate,
    AssetResponsibilityResponse,
    ContractorReadResponse,
    CustomerAdminResponse,
    CustomerCreate,
    CustomerUpdate,
    DelayCodeAdminResponse,
    DelayCodeCreate,
    DelayCodeUpdate,
    DocumentResponse,
    DocumentUploadMeta,
    FoundationCorrectiveActionCreate,
    FoundationCorrectiveActionResponse,
    FoundationCorrectiveActionUpdate,
    FoundationObservationCreate,
    FoundationObservationResponse,
    FoundationObservationUpdate,
    KpiDefinitionAdminResponse,
    KpiDefinitionCreate,
    KpiDefinitionUpdate,
    MaterialAdminResponse,
    MaterialCreate,
    MaterialUpdate,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    SteelGradeAdminResponse,
    SteelGradeCreate,
    SteelGradeUpdate,
)
from app.services.access_scope import (
    assert_can_manage_assets,
    assert_can_manage_masters,
    assert_can_view_documents,
    assert_can_view_foundation,
    is_hod_tier,
)
from app.services.approval_service import ApprovalService
from app.services.asset_service import AssetService
from app.services.document_service import DocumentService
from app.services.foundation_observation_service import FoundationObservationService, KpiAdminService
from app.services.masters_service import MastersService
from app.models.enums import DocumentCategory

router = APIRouter()
masters_service = MastersService()
asset_service = AssetService()
document_service = DocumentService()
approval_service = ApprovalService()
observation_service = FoundationObservationService()
kpi_service = KpiAdminService()


# --- Masters ---


@router.get("/masters/grades", response_model=list[SteelGradeAdminResponse])
async def list_master_grades(session: DbSession, user: CurrentUser):
    assert_can_view_foundation(user)
    return await masters_service.list_grades(session, user)


@router.post("/masters/grades", response_model=SteelGradeAdminResponse, status_code=201)
async def create_master_grade(data: SteelGradeCreate, session: DbSession, user: CeoUser):
    assert_can_manage_masters(user)
    return await masters_service.create_grade(session, data)


@router.patch("/masters/grades/{grade_id}", response_model=SteelGradeAdminResponse)
async def update_master_grade(grade_id: UUID, data: SteelGradeUpdate, session: DbSession, user: CeoUser):
    assert_can_manage_masters(user)
    return await masters_service.update_grade(session, grade_id, data)


@router.get("/masters/materials", response_model=list[MaterialAdminResponse])
async def list_master_materials(session: DbSession, user: CurrentUser):
    assert_can_view_foundation(user)
    return await masters_service.list_materials(session, user)


@router.post("/masters/materials", response_model=MaterialAdminResponse, status_code=201)
async def create_master_material(data: MaterialCreate, session: DbSession, user: CeoUser):
    assert_can_manage_masters(user)
    return await masters_service.create_material(session, data)


@router.patch("/masters/materials/{material_id}", response_model=MaterialAdminResponse)
async def update_master_material(material_id: UUID, data: MaterialUpdate, session: DbSession, user: CeoUser):
    assert_can_manage_masters(user)
    return await masters_service.update_material(session, material_id, data)


@router.get("/masters/products", response_model=list[ProductResponse])
async def list_master_products(session: DbSession, user: CurrentUser):
    assert_can_view_foundation(user)
    return await masters_service.list_products(session, user)


@router.post("/masters/products", response_model=ProductResponse, status_code=201)
async def create_master_product(data: ProductCreate, session: DbSession, user: CeoUser):
    assert_can_manage_masters(user)
    return await masters_service.create_product(session, data)


@router.patch("/masters/products/{product_id}", response_model=ProductResponse)
async def update_master_product(product_id: UUID, data: ProductUpdate, session: DbSession, user: CeoUser):
    assert_can_manage_masters(user)
    return await masters_service.update_product(session, product_id, data)


@router.get("/masters/customers", response_model=list[CustomerAdminResponse])
async def list_master_customers(session: DbSession, user: CurrentUser, plant_id: UUID | None = None):
    assert_can_view_foundation(user)
    return await masters_service.list_customers(session, plant_id)


@router.post("/masters/customers", response_model=CustomerAdminResponse, status_code=201)
async def create_master_customer(data: CustomerCreate, session: DbSession, user: CeoUser):
    assert_can_manage_masters(user)
    return await masters_service.create_customer(session, data)


@router.patch("/masters/customers/{customer_id}", response_model=CustomerAdminResponse)
async def update_master_customer(customer_id: UUID, data: CustomerUpdate, session: DbSession, user: CeoUser):
    assert_can_manage_masters(user)
    return await masters_service.update_customer(session, customer_id, data)


@router.get("/masters/delay-codes", response_model=list[DelayCodeAdminResponse])
async def list_master_delay_codes(session: DbSession, user: CurrentUser, plant_id: UUID | None = None):
    assert_can_view_foundation(user)
    return await masters_service.list_delay_codes(session, plant_id)


@router.post("/masters/delay-codes", response_model=DelayCodeAdminResponse, status_code=201)
async def create_master_delay_code(data: DelayCodeCreate, session: DbSession, user: CeoUser):
    assert_can_manage_masters(user)
    return await masters_service.create_delay_code(session, data)


@router.patch("/masters/delay-codes/{code_id}", response_model=DelayCodeAdminResponse)
async def update_master_delay_code(code_id: UUID, data: DelayCodeUpdate, session: DbSession, user: CeoUser):
    assert_can_manage_masters(user)
    return await masters_service.update_delay_code(session, code_id, data)


@router.get("/masters/contractors", response_model=list[ContractorReadResponse])
async def list_master_contractors(session: DbSession, user: CurrentUser):
    assert_can_view_foundation(user)
    return await masters_service.list_contractors(session, user)


# --- Assets ---


@router.get("/foundation/asset-groups", response_model=list[AssetGroupResponse])
async def list_asset_groups(session: DbSession, user: CurrentUser, plant_id: UUID | None = None):
    assert_can_view_foundation(user)
    return await asset_service.list_groups(session, plant_id)


@router.post("/foundation/asset-groups", response_model=AssetGroupResponse, status_code=201)
async def create_asset_group(data: AssetGroupCreate, session: DbSession, user: CurrentUser):
    assert_can_manage_assets(user)
    return await asset_service.create_group(session, data)


@router.get("/foundation/assets", response_model=list[AssetAdminResponse])
async def list_foundation_assets(
    session: DbSession,
    user: CurrentUser,
    plant_id: UUID | None = None,
    group_id: UUID | None = None,
    department_id: UUID | None = None,
    status: str | None = None,
):
    assert_can_view_foundation(user)
    return await asset_service.list_assets(session, plant_id, group_id, department_id, status)


@router.get("/foundation/assets/{asset_id}", response_model=AssetAdminResponse)
async def get_foundation_asset(asset_id: UUID, session: DbSession, user: CurrentUser):
    assert_can_view_foundation(user)
    return await asset_service.get_asset(session, asset_id)


@router.post("/foundation/assets", response_model=AssetAdminResponse, status_code=201)
async def create_foundation_asset(data: AssetAdminCreate, session: DbSession, user: CurrentUser):
    assert_can_manage_assets(user)
    return await asset_service.create_asset(session, data)


@router.patch("/foundation/assets/{asset_id}", response_model=AssetAdminResponse)
async def update_foundation_asset(asset_id: UUID, data: AssetAdminUpdate, session: DbSession, user: CurrentUser):
    assert_can_manage_assets(user)
    return await asset_service.update_asset(session, asset_id, data)


@router.get("/foundation/assets/{asset_id}/events", response_model=list[AssetEventResponse])
async def list_asset_events(asset_id: UUID, session: DbSession, user: CurrentUser):
    assert_can_view_foundation(user)
    return await asset_service.list_events(session, asset_id)


@router.get("/foundation/assets/{asset_id}/maintenance-history")
async def get_asset_maintenance_history(asset_id: UUID, session: DbSession, user: CurrentUser):
    assert_can_view_foundation(user)
    return await asset_service.get_maintenance_history(session, asset_id)


@router.post("/foundation/assets/{asset_id}/events", response_model=AssetEventResponse, status_code=201)
async def create_asset_event(asset_id: UUID, data: AssetEventCreate, session: DbSession, user: CurrentUser):
    assert_can_view_foundation(user)
    return await asset_service.create_manual_event(session, asset_id, data)


@router.get("/foundation/assets/{asset_id}/responsibilities", response_model=list[AssetResponsibilityResponse])
async def list_asset_responsibilities(asset_id: UUID, session: DbSession, user: CurrentUser):
    assert_can_view_foundation(user)
    return await asset_service.list_responsibilities(session, asset_id)


@router.post(
    "/foundation/assets/{asset_id}/responsibilities",
    response_model=AssetResponsibilityResponse,
    status_code=201,
)
async def add_asset_responsibility(
    asset_id: UUID, data: AssetResponsibilityCreate, session: DbSession, user: CurrentUser
):
    assert_can_manage_assets(user)
    return await asset_service.add_responsibility(session, asset_id, data)


@router.delete("/foundation/assets/responsibilities/{resp_id}", status_code=204)
async def remove_asset_responsibility(resp_id: UUID, session: DbSession, user: CurrentUser):
    assert_can_manage_assets(user)
    await asset_service.remove_responsibility(session, resp_id)


# --- Observations & Corrective Actions ---


@router.get("/foundation/observations", response_model=list[FoundationObservationResponse])
async def list_foundation_observations(
    session: DbSession, user: CurrentUser, plant_id: UUID | None = None, status: str | None = None
):
    assert_can_view_foundation(user)
    return await observation_service.list_observations(session, user, plant_id, status)


@router.post("/foundation/observations", response_model=FoundationObservationResponse, status_code=201)
async def create_foundation_observation(data: FoundationObservationCreate, session: DbSession, user: CurrentUser):
    assert_can_view_foundation(user)
    return await observation_service.create_observation(session, user, data)


@router.patch("/foundation/observations/{obs_id}", response_model=FoundationObservationResponse)
async def update_foundation_observation(
    obs_id: UUID, data: FoundationObservationUpdate, session: DbSession, user: CurrentUser
):
    assert_can_view_foundation(user)
    return await observation_service.update_observation(session, obs_id, data)


@router.get("/foundation/corrective-actions", response_model=list[FoundationCorrectiveActionResponse])
async def list_foundation_corrective_actions(
    session: DbSession, user: CurrentUser, plant_id: UUID | None = None, status: str | None = None
):
    assert_can_view_foundation(user)
    return await observation_service.list_corrective_actions(session, user, plant_id, status)


@router.post(
    "/foundation/observations/{observation_id}/corrective-actions",
    response_model=FoundationCorrectiveActionResponse,
    status_code=201,
)
async def create_foundation_corrective_action(
    observation_id: UUID,
    data: FoundationCorrectiveActionCreate,
    session: DbSession,
    user: CurrentUser,
):
    assert_can_view_foundation(user)
    return await observation_service.create_corrective_action(session, user, observation_id, data)


@router.patch("/foundation/corrective-actions/{action_id}", response_model=FoundationCorrectiveActionResponse)
async def update_foundation_corrective_action(
    action_id: UUID, data: FoundationCorrectiveActionUpdate, session: DbSession, user: CurrentUser
):
    assert_can_view_foundation(user)
    return await observation_service.update_corrective_action(session, user, action_id, data)


# --- Documents ---


@router.get("/foundation/documents", response_model=list[DocumentResponse])
async def list_documents(
    session: DbSession,
    user: CurrentUser,
    plant_id: UUID | None = None,
    department_id: UUID | None = None,
    category: str | None = None,
):
    assert_can_view_documents(user)
    return await document_service.list_documents(session, user, plant_id, department_id, category)


@router.post("/foundation/documents", response_model=DocumentResponse, status_code=201)
async def upload_document(
    session: DbSession,
    user: CurrentUser,
    plant_id: UUID = Form(...),
    department_id: UUID = Form(...),
    category: DocumentCategory = Form(...),
    title: str = Form(...),
    version: str = Form("1.0"),
    file: UploadFile = File(...),
):
    assert_can_view_documents(user)
    if not (is_hod_tier(user) or user.role.value in ("super_admin", "admin", "ceo", "org_admin", "hr")):
        raise HTTPException(status_code=403, detail="Only HoD or above can upload documents")
    meta = DocumentUploadMeta(
        plant_id=plant_id,
        department_id=department_id,
        category=category,
        title=title,
        version=version,
    )
    return await document_service.upload_document(session, user, meta, file)


@router.get("/foundation/documents/{doc_id}/download")
async def download_document(doc_id: UUID, session: DbSession, user: CurrentUser):
    assert_can_view_documents(user)
    doc, data = await document_service.get_document_file(session, doc_id, user)
    return file_response(data, doc.mime_type, doc.file_name)


# --- Approvals ---


@router.get("/foundation/approvals/{entity_type}/{entity_id}", response_model=list[ApprovalRecordResponse])
async def list_approval_records(entity_type: str, entity_id: UUID, session: DbSession, user: CurrentUser):
    assert_can_view_foundation(user)
    return await approval_service.list_records(session, entity_type, entity_id)


@router.post("/foundation/approvals/{entity_type}/{entity_id}/transition", response_model=ApprovalRecordResponse)
async def approval_transition(
    entity_type: str,
    entity_id: UUID,
    data: ApprovalTransition,
    session: DbSession,
    user: CurrentUser,
):
    assert_can_view_foundation(user)
    return await approval_service.transition(session, user, entity_type, entity_id, data)


# --- KPI Definitions ---


@router.get("/foundation/kpi-definitions", response_model=list[KpiDefinitionAdminResponse])
async def list_kpi_definitions(session: DbSession, user: CurrentUser):
    assert_can_view_foundation(user)
    return await kpi_service.list_definitions(session)


@router.post("/foundation/kpi-definitions", response_model=KpiDefinitionAdminResponse, status_code=201)
async def create_kpi_definition(data: KpiDefinitionCreate, session: DbSession, user: CeoUser):
    assert_can_manage_masters(user)
    return await kpi_service.create_definition(session, data)


@router.patch("/foundation/kpi-definitions/{kpi_id}", response_model=KpiDefinitionAdminResponse)
async def update_kpi_definition(kpi_id: UUID, data: KpiDefinitionUpdate, session: DbSession, user: CeoUser):
    assert_can_manage_masters(user)
    return await kpi_service.update_definition(session, kpi_id, data)
