"""Additive seed for Concast Log Sheet F/PRD/04 — safe on existing Chandan Steel databases."""

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

CASTING_COLUMNS = [
    {"key": "heat_no", "label": "Heat No.", "type": "text", "group": "Basic"},
    {"key": "grade_id", "label": "Grade", "type": "grade_ref", "group": "Basic"},
    {"key": "liquidus_temp", "label": "Liquidus Temp.", "type": "number", "group": "Basic"},
    {"key": "section", "label": "Section", "type": "text", "group": "Basic"},
    {"key": "casting_powder", "label": "Casting Powder", "type": "text", "group": "Basic"},
    {"key": "tundish_no", "label": "Tundish No.", "type": "text", "group": "Basic"},
    {"key": "start_pouring", "label": "Start Pouring", "type": "datetime", "group": "Timing"},
    {"key": "casting_begin", "label": "Casting Begin", "type": "datetime", "group": "Timing"},
    {"key": "pouring_tundish", "label": "Pouring Tundish", "type": "datetime", "group": "Timing"},
    {
        "key": "ladle_temp",
        "label": "Ladle Temp °C",
        "type": "object",
        "group": "Ladle Temp",
        "fields": [
            {"key": "before_purging", "label": "Before Purging", "type": "number"},
            {"key": "after_purging", "label": "After Purging", "type": "number"},
        ],
    },
    {"key": "purging_time", "label": "Purging Time", "type": "time_range", "group": "Purging Time"},
    {"key": "tundish_temp", "label": "Tundish Temp.", "type": "number", "group": "Tundish"},
    {
        "key": "casting_speed",
        "label": "Casting Speed Mtrs./Min",
        "type": "strand_pair",
        "subtype": "number",
        "group": "Casting Speed",
    },
    {
        "key": "cast_start",
        "label": "Cast Start",
        "type": "strand_pair",
        "subtype": "datetime",
        "group": "Cast Start",
    },
    {
        "key": "cast_end",
        "label": "Cast End",
        "type": "strand_pair",
        "subtype": "datetime",
        "group": "Cast End",
    },
    {
        "key": "water_flow_primary",
        "label": "Water Flow Rate (Primary) Lit/Min",
        "type": "strand_pair",
        "subtype": "number",
        "group": "Water Flow Primary",
    },
    {
        "key": "delta_t",
        "label": "Delta T",
        "type": "strand_pair",
        "subtype": "number",
        "group": "Delta T",
    },
    {
        "key": "water_flow_secondary",
        "label": "Water Flow Rate (Secondary) Lit/Min",
        "type": "zone_strand",
        "subtype": "number",
        "group": "Water Flow Secondary",
        "zones": ["zone_1", "zone_2"],
    },
    {
        "key": "mould_tube",
        "label": "Mould Tube",
        "type": "mould_tube",
        "group": "Mould Tube",
        "asset_group": "mould_tubes",
    },
    {"key": "sen_preheating", "label": "Sen Pre-heating time", "type": "time_range", "group": "Sen Pre-heating"},
    {
        "key": "withdrawal_pressure",
        "label": "Withdrawal Pressure kg./cm²",
        "type": "strand_pair",
        "subtype": "number",
        "group": "Withdrawal Pressure",
    },
    {"key": "billets_count", "label": "No. of Billets", "type": "integer", "group": "Output"},
    {"key": "supervisor", "label": "Supervisor", "type": "text", "group": "Output"},
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


async def seed_concast_template(session: AsyncSession) -> None:
    org = await get_chandan_organisation(session)
    if not org:
        return

    tpl_result = await session.execute(select(Template).where(Template.doc_no == "F/PRD/04"))
    if tpl_result.scalar_one_or_none():
        return

    plant = await get_chandan_plant(session, org.id)
    if not plant:
        return

    dept = await get_chandan_department(session, plant.id, "SMS")
    if not dept:
        return

    casters_grp = await _get_or_create_asset_group(session, plant.id, "casters", "Casters")
    tundishes_grp = await _get_or_create_asset_group(session, plant.id, "tundishes", "Tundishes")
    mould_tubes_grp = await _get_or_create_asset_group(session, plant.id, "mould_tubes", "Mould Tubes")
    await session.flush()

    proc_result = await session.execute(select(Process).where(Process.department_id == dept.id, Process.code == "CCM"))
    ccm_process = proc_result.scalar_one_or_none()
    if not ccm_process:
        return

    caster_result = await session.execute(
        select(Asset).where(Asset.plant_id == plant.id, Asset.asset_no == "CCM-01")
    )
    caster_asset = caster_result.scalar_one_or_none()
    if not caster_asset:
        caster_asset = Asset(
            group_id=casters_grp.id,
            plant_id=plant.id,
            asset_no="CCM-01",
            name="CCM #1",
            plc_tag_prefix="CCM1.",
            life_counters={"heats": 0},
        )
        session.add(caster_asset)
        await session.flush()

    for i in range(1, 4):
        asset_no = f"TND-{i:02d}"
        existing = await session.execute(
            select(Asset).where(Asset.plant_id == plant.id, Asset.asset_no == asset_no)
        )
        if existing.scalar_one_or_none():
            continue
        session.add(
            Asset(
                group_id=tundishes_grp.id,
                plant_id=plant.id,
                asset_no=asset_no,
                name=f"Tundish #{i}",
                life_counters={"heats": 0},
            )
        )

    for i in range(1, 6):
        asset_no = f"MT-{i:02d}"
        existing = await session.execute(
            select(Asset).where(Asset.plant_id == plant.id, Asset.asset_no == asset_no)
        )
        if existing.scalar_one_or_none():
            continue
        session.add(
            Asset(
                group_id=mould_tubes_grp.id,
                plant_id=plant.id,
                asset_no=asset_no,
                name=f"Mould Tube #{i}",
                life_counters={"casts": 0},
            )
        )
    await session.flush()

    inst_result = await session.execute(
        select(ProcessInstance).where(
            ProcessInstance.process_id == ccm_process.id,
            ProcessInstance.asset_id == caster_asset.id,
        )
    )
    if not inst_result.scalar_one_or_none():
        session.add(
            ProcessInstance(
                process_id=ccm_process.id,
                asset_id=caster_asset.id,
                name=caster_asset.name,
                status=ProcessInstanceStatus.ACTIVE,
            )
        )
    await session.flush()

    template = Template(
        scope_type=TemplateScopeType.PROCESS,
        scope_id=ccm_process.id,
        doc_no="F/PRD/04",
        name="Concast Log Sheet",
    )
    session.add(template)
    await session.flush()
    ccm_process.default_template_id = template.id

    rev01 = TemplateVersion(
        template_id=template.id,
        rev_no="01",
        status=TemplateVersionStatus.PUBLISHED,
        effective_from=date(2023, 9, 1),
        published_at=datetime(2023, 9, 1, tzinfo=timezone.utc),
        change_summary="Initial digital revision — Concast Log Sheet",
        is_immutable=True,
    )
    session.add(rev01)
    await session.flush()

    sections_spec = [
        ("shift_header", "Shift Information", "fields", 0, [
            ("date", "Date", FieldType.DATE, True),
            ("shift", "Shift", FieldType.DROPDOWN, True, {"options": ["A", "B", "C"]}),
        ]),
        ("casting_entries", "Production Entries", "production_log_table", 1, []),
        ("remarks", "Remarks", "fields", 2, [
            ("remarks", "Remarks", FieldType.TEXTAREA, False),
        ]),
        ("approvals", "Sign-offs", "fields", 3, [
            ("shift_incharge_concast", "Shift Incharge (Concast)", FieldType.SIGNATURE, False),
            ("hod_production_signoff", "HOD (Production)", FieldType.SIGNATURE, False),
        ]),
    ]

    for key, title, stype, order, fields in sections_spec:
        config: dict = {}
        if key == "casting_entries":
            config = {
                "columns": CASTING_COLUMNS,
                "default_empty_rows": 5,
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
            session.add(
                TemplateField(
                    section_id=section.id,
                    name=name,
                    label=label,
                    field_type=ftype,
                    required=required,
                    sort_order=idx,
                    config=fconfig,
                )
            )

    wf = WorkflowDefinition(version_id=rev01.id, name="Concast Shift Workflow", initial_state="created")
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
        ("created", "in_progress", "Start Shift Log", ["worker", "supervisor", "plant_admin", "super_admin"]),
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
