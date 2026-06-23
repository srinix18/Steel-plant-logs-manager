"""Additive seed for Bright Bar Production Register F51 PR 39/005/01-13."""

from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Asset,
    AssetGroup,
    Customer,
    Process,
    ProcessInstance,
    Template,
    TemplateField,
    TemplateSection,
    TemplateVersion,
    WorkflowDefinition,
    WorkflowState,
    WorkflowTransitionDef,
)
from app.models.enums import FieldType, ProcessInstanceStatus, TemplateScopeType, TemplateVersionStatus
from app.utils.chandan_org import get_chandan_department, get_chandan_organisation, get_chandan_plant

DOC_NO = "F51 PR 39/005/01-13"

PRODUCTION_REGISTER_COLUMNS = [
    {"key": "r_size_mm", "label": "R Size", "type": "number"},
    {"key": "grade_id", "label": "Grade", "type": "grade_ref"},
    {"key": "final_size_mm", "label": "Final Size", "type": "number"},
    {"key": "heat_no", "label": "H. No", "type": "heat_ref"},
    {"key": "coil_weight_kg", "label": "Coil Weight", "type": "number"},
    {"key": "coil_count", "label": "No of Coil", "type": "integer"},
    {
        "key": "total_weight_kg",
        "label": "Total Weight",
        "type": "calculated",
        "formula": "coil_weight_kg * coil_count",
    },
    {"key": "customer_id", "label": "Customer", "type": "customer_ref"},
]

DEFAULT_CUSTOMERS: list[tuple[str, str]] = [
    ("TATA", "Tata"),
    ("ASHOK", "Ashok Leyland"),
    ("ABC", "ABC Engineering"),
]


async def _get_or_create_asset_group(session: AsyncSession, plant_id, code: str, name: str) -> AssetGroup:
    result = await session.execute(
        select(AssetGroup).where(AssetGroup.plant_id == plant_id, AssetGroup.code == code)
    )
    grp = result.scalar_one_or_none()
    if grp:
        return grp
    grp = AssetGroup(plant_id=plant_id, code=code, name=name)
    session.add(grp)
    await session.flush()
    return grp


async def seed_customers(session: AsyncSession, plant_id: UUID) -> None:
    for code, name in DEFAULT_CUSTOMERS:
        existing = await session.execute(
            select(Customer).where(Customer.plant_id == plant_id, Customer.name == name)
        )
        if existing.scalar_one_or_none():
            continue
        session.add(Customer(plant_id=plant_id, name=name, code=code, is_active=True))
    await session.flush()


async def seed_bright_bar_template(session: AsyncSession) -> None:
    org = await get_chandan_organisation(session)
    if not org:
        return

    tpl_result = await session.execute(select(Template).where(Template.doc_no == DOC_NO))
    if tpl_result.scalar_one_or_none():
        return

    plant = await get_chandan_plant(session, org.id)
    if not plant:
        return

    await seed_customers(session, plant.id)

    dept = await get_chandan_department(session, plant.id, "BBD")
    if not dept:
        return

    lines_grp = await _get_or_create_asset_group(session, plant.id, "bright_bar_lines", "Bright Bar Lines")
    await session.flush()

    proc_result = await session.execute(
        select(Process).where(Process.department_id == dept.id, Process.code == "BBAR")
    )
    bbar_process = proc_result.scalar_one_or_none()
    if not bbar_process:
        bbar_process = Process(
            department_id=dept.id,
            code="BBAR",
            name="Bright Bar Production",
            description="Bright Bar Production Register",
        )
        session.add(bbar_process)
        await session.flush()

    asset_result = await session.execute(
        select(Asset).where(Asset.plant_id == plant.id, Asset.asset_no == "BB-01")
    )
    line_asset = asset_result.scalar_one_or_none()
    if not line_asset:
        line_asset = Asset(
            group_id=lines_grp.id,
            plant_id=plant.id,
            asset_no="BB-01",
            name="Bright Bar Production Line",
            plc_tag_prefix="BB1.",
            life_counters={"days": 0},
        )
        session.add(line_asset)
        await session.flush()

    inst_result = await session.execute(
        select(ProcessInstance).where(
            ProcessInstance.process_id == bbar_process.id,
            ProcessInstance.asset_id == line_asset.id,
        )
    )
    if not inst_result.scalar_one_or_none():
        session.add(
            ProcessInstance(
                process_id=bbar_process.id,
                asset_id=line_asset.id,
                name=line_asset.name,
                status=ProcessInstanceStatus.ACTIVE,
            )
        )
        await session.flush()

    template = Template(
        scope_type=TemplateScopeType.PROCESS,
        scope_id=bbar_process.id,
        doc_no=DOC_NO,
        name="Bright Bar Production Register",
    )
    session.add(template)
    await session.flush()
    bbar_process.default_template_id = template.id

    rev01 = TemplateVersion(
        template_id=template.id,
        rev_no="01",
        status=TemplateVersionStatus.PUBLISHED,
        effective_from=date(2026, 1, 1),
        published_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        change_summary="Initial digital revision — Bright Bar Production Register",
        is_immutable=True,
    )
    session.add(rev01)
    await session.flush()

    sections_spec = [
        ("register_header", "Register Header", "fields", 0, [
            ("date", "Date", FieldType.DATE, True),
        ]),
        ("production_register", "Production Register", "production_register_table", 1, []),
        ("approvals", "Sign-offs", "fields", 2, [
            ("approved_by", "Approved By", FieldType.SIGNATURE, False),
        ]),
    ]

    for key, title, stype, order, fields in sections_spec:
        config: dict = {}
        if key == "production_register":
            config = {"columns": PRODUCTION_REGISTER_COLUMNS, "default_empty_rows": 10}

        section = TemplateSection(
            version_id=rev01.id,
            key=key,
            title=title,
            section_type=stype,
            sort_order=order,
            config=config,
        )
        session.add(section)
        await session.flush()
        for idx, field_spec in enumerate(fields):
            name, label, ftype, required = field_spec[:4]
            fconfig = field_spec[4] if len(field_spec) > 4 else {}
            formula = field_spec[5] if len(field_spec) > 5 else None
            session.add(
                TemplateField(
                    section_id=section.id,
                    name=name,
                    label=label,
                    field_type=ftype,
                    required=required,
                    sort_order=idx,
                    config=fconfig,
                    formula=formula,
                )
            )

    wf = WorkflowDefinition(
        version_id=rev01.id, name="Bright Bar Daily Register Workflow", initial_state="created"
    )
    session.add(wf)
    await session.flush()

    for key, label, terminal, color in [
        ("created", "Created", False, "gray"),
        ("in_progress", "In Progress", False, "blue"),
        ("completed", "Completed", False, "green"),
        ("approved", "Approved", False, "teal"),
        ("closed", "Closed", True, "slate"),
        ("aborted", "Aborted", True, "red"),
    ]:
        session.add(WorkflowState(definition_id=wf.id, key=key, label=label, is_terminal=terminal, color=color))

    for from_s, to_s, label, roles in [
        ("created", "in_progress", "Start Register", ["worker", "supervisor", "plant_admin", "super_admin"]),
        ("in_progress", "completed", "Complete", ["worker", "supervisor"]),
        ("completed", "approved", "Approve", ["supervisor", "plant_admin"]),
        ("approved", "closed", "Close", ["supervisor", "plant_admin"]),
        ("in_progress", "aborted", "Abort", ["supervisor", "plant_admin"]),
    ]:
        session.add(
            WorkflowTransitionDef(
                definition_id=wf.id,
                from_state=from_s,
                to_state=to_s,
                label=label,
                allowed_roles=list(roles),
            )
        )
    await session.flush()
