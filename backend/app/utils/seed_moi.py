from datetime import date, datetime, time, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.models import (
    Asset,
    AssetGroup,
    Department,
    GradeElementSpec,
    KPIDefinition,
    MaterialCatalog,
    Organisation,
    Plant,
    Process,
    ProcessInstance,
    Shift,
    SteelGrade,
    Template,
    TemplateField,
    TemplateSection,
    TemplateVersion,
    TemplateVersionAudit,
    TelemetryBinding,
    User,
    WorkflowDefinition,
    WorkflowState,
    WorkflowTransitionDef,
)
from app.models.enums import (
    FieldType,
    MaterialType,
    ProcessInstanceStatus,
    TemplateScopeType,
    TemplateVersionStatus,
    UserRole,
)


async def seed_all(session: AsyncSession) -> None:
    existing = await session.execute(select(Organisation).where(Organisation.code == "CHANDAN"))
    if existing.scalar_one_or_none():
        return

    org = Organisation(name="Chandan Steel Ltd.", code="CHANDAN", description="Chandan Steel divisions")
    session.add(org)
    await session.flush()

    plant = Plant(
        organisation_id=org.id,
        name="Chandan Steels",
        code="CS",
        timezone="Asia/Kolkata",
        location="Chandan Steels",
    )
    session.add(plant)
    await session.flush()

    dept = Department(
        plant_id=plant.id,
        organisation_id=org.id,
        name="Steel Melting Shop",
        code="SMS",
        description="SMS Department",
    )
    session.add(dept)
    await session.flush()

    # Asset groups
    furnaces_grp = AssetGroup(plant_id=plant.id, code="furnaces", name="Induction Furnaces")
    ladles_grp = AssetGroup(plant_id=plant.id, code="ladles", name="Transfer Ladles")
    crucibles_grp = AssetGroup(plant_id=plant.id, code="crucibles", name="Crucibles")
    transformers_grp = AssetGroup(plant_id=plant.id, code="transformers", name="Transformers")
    session.add_all([furnaces_grp, ladles_grp, crucibles_grp, transformers_grp])
    await session.flush()

    iaf_assets = []
    for i in range(1, 4):
        asset = Asset(
            group_id=furnaces_grp.id,
            plant_id=plant.id,
            asset_no=f"IAF-{i:02d}",
            name=f"IAF #{i}",
            plc_tag_prefix=f"IAF{i}.",
            life_counters={"heats": 0, "heat_count": 0},
        )
        session.add(asset)
        iaf_assets.append(asset)
    await session.flush()

    # Additional process types for phase 6
    processes_data = [
        ("IAF", "Induction Furnace", dept.id),
        ("LF", "Ladle Furnace", dept.id),
        ("CCM", "Continuous Casting Machine", dept.id),
        ("RM", "Rolling Mill", dept.id),
        ("QC", "Quality Control", dept.id),
        ("MAINT", "Maintenance", dept.id),
    ]
    process_map = {}
    for code, name, department_id in processes_data:
        p = Process(department_id=department_id, code=code, name=name)
        session.add(p)
        process_map[code] = p
    await session.flush()

    iaf_process = process_map["IAF"]
    instances = []
    for asset in iaf_assets:
        inst = ProcessInstance(
            process_id=iaf_process.id,
            asset_id=asset.id,
            name=asset.name,
            status=ProcessInstanceStatus.ACTIVE,
        )
        session.add(inst)
        instances.append(inst)
    await session.flush()

    # Shifts
    for code, name, start, end in [
        ("A", "Shift A", time(6, 0), time(14, 0)),
        ("B", "Shift B", time(14, 0), time(22, 0)),
        ("C", "Shift C", time(22, 0), time(6, 0)),
    ]:
        session.add(Shift(plant_id=plant.id, code=code, name=name, start_time=start, end_time=end))
    await session.flush()

    from app.utils.seed_patches import GRADE_DESCRIPTIONS, GRADE_ELEMENT_SPECS

    for code in ("304", "316", "410", "2205", "430"):
        grade = SteelGrade(organisation_id=org.id, code=code, description=GRADE_DESCRIPTIONS[code])
        session.add(grade)
        await session.flush()
        for element, min_v, max_v in GRADE_ELEMENT_SPECS[code]:
            session.add(GradeElementSpec(grade_id=grade.id, element=element, min_value=min_v, max_value=max_v))

    # Materials
    for code, name, mtype in [
        ("304_SCRAP", "304 Scrap", MaterialType.SCRAP),
        ("316_SCRAP", "316 Scrap", MaterialType.SCRAP),
        ("410_SCRAP", "410 Scrap", MaterialType.SCRAP),
        ("2205_SCRAP", "2205 Scrap", MaterialType.SCRAP),
        ("CRCA", "CRCA", MaterialType.SCRAP),
        ("HC_FE_CR", "H/C Fe Cr", MaterialType.ALLOY),
        ("HC_FESI", "H/C FeSi", MaterialType.ALLOY),
        ("FE_NI", "Fe Ni", MaterialType.ALLOY),
    ]:
        session.add(MaterialCatalog(organisation_id=org.id, type=mtype, code=code, name=name))
    await session.flush()

    # Template F/PRD/02
    template = Template(
        scope_type=TemplateScopeType.PROCESS,
        scope_id=iaf_process.id,
        doc_no="F/PRD/02",
        name="Furnace Log Sheet",
    )
    session.add(template)
    await session.flush()
    iaf_process.default_template_id = template.id

    rev02 = TemplateVersion(
        template_id=template.id,
        rev_no="02",
        status=TemplateVersionStatus.PUBLISHED,
        effective_from=date(2024, 3, 1),
        published_at=datetime(2024, 3, 1, tzinfo=timezone.utc),
        change_summary="Initial digital revision",
        is_immutable=True,
    )
    rev03 = TemplateVersion(
        template_id=template.id,
        rev_no="03",
        status=TemplateVersionStatus.DRAFT,
        change_summary="Draft for additional sensor fields",
        is_immutable=False,
    )
    session.add_all([rev02, rev03])
    template.current_draft_version_id = rev03.id
    await session.flush()

    sections_spec = [
        ("heat_info", "Heat Information", "fields", 0, [
            ("date", "Date", FieldType.DATE, True),
            ("heat_no", "Heat No.", FieldType.TEXT, True),
            ("grade", "Grade", FieldType.GRADE_REF, True),
            ("shift", "Shift", FieldType.DROPDOWN, True, {"options": ["A", "B", "C"]}),
            ("melter", "Name of Melter", FieldType.USER_REF, True),
        ]),
        ("timing_equipment", "Timing & Equipment", "fields", 1, [
            ("previous_heat_tapping_time", "Previous Heat Tapping Time", FieldType.DATETIME, False),
            ("crucible", "Crucible No / Life", FieldType.ASSET_REF, False, {"asset_group": "crucibles"}),
            ("power_on_time", "Power On Time", FieldType.DATETIME, True, {"quick_action": "now"}),
            ("tapping_time", "Tapping Time", FieldType.DATETIME, True, {"quick_action": "now"}),
            ("process_time", "Process Time", FieldType.CALCULATED, False, {}, "tapping_time - power_on_time"),
            ("tap_to_tap_time", "Tap To Tap Time", FieldType.CALCULATED, False, {}, "tapping_time - previous_heat_tapping_time"),
            ("transfer_ladle", "Transfer Ladle No / Life", FieldType.ASSET_REF, False, {"asset_group": "ladles"}),
        ]),
        ("chemistry", "Chemical Composition", "table", 2, []),
        ("ferro_alloys", "Ferro Alloy Additions", "repeatable_group", 3, []),
        ("charge_mix", "Charge Mix", "repeatable_group", 4, []),
        ("electrical_power", "Electrical & Power", "fields", 5, [
            ("final_voltage", "Final Voltage", FieldType.NUMBER, False),
            ("final_frequency", "Final Frequency", FieldType.NUMBER, False),
            ("power_initial", "Initial Reading", FieldType.NUMBER, False),
            ("power_final", "Final Reading", FieldType.NUMBER, False),
            ("power_total", "Total Units", FieldType.CALCULATED, False, {}, "power_final - power_initial"),
        ]),
        ("furnace_status", "Furnace Status", "fields", 6, [
            ("condition", "Furnace Condition", FieldType.DROPDOWN, False, {"options": ["Normal", "Minor Issue", "Needs Attention"]}),
            ("condition_notes", "Condition Notes", FieldType.TEXTAREA, False),
        ]),
        ("remarks_signoff", "Remarks & Sign-off", "fields", 7, [
            ("remarks", "Remarks", FieldType.TEXTAREA, False),
            ("melter_signoff", "Melter Sign-off", FieldType.SIGNATURE, True),
            ("jr_melter_signoff", "Jr Melter Sign-off", FieldType.SIGNATURE, False),
        ]),
    ]

    for key, title, stype, order, fields in sections_spec:
        config = {}
        if key == "chemistry":
            config = {"row_source": "grade_element_spec", "max_samples": 8}
        if key == "ferro_alloys":
            config = {"children": [{"name": "material", "type": "material_ref"}, {"name": "quantity_kg", "type": "number"}]}
        if key == "charge_mix":
            config = {"children": [{"name": "material", "type": "material_ref"}, {"name": "quantity_kg", "type": "number"}]}
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

    # SMS Heat Workflow
    wf = WorkflowDefinition(version_id=rev02.id, name="SMS Heat Workflow", initial_state="created")
    session.add(wf)
    await session.flush()

    states = [
        ("created", "Created", False, "gray"),
        ("in_progress", "In Progress", False, "blue"),
        ("waiting_for_sample", "Waiting For Sample", False, "yellow"),
        ("refining", "Refining", False, "orange"),
        ("ready_to_tap", "Ready To Tap", False, "purple"),
        ("completed", "Completed", False, "green"),
        ("approved", "Approved", False, "teal"),
        ("closed", "Closed", True, "slate"),
        ("aborted", "Aborted", True, "red"),
    ]
    for key, label, terminal, color in states:
        session.add(WorkflowState(definition_id=wf.id, key=key, label=label, is_terminal=terminal, color=color))

    transitions = [
        ("created", "in_progress", "Start Heat", ["worker", "supervisor", "hod", "ceo", "plant_admin", "super_admin"]),
        ("in_progress", "waiting_for_sample", "Power On", ["worker", "supervisor"], "power_on"),
        ("waiting_for_sample", "refining", "Record Sample", ["worker", "supervisor"]),
        ("refining", "refining", "Additional Sample", ["worker", "supervisor"]),
        ("refining", "ready_to_tap", "Ready To Tap", ["worker", "supervisor"]),
        ("ready_to_tap", "completed", "Tap Completed", ["worker", "supervisor"], "tap_completed"),
        ("completed", "approved", "Approve", ["supervisor", "hod", "ceo", "plant_admin"], None, True),
        ("approved", "closed", "Close", ["supervisor", "hod", "ceo", "plant_admin"]),
        ("in_progress", "aborted", "Abort", ["supervisor", "hod", "ceo", "plant_admin"]),
    ]
    for t in transitions:
        session.add(
            WorkflowTransitionDef(
                definition_id=wf.id,
                from_state=t[0],
                to_state=t[1],
                label=t[2],
                allowed_roles=list(t[3]),
                auto_trigger_event_type=t[4] if len(t) > 4 and t[4] else None,
                requires_approval=len(t) > 5 and t[5] or False,
            )
        )
    await session.flush()

    # Telemetry bindings for IAF #1
    for event_type, field_key in [
        ("power_on", "power_on_time"),
        ("tap_completed", "tapping_time"),
        ("voltage_reading", "final_voltage"),
        ("frequency_reading", "final_frequency"),
    ]:
        session.add(
            TelemetryBinding(
                asset_id=iaf_assets[0].id,
                field_key=field_key,
                tag_name=f"IAF1.{field_key}",
                event_type=event_type,
            )
        )

    # KPI definitions
    for code, name, formula in [
        ("tap_to_tap_p95", "Tap-to-Tap P95", "percentile(tap_to_tap_min, 95)"),
        ("kwh_per_ton", "kWh per Ton", "energy_kwh / charge_kg * 1000"),
        ("shift_throughput", "Shift Throughput", "count(runs)"),
        ("oos_rate", "Out-of-Spec Rate", "oos_samples / total_samples"),
    ]:
        session.add(KPIDefinition(code=code, name=name, formula=formula))

    # Users
    admin = User(
        email=settings.SEED_ADMIN_EMAIL,
        hashed_password=get_password_hash(settings.SEED_ADMIN_PASSWORD),
        full_name=settings.SEED_ADMIN_NAME,
        role=UserRole.SUPER_ADMIN,
        organisation_id=org.id,
        is_active=True,
    )
    supervisor = User(
        email="supervisor@chandansteel.com",
        hashed_password=get_password_hash("supervisor123"),
        full_name="SMS Supervisor",
        role=UserRole.SUPERVISOR,
        organisation_id=org.id,
        plant_id=plant.id,
        department_id=dept.id,
        is_active=True,
    )
    worker = User(
        email="melter@chandansteel.com",
        hashed_password=get_password_hash("worker123"),
        full_name="Plant Melter",
        role=UserRole.WORKER,
        organisation_id=org.id,
        plant_id=plant.id,
        department_id=dept.id,
        is_active=True,
    )
    session.add_all([admin, supervisor, worker])
    await session.flush()

    session.add(
        TemplateVersionAudit(
            version_id=rev02.id,
            action="published",
            actor_id=admin.id,
            details={"rev_no": "02", "effective_from": "2024-03-01"},
        )
    )
    await session.flush()
