"""Additive seed for Rolling Mill Shift Production Report F/PRD/05."""

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
from app.services.delay_event_service import seed_delay_codes
from app.utils.chandan_org import get_chandan_department, get_chandan_organisation, get_chandan_plant

ROLLING_BATCH_COLUMNS = [
    {"key": "time_start", "label": "Time Start", "type": "datetime", "group": "Batch"},
    {"key": "heat_no", "label": "Heat No.", "type": "heat_ref", "group": "Batch"},
    {"key": "grade_id", "label": "Grade", "type": "grade_ref", "group": "Batch"},
    {"key": "charged", "label": "Charged", "type": "integer", "group": "Batch"},
    {"key": "rolled", "label": "Rolled", "type": "integer", "group": "Batch"},
    {"key": "hot_out", "label": "Hot Out", "type": "integer", "group": "Batch"},
    {"key": "cobble", "label": "Cobble", "type": "integer", "group": "Batch"},
    {
        "key": "section_shape",
        "label": "Section",
        "type": "dropdown",
        "group": "Batch",
        "options": ["Round", "Square", "Hex", "Flat"],
    },
    {"key": "party", "label": "Party", "type": "text", "group": "Batch"},
    {"key": "billet_size", "label": "Billet Size", "type": "number", "group": "Batch"},
    {"key": "furnace", "label": "Furnace", "type": "furnace_zones", "group": "Furnace"},
]

HOURLY_HOURS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]
HOURLY_ROWS = [
    {"key": "delay_minutes", "label": "Delay In Min", "type": "integer"},
    {"key": "cobble", "label": "Cobble", "type": "integer"},
    {"key": "hot_out", "label": "Hot Out", "type": "integer"},
    {"key": "rolled", "label": "Rolled", "type": "integer"},
    {"key": "remarks", "label": "Remarks", "type": "text"},
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


async def seed_rolling_mill_template(session: AsyncSession) -> None:
    org = await get_chandan_organisation(session)
    if not org:
        return

    tpl_result = await session.execute(select(Template).where(Template.doc_no == "F/PRD/05"))
    if tpl_result.scalar_one_or_none():
        return

    plant = await get_chandan_plant(session, org.id)
    if not plant:
        return

    dept = await get_chandan_department(session, plant.id, "ROLLING")
    if not dept:
        return

    await seed_delay_codes(session, plant.id)

    lines_grp = await _get_or_create_asset_group(session, plant.id, "rolling_lines", "Rolling Mill Lines")
    await session.flush()

    proc_result = await session.execute(
        select(Process).where(Process.department_id == dept.id, Process.code == "RMILL")
    )
    rmill_process = proc_result.scalar_one_or_none()
    if not rmill_process:
        rmill_process = Process(
            department_id=dept.id,
            code="RMILL",
            name="Rolling Mill Production",
            description="Rolling Mill shift production report",
        )
        session.add(rmill_process)
        await session.flush()

    asset_result = await session.execute(
        select(Asset).where(Asset.plant_id == plant.id, Asset.asset_no == "RM-01")
    )
    mill_asset = asset_result.scalar_one_or_none()
    if not mill_asset:
        mill_asset = Asset(
            group_id=lines_grp.id,
            plant_id=plant.id,
            asset_no="RM-01",
            name="Rolling Mill Line",
            plc_tag_prefix="RM1.",
            life_counters={"shifts": 0},
        )
        session.add(mill_asset)
        await session.flush()

    inst_result = await session.execute(
        select(ProcessInstance).where(
            ProcessInstance.process_id == rmill_process.id,
            ProcessInstance.asset_id == mill_asset.id,
        )
    )
    if not inst_result.scalar_one_or_none():
        session.add(
            ProcessInstance(
                process_id=rmill_process.id,
                asset_id=mill_asset.id,
                name=mill_asset.name,
                status=ProcessInstanceStatus.ACTIVE,
            )
        )
        await session.flush()

    template = Template(
        scope_type=TemplateScopeType.PROCESS,
        scope_id=rmill_process.id,
        doc_no="F/PRD/05",
        name="Rolling Mill Production",
    )
    session.add(template)
    await session.flush()
    rmill_process.default_template_id = template.id

    rev01 = TemplateVersion(
        template_id=template.id,
        rev_no="01",
        status=TemplateVersionStatus.PUBLISHED,
        effective_from=date(2026, 1, 1),
        published_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        change_summary="Initial digital revision — Rolling Mill Shift Production Report",
        is_immutable=True,
    )
    session.add(rev01)
    await session.flush()

    sections_spec = [
        ("shift_details", "Shift Details", "fields", 0, [
            ("date", "Date", FieldType.DATE, True),
            ("shift", "Shift", FieldType.DROPDOWN, True, {"options": ["A", "B", "C"]}),
            ("mill_section", "Section", FieldType.DROPDOWN, True, {"options": ["Bar", "Garret", "Wire Rod"]}),
            ("group_no", "Group No.", FieldType.TEXT, False),
        ]),
        ("production_summary", "Production Summary", "fields", 1, [
            ("billets_charged", "No. of Billets Charged", FieldType.NUMBER, False),
            ("discharges", "Discharges", FieldType.NUMBER, False),
            ("cobble_summary", "Cobble", FieldType.NUMBER, False),
            ("hot_out_summary", "Hot Out", FieldType.NUMBER, False),
            ("rolled_summary", "Rolled", FieldType.NUMBER, False),
        ]),
        ("energy", "Energy Consumption", "fields", 2, [
            ("oil_consumption", "Oil Consumption", FieldType.NUMBER, False),
            ("power_consumption", "Power Consumption", FieldType.NUMBER, False),
        ]),
        ("personnel", "Shift Personnel", "fields", 3, [
            ("shift_incharge_production", "Shift Incharge Production", FieldType.USER_REF, False),
            ("mechanical_incharge", "Mechanical Incharge", FieldType.USER_REF, False),
            ("electrical_incharge", "Electrical Incharge", FieldType.USER_REF, False),
            ("main_pulpit_operator", "Main Pulpit Operator", FieldType.USER_REF, False),
            ("furnace_incharge", "Furnace Incharge / Fireman", FieldType.USER_REF, False),
            ("mill_roller", "Mill Roller", FieldType.USER_REF, False),
            ("finishing_roller", "Finishing Roller", FieldType.USER_REF, False),
        ]),
        ("delay_register", "Delay Register", "delay_register_table", 4, []),
        ("remarks", "Remarks", "fields", 5, [
            ("remarks", "Remarks", FieldType.TEXTAREA, False),
        ]),
        ("production_batches", "Production Register", "production_log_table", 6, []),
        ("hourly_matrix", "Hourly Production", "hourly_production_matrix", 7, []),
        ("approvals", "Sign-offs", "fields", 8, [
            ("prepared_by", "Prepared By", FieldType.SIGNATURE, False),
        ]),
    ]

    for key, title, stype, order, fields in sections_spec:
        config: dict = {}
        if key == "production_batches":
            config = {"columns": ROLLING_BATCH_COLUMNS, "default_empty_rows": 8}
        elif key == "hourly_matrix":
            config = {"hours": HOURLY_HOURS, "rows": HOURLY_ROWS}
        elif key == "delay_register":
            config = {"default_empty_rows": 6}

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

    wf = WorkflowDefinition(version_id=rev01.id, name="Rolling Mill Shift Workflow", initial_state="created")
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
