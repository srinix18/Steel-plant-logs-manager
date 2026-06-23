"""Additive seed for Wire Drawing / Wet Drawing Production Record Book F/PRD/07."""

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Asset,
    AssetGroup,
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

INPUT_MATERIAL_COLUMNS = [
    {"key": "work_order_no", "label": "Work Order No.", "type": "text"},
    {"key": "grade_id", "label": "Grade", "type": "grade_ref"},
    {"key": "heat_no", "label": "Heat No.", "type": "heat_ref"},
    {"key": "inlet_size_mm", "label": "Inlet Size (mm)", "type": "number"},
    {"key": "inlet_coil_ref", "label": "Inlet Coil No.", "type": "coil_ref"},
    {
        "key": "condition",
        "label": "Condition",
        "type": "dropdown",
        "options": ["Normal", "Rusty", "Damaged", "Wet", "Surface Defect"],
    },
]

OUTPUT_MATERIAL_COLUMNS = [
    {"key": "inlet_coil_ref", "label": "Inlet Coil No.", "type": "coil_ref"},
    {"key": "outlet_size_mm", "label": "Outlet Size (mm)", "type": "number"},
    {
        "key": "lubricant",
        "label": "Lubricant",
        "type": "dropdown",
        "options": ["Soap", "Drawing Powder", "Oil"],
    },
    {"key": "finish_coil_no", "label": "Finish Coil / Spool No.", "type": "text"},
    {"key": "weight_kg", "label": "Weight (Kg)", "type": "number"},
    {"key": "remark", "label": "Remark", "type": "textarea"},
]

DRAWING_ASSETS = [
    ("WD-01", "Wire Drawing Machine #1"),
    ("WD-02", "Wet Drawing Machine #1"),
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


async def seed_wire_drawing_template(session: AsyncSession) -> None:
    org = await get_chandan_organisation(session)
    if not org:
        return

    tpl_result = await session.execute(select(Template).where(Template.doc_no == "F/PRD/07"))
    if tpl_result.scalar_one_or_none():
        return

    plant = await get_chandan_plant(session, org.id)
    if not plant:
        return

    dept = await get_chandan_department(session, plant.id, "WIRE")
    if not dept:
        return

    drawing_grp = await _get_or_create_asset_group(
        session, plant.id, "wire_drawing_lines", "Wire Drawing Lines"
    )
    await session.flush()

    proc_result = await session.execute(
        select(Process).where(Process.department_id == dept.id, Process.code == "WDRAW")
    )
    wdraw_process = proc_result.scalar_one_or_none()
    if not wdraw_process:
        wdraw_process = Process(
            department_id=dept.id,
            code="WDRAW",
            name="Wire Drawing / Wet Drawing",
            description="Wire Drawing Production Record Book",
        )
        session.add(wdraw_process)
        await session.flush()

    for asset_no, asset_name in DRAWING_ASSETS:
        asset_result = await session.execute(
            select(Asset).where(Asset.plant_id == plant.id, Asset.asset_no == asset_no)
        )
        drawing_asset = asset_result.scalar_one_or_none()
        if not drawing_asset:
            tag = asset_no.replace("-", "").lower()
            drawing_asset = Asset(
                group_id=drawing_grp.id,
                plant_id=plant.id,
                asset_no=asset_no,
                name=asset_name,
                plc_tag_prefix=f"{tag}.",
                life_counters={"shifts": 0},
            )
            session.add(drawing_asset)
            await session.flush()

        inst_result = await session.execute(
            select(ProcessInstance).where(
                ProcessInstance.process_id == wdraw_process.id,
                ProcessInstance.asset_id == drawing_asset.id,
            )
        )
        if not inst_result.scalar_one_or_none():
            session.add(
                ProcessInstance(
                    process_id=wdraw_process.id,
                    asset_id=drawing_asset.id,
                    name=drawing_asset.name,
                    status=ProcessInstanceStatus.ACTIVE,
                )
            )
            await session.flush()

    template = Template(
        scope_type=TemplateScopeType.PROCESS,
        scope_id=wdraw_process.id,
        doc_no="F/PRD/07",
        name="Wire Drawing Production Record Book",
    )
    session.add(template)
    await session.flush()
    wdraw_process.default_template_id = template.id

    rev01 = TemplateVersion(
        template_id=template.id,
        rev_no="01",
        status=TemplateVersionStatus.PUBLISHED,
        effective_from=date(2026, 1, 1),
        published_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        change_summary="Initial digital revision — Wire Drawing / Wet Drawing Production Record Book",
        is_immutable=True,
    )
    session.add(rev01)
    await session.flush()

    sections_spec = [
        ("shift_details", "Shift Details", "fields", 0, [
            ("date", "Date", FieldType.DATE, True),
            ("shift", "Shift", FieldType.DROPDOWN, True, {"options": ["A", "B", "C"]}),
            ("operator", "Operator", FieldType.USER_REF, False),
        ]),
        ("input_material", "Input Material", "production_register_table", 1, []),
        ("output_material", "Output Material", "production_register_table", 2, []),
        ("approvals", "Sign-offs", "fields", 3, [
            ("prepared_by", "Prepared By", FieldType.SIGNATURE, False),
            ("approved_by", "Approved By", FieldType.SIGNATURE, False),
        ]),
    ]

    for key, title, stype, order, fields in sections_spec:
        config: dict = {}
        if key == "input_material":
            config = {
                "columns": INPUT_MATERIAL_COLUMNS,
                "default_empty_rows": 8,
                "coil_picker_purpose": "drawing",
            }
        elif key == "output_material":
            config = {
                "columns": OUTPUT_MATERIAL_COLUMNS,
                "default_empty_rows": 8,
                "coil_picker_purpose": "drawing",
            }

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
        version_id=rev01.id, name="Wire Drawing Shift Workflow", initial_state="created"
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
        ("created", "in_progress", "Start Shift Report", ["worker", "supervisor", "plant_admin", "super_admin"]),
        ("in_progress", "completed", "Complete Shift", ["worker", "supervisor"]),
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
