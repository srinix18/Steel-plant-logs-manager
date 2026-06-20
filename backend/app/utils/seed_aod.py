"""Additive seed for AOD Log Sheet F/PRD/03 — safe on existing Chandan Steel databases."""

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    SteelGrade,
    Template,
    TemplateField,
    TemplateSection,
    TemplateVersion,
    WorkflowDefinition,
    WorkflowState,
    WorkflowTransitionDef,
)
from app.models.enums import FieldType, MaterialType, ProcessInstanceStatus, TemplateScopeType, TemplateVersionStatus

AOD_ELEMENTS = ["C", "SI", "MN", "P", "S", "CR", "MO", "NI", "CU", "N2", "CO", "W", "AL", "SN", "TI"]

BLOW_PROCESS_COLUMNS = [
    {"key": "time_from", "label": "From", "group": "Time", "type": "datetime"},
    {"key": "time_to", "label": "To", "group": "Time", "type": "datetime"},
    {"key": "process_bp", "label": "B.P Kg/Cm2", "group": "Process Gas", "type": "number"},
    {"key": "process_flow_air", "label": "Flow Nm3/Hr Air", "group": "Process Gas", "type": "number"},
    {"key": "process_flow_n2", "label": "Flow Nm3/Hr N2", "group": "Process Gas", "type": "number"},
    {"key": "process_flow_ar", "label": "Flow Nm3/Hr Ar", "group": "Process Gas", "type": "number"},
    {"key": "oxygen_bp", "label": "B.P Kg/Cm2", "group": "Oxygen Gas", "type": "number"},
    {"key": "oxygen_flow", "label": "Flow Nm3/Hr", "group": "Oxygen Gas", "type": "number"},
    {"key": "shroud_press", "label": "Press Kg/Cm2", "group": "Shroud Gas", "type": "number"},
    {"key": "shroud_flow_n2", "label": "Flow Nm3/Hr N2", "group": "Shroud Gas", "type": "number"},
    {"key": "shroud_flow_ar", "label": "Flow Nm3/Hr Ar", "group": "Shroud Gas", "type": "number"},
    {"key": "lance_press", "label": "Press Kg/Cm2", "group": "O2 Top Lance", "type": "number"},
    {"key": "lance_flow", "label": "Flow Nm3/Hr", "group": "O2 Top Lance", "type": "number"},
    {"key": "consumption_o2", "label": "O2", "group": "Gas Consumption", "type": "number"},
    {"key": "consumption_n2", "label": "N2", "group": "Gas Consumption", "type": "number"},
    {"key": "consumption_ar", "label": "Ar", "group": "Gas Consumption", "type": "number"},
]

BLOW_PROCESS_ROWS = ["De-Si", "1", "2", "3", "4", "5", "VCD", "RED", "Slag off"]

SAMPLE_CHEMISTRY_ROWS = [
    "I/F-Final",
    "De-Si",
    "AOD-1",
    "AOD-2",
    "AOD-3",
    "AOD-4",
    "AOD-5",
    "RED-1",
    "RED-2",
    "Ladle-1",
    "Ladle-2",
    "Final",
]

ALLOY_MATERIALS = [
    ("FE_CR", "Fe Cr"),
    ("FE_MN", "Fe Mn"),
    ("FE_SI", "Fe Si"),
    ("FE_MO", "Fe Mo"),
    ("FE_NI", "Fe Ni"),
    ("P_NI", "P-Ni"),
    ("TI", "Ti"),
]

FLUX_MATERIALS = [
    ("304_SCRAP", "Scrap"),
    ("FE_NI", "Fe Ni"),
    ("LIME", "Lime"),
    ("DOLOMITE", "Dolomite"),
    ("CPC", "CPC"),
    ("OTHER", "Other"),
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


async def _ensure_materials(session: AsyncSession, org_id) -> None:
    catalog = [
        *[(code, name, MaterialType.ALLOY) for code, name in ALLOY_MATERIALS],
        ("LIME", "Lime", MaterialType.SCRAP),
        ("DOLOMITE", "Dolomite", MaterialType.SCRAP),
        ("CPC", "CPC", MaterialType.SCRAP),
        ("OTHER", "Other", MaterialType.SCRAP),
    ]
    for code, name, mtype in catalog:
        existing = await session.execute(
            select(MaterialCatalog).where(
                MaterialCatalog.organisation_id == org_id,
                MaterialCatalog.code == code,
            )
        )
        if existing.scalar_one_or_none():
            continue
        session.add(MaterialCatalog(organisation_id=org_id, type=mtype, code=code, name=name))
    await session.flush()


async def _ensure_grade_elements(session: AsyncSession, org_id) -> None:
    result = await session.execute(select(SteelGrade).where(SteelGrade.organisation_id == org_id, SteelGrade.code == "304"))
    grade = result.scalar_one_or_none()
    if not grade:
        return
    extra = [
        ("CU", 0.0, 0.5),
        ("N2", 0.0, 0.1),
        ("AL", 0.0, 0.05),
        ("SN", 0.0, 0.1),
        ("TI", 0.0, 0.5),
    ]
    for element, min_v, max_v in extra:
        existing = await session.execute(
            select(GradeElementSpec).where(
                GradeElementSpec.grade_id == grade.id,
                GradeElementSpec.element == element,
            )
        )
        if existing.scalar_one_or_none():
            continue
        session.add(GradeElementSpec(grade_id=grade.id, element=element, min_value=min_v, max_value=max_v))
    await session.flush()


async def seed_aod_template(session: AsyncSession) -> None:
    org_result = await session.execute(select(Organisation).where(Organisation.code == "CHANDAN"))
    org = org_result.scalar_one_or_none()
    if not org:
        return

    tpl_result = await session.execute(select(Template).where(Template.doc_no == "F/PRD/03"))
    if tpl_result.scalar_one_or_none():
        return

    plant_result = await session.execute(select(Plant).where(Plant.organisation_id == org.id, Plant.code == "SMS"))
    plant = plant_result.scalar_one_or_none()
    if not plant:
        return

    dept_result = await session.execute(
        select(Department).where(Department.plant_id == plant.id, Department.code == "SMS")
    )
    dept = dept_result.scalar_one_or_none()
    if not dept:
        return

    vessels_grp = await _get_or_create_asset_group(session, plant.id, "vessels", "AOD Vessels")
    await _get_or_create_asset_group(session, plant.id, "casting_ladles", "Casting Ladles")
    await session.flush()

    proc_result = await session.execute(select(Process).where(Process.department_id == dept.id, Process.code == "AOD"))
    aod_process = proc_result.scalar_one_or_none()
    if not aod_process:
        aod_process = Process(department_id=dept.id, code="AOD", name="Argon Oxygen Decarburization")
        session.add(aod_process)
        await session.flush()

    vessel_assets = []
    for i in range(1, 4):
        asset_result = await session.execute(
            select(Asset).where(Asset.plant_id == plant.id, Asset.asset_no == f"AOD-{i:02d}")
        )
        asset = asset_result.scalar_one_or_none()
        if not asset:
            asset = Asset(
                group_id=vessels_grp.id,
                plant_id=plant.id,
                asset_no=f"AOD-{i:02d}",
                name=f"AOD #{i}",
                plc_tag_prefix=f"AOD{i}.",
                life_counters={"heats": 0},
            )
            session.add(asset)
            await session.flush()
        vessel_assets.append(asset)

    for asset in vessel_assets:
        inst_result = await session.execute(
            select(ProcessInstance).where(
                ProcessInstance.process_id == aod_process.id,
                ProcessInstance.asset_id == asset.id,
            )
        )
        if inst_result.scalar_one_or_none():
            continue
        session.add(
            ProcessInstance(
                process_id=aod_process.id,
                asset_id=asset.id,
                name=asset.name,
                status=ProcessInstanceStatus.ACTIVE,
            )
        )
    await session.flush()

    await _ensure_materials(session, org.id)
    await _ensure_grade_elements(session, org.id)

    template = Template(
        scope_type=TemplateScopeType.PROCESS,
        scope_id=aod_process.id,
        doc_no="F/PRD/03",
        name="AOD Log Sheet",
    )
    session.add(template)
    await session.flush()
    aod_process.default_template_id = template.id

    rev02 = TemplateVersion(
        template_id=template.id,
        rev_no="02",
        status=TemplateVersionStatus.PUBLISHED,
        effective_from=date(2024, 3, 1),
        published_at=datetime(2024, 3, 1, tzinfo=timezone.utc),
        change_summary="Initial digital revision — AOD Log Sheet",
        is_immutable=True,
    )
    session.add(rev02)
    await session.flush()

    sections_spec = [
        ("heat_info", "Heat / Batch Information", "fields", 0, [
            ("date", "Date", FieldType.DATE, True),
            ("shift", "Shift", FieldType.DROPDOWN, True, {"options": ["A", "B", "C"]}),
            ("heat_no", "Heat No.", FieldType.TEXT, True),
            ("grade", "Grade", FieldType.GRADE_REF, True),
            ("billet_size", "Billet Size", FieldType.TEXT, False),
        ]),
        ("equipment_info", "Equipment Information", "fields", 1, [
            ("vessel", "Vessel No / Life", FieldType.ASSET_REF, True, {"asset_group": "vessels"}),
            ("casting_ladle", "Casting Ladle No / Life", FieldType.ASSET_REF, False, {"asset_group": "casting_ladles"}),
            ("transfer_ladle", "Transfer Ladle No / Life", FieldType.ASSET_REF, False, {"asset_group": "ladles"}),
            ("if_tapping_time", "I/F Tapping Time", FieldType.DATETIME, False, {"quick_action": "now"}),
            ("lm_pouring_time", "L.M. Pouring Time", FieldType.DATETIME, False, {"quick_action": "now"}),
        ]),
        ("personnel", "Personnel", "fields", 2, [
            ("aod_shift_incharge", "AOD Shift Incharge", FieldType.USER_REF, False),
            ("aod_melter", "AOD Melter", FieldType.USER_REF, False),
            ("if_melter", "I/F Melter", FieldType.USER_REF, False),
            ("ccm_shift_incharge", "CCM Shift Incharge", FieldType.USER_REF, False),
            ("lab_chemist", "Lab Chemist", FieldType.USER_REF, False),
        ]),
        ("weight_info", "Weight Information", "fields", 3, [
            ("transfer_ladle_weight", "Transfer Ladle Weight", FieldType.NUMBER, False),
            ("transfer_ladle_id", "Transfer Ladle ID", FieldType.ASSET_REF, False, {"asset_group": "ladles"}),
            ("final_weight", "Final Weight", FieldType.NUMBER, False),
        ]),
        ("alloy_additions", "AOD Si Blow / Ferro Alloy Additions", "static_material_table", 4, []),
        ("flux_additions", "Raw Material / Flux", "static_material_table", 5, []),
        ("blow_process", "Blow Process Table", "matrix_table", 6, []),
        ("required_chemistry", "Required Chemistry", "target_chemistry", 7, []),
        ("sample_chemistry", "Sample Chemistry", "sample_chemistry_matrix", 8, []),
        ("time_summary", "Time Summary", "fields", 9, [
            ("ladle_prepare_time", "Ladle Prepare Time", FieldType.DATETIME, False),
            ("heat_tapping_time", "Heat Tapping Time", FieldType.DATETIME, False),
            ("total_process_time", "Total Process Time", FieldType.TEXT, False),
            ("ladle_purging_time", "Ladle Purging Time", FieldType.DATETIME, False),
            ("ladle_lifting_time", "Ladle Lifting Time", FieldType.DATETIME, False),
            ("ladle_purging_temp", "Ladle Purging Temp.", FieldType.NUMBER, False),
            ("tundish_temp", "Tundish Temp.", FieldType.NUMBER, False),
            ("final_weight_summary", "Final Weight", FieldType.NUMBER, False),
        ]),
        ("gas_consumption", "Gas Consumption Summary", "fields", 10, [
            ("o2_nm3", "O2 Nm3", FieldType.NUMBER, False),
            ("n2_nm3", "N2 Nm3", FieldType.NUMBER, False),
            ("ar_nm3", "Ar Nm3", FieldType.NUMBER, False),
            ("air_nm3", "Air Nm3", FieldType.NUMBER, False),
        ]),
        ("remarks", "Remarks", "fields", 11, [
            ("remarks", "Remarks", FieldType.TEXTAREA, False),
        ]),
        ("approvals", "Approvals", "fields", 12, [
            ("shift_incharge_signoff", "Shift Incharge", FieldType.SIGNATURE, False),
            ("hod_production_signoff", "HOD Production", FieldType.SIGNATURE, False),
        ]),
    ]

    for key, title, stype, order, fields in sections_spec:
        config: dict = {}
        if key == "alloy_additions":
            config = {"materials": [{"code": c, "label": l} for c, l in ALLOY_MATERIALS]}
        elif key == "flux_additions":
            config = {"materials": [{"code": c, "label": l} for c, l in FLUX_MATERIALS]}
        elif key == "blow_process":
            config = {"rows": BLOW_PROCESS_ROWS, "columns": BLOW_PROCESS_COLUMNS}
        elif key == "required_chemistry":
            config = {"row_source": "grade_element_spec", "elements": AOD_ELEMENTS}
        elif key == "sample_chemistry":
            config = {
                "sample_rows": SAMPLE_CHEMISTRY_ROWS,
                "elements": AOD_ELEMENTS,
                "include_temperature": True,
            }

        section = TemplateSection(
            version_id=rev02.id,
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

    wf = WorkflowDefinition(version_id=rev02.id, name="AOD Heat Workflow", initial_state="created")
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
        ("created", "in_progress", "Start AOD Heat", ["worker", "supervisor", "plant_admin", "super_admin"]),
        ("in_progress", "completed", "Complete Heat", ["worker", "supervisor"]),
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
