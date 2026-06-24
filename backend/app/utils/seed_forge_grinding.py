"""Additive seed for Forge Shop grinding register F/PRD/08."""

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

DOC_NO = "F/PRD/08"


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


async def seed_forge_grinding_template(session: AsyncSession) -> None:
    org = await get_chandan_organisation(session)
    if not org:
        return

    tpl_result = await session.execute(select(Template).where(Template.doc_no == DOC_NO))
    if tpl_result.scalar_one_or_none():
        return

    plant = await get_chandan_plant(session, org.id)
    if not plant:
        return

    dept = await get_chandan_department(session, plant.id, "FORGE")
    if not dept:
        return

    wc_grp = await _get_or_create_asset_group(session, plant.id, "forge_work_centres", "Forge Work Centres")

    proc_result = await session.execute(
        select(Process).where(Process.department_id == dept.id, Process.code == "GRIND")
    )
    grind_process = proc_result.scalar_one_or_none()
    if not grind_process:
        grind_process = Process(
            department_id=dept.id,
            code="GRIND",
            name="Grinding Material Details",
            description="Forge Shop grinding material details (work centre wise)",
        )
        session.add(grind_process)
        await session.flush()

    asset_result = await session.execute(
        select(Asset).where(Asset.plant_id == plant.id, Asset.asset_no == "FG-WC-01")
    )
    wc_asset = asset_result.scalar_one_or_none()
    if not wc_asset:
        wc_asset = Asset(
            group_id=wc_grp.id,
            plant_id=plant.id,
            asset_no="FG-WC-01",
            name="Grinding Work Centre 1",
            plc_tag_prefix="FG1.",
            life_counters={"days": 0},
        )
        session.add(wc_asset)
        await session.flush()

    inst_result = await session.execute(
        select(ProcessInstance).where(
            ProcessInstance.process_id == grind_process.id,
            ProcessInstance.asset_id == wc_asset.id,
        )
    )
    if not inst_result.scalar_one_or_none():
        session.add(
            ProcessInstance(
                process_id=grind_process.id,
                asset_id=wc_asset.id,
                name=wc_asset.name,
                status=ProcessInstanceStatus.ACTIVE,
            )
        )
        await session.flush()

    template = Template(
        scope_type=TemplateScopeType.PROCESS,
        scope_id=grind_process.id,
        doc_no=DOC_NO,
        name="Grinding Material Details (Work Centre Wise)",
    )
    session.add(template)
    await session.flush()
    grind_process.default_template_id = template.id

    rev01 = TemplateVersion(
        template_id=template.id,
        rev_no="01",
        status=TemplateVersionStatus.PUBLISHED,
        effective_from=date(2026, 1, 1),
        published_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        change_summary="Initial digital revision — Forge grinding register",
        is_immutable=True,
    )
    session.add(rev01)
    await session.flush()

    header = TemplateSection(
        version_id=rev01.id,
        key="register_header",
        title="Register Header",
        section_type="fields",
        sort_order=0,
        config={},
    )
    session.add(header)
    await session.flush()
    for idx, (name, label, ftype, required) in enumerate(
        [
            ("work_centre", "Work Centre", FieldType.TEXT, True),
            ("date", "Date", FieldType.DATE, True),
        ]
    ):
        session.add(
            TemplateField(
                section_id=header.id,
                name=name,
                label=label,
                field_type=ftype,
                required=required,
                sort_order=idx,
                config={},
            )
        )

    wf = WorkflowDefinition(
        version_id=rev01.id, name="Forge Grinding Daily Register Workflow", initial_state="created"
    )
    session.add(wf)
    await session.flush()

    for key, label, terminal, color in [
        ("created", "Created", False, "gray"),
        ("in_progress", "In Progress", False, "blue"),
        ("completed", "Completed", False, "green"),
        ("closed", "Closed", True, "slate"),
        ("aborted", "Aborted", True, "red"),
    ]:
        session.add(WorkflowState(definition_id=wf.id, key=key, label=label, is_terminal=terminal, color=color))

    for from_s, to_s, label, roles in [
        ("created", "in_progress", "Start Register", ["worker", "supervisor", "plant_admin", "super_admin"]),
        ("in_progress", "completed", "Complete", ["worker", "supervisor"]),
        ("completed", "closed", "Close", ["supervisor", "plant_admin"]),
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
