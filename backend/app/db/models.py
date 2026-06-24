import uuid
from datetime import date, datetime, time
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, new_uuid
from app.db.types import (
    MaintenanceIssueStatusString,
    ObservationCategoryString,
)
from app.models.enums import (
    AssetStatus,
    AttendanceStatus,
    CoilStatus,
    EmploymentStatus,
    CorrectiveActionPriority,
    CorrectiveActionStatus,
    DelayCodeCategory,
    DelayEventStatus,
    EventSeverity,
    EventSource,
    FieldType,
    MaintenanceIssueStatus,
    MaterialType,
    ObservationCategory,
    ObservationSeverity,
    ProcessInstanceStatus,
    ProcessRunOutcome,
    ProcessRunType,
    TemplateScopeType,
    TemplateVersionStatus,
    UserRole,
    ValueSource,
)


def _userrole_db_values(enum_cls):
    """Map UserRole to PostgreSQL labels (legacy UPPER names + new lowercase values)."""
    use_value = {UserRole.CEO, UserRole.HR, UserRole.HOD, UserRole.MAINTENANCE}
    return [m.value if m in use_value else m.name for m in enum_cls]


class Organisation(Base, TimestampMixin):
    __tablename__ = "organisations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    plants: Mapped[list["Plant"]] = relationship(back_populates="organisation")


class Plant(Base, TimestampMixin):
    __tablename__ = "plants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")
    location: Mapped[Optional[str]] = mapped_column(String(500))

    organisation: Mapped["Organisation"] = relationship(back_populates="plants")
    departments: Mapped[list["Department"]] = relationship(back_populates="plant")
    asset_groups: Mapped[list["AssetGroup"]] = relationship(back_populates="plant")
    shifts: Mapped[list["Shift"]] = relationship(back_populates="plant")

    __table_args__ = (UniqueConstraint("organisation_id", "code", name="uq_plant_org_code"),)


class Department(Base, TimestampMixin):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    plant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plants.id"), nullable=False)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    plant: Mapped["Plant"] = relationship(back_populates="departments")
    processes: Mapped[list["Process"]] = relationship(back_populates="department")

    __table_args__ = (UniqueConstraint("plant_id", "code", name="uq_dept_plant_code"),)


class Process(Base, TimestampMixin):
    __tablename__ = "processes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    department_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("departments.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    default_template_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("templates.id", use_alter=True), nullable=True
    )

    department: Mapped["Department"] = relationship(back_populates="processes")
    instances: Mapped[list["ProcessInstance"]] = relationship(back_populates="process")


class AssetGroup(Base, TimestampMixin):
    __tablename__ = "asset_groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    plant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plants.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    plant: Mapped["Plant"] = relationship(back_populates="asset_groups")
    assets: Mapped[list["Asset"]] = relationship(back_populates="group")

    __table_args__ = (UniqueConstraint("plant_id", "code", name="uq_asset_group_plant_code"),)


class Asset(Base, TimestampMixin):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("asset_groups.id"), nullable=False)
    plant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plants.id"), nullable=False)
    asset_no: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[AssetStatus] = mapped_column(Enum(AssetStatus), default=AssetStatus.ACTIVE)
    parent_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("assets.id"), nullable=True)
    life_counters: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict)
    plc_tag_prefix: Mapped[Optional[str]] = mapped_column(String(100))

    group: Mapped["AssetGroup"] = relationship(back_populates="assets")

    __table_args__ = (UniqueConstraint("plant_id", "asset_no", name="uq_asset_plant_no"),)


class ProcessInstance(Base, TimestampMixin):
    __tablename__ = "process_instances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    process_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("processes.id"), nullable=False)
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[ProcessInstanceStatus] = mapped_column(
        Enum(ProcessInstanceStatus), default=ProcessInstanceStatus.ACTIVE
    )
    template_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("templates.id"), nullable=True)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    process: Mapped["Process"] = relationship(back_populates="instances")
    asset: Mapped["Asset"] = relationship()
    runs: Mapped[list["ProcessRun"]] = relationship(back_populates="process_instance")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, values_callable=_userrole_db_values), nullable=False)
    organisation_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("organisations.id"), nullable=True)
    plant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("plants.id"), nullable=True)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    process_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("processes.id"), nullable=True)
    maintenance_division: Mapped[Optional[ObservationCategory]] = mapped_column(
        ObservationCategoryString(), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    employee_uid: Mapped[Optional[str]] = mapped_column(String(32), unique=True, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    designation: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    date_of_joining: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    employment_status: Mapped[EmploymentStatus] = mapped_column(
        String(32), default=EmploymentStatus.ACTIVE.value, nullable=False
    )


class Shift(Base, TimestampMixin):
    __tablename__ = "shifts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    plant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plants.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    plant: Mapped["Plant"] = relationship(back_populates="shifts")

    __table_args__ = (UniqueConstraint("plant_id", "code", name="uq_shift_plant_code"),)


class SteelGrade(Base, TimestampMixin):
    __tablename__ = "steel_grades"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisations.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    element_specs: Mapped[list["GradeElementSpec"]] = relationship(back_populates="grade")

    __table_args__ = (UniqueConstraint("organisation_id", "code", name="uq_grade_org_code"),)


class GradeElementSpec(Base, TimestampMixin):
    __tablename__ = "grade_element_specs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    grade_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("steel_grades.id"), nullable=False)
    element: Mapped[str] = mapped_column(String(20), nullable=False)
    min_value: Mapped[Optional[float]] = mapped_column()
    max_value: Mapped[Optional[float]] = mapped_column()
    unit: Mapped[str] = mapped_column(String(20), default="%")

    grade: Mapped["SteelGrade"] = relationship(back_populates="element_specs")


class MaterialCatalog(Base, TimestampMixin):
    __tablename__ = "material_catalog"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisations.id"), nullable=False)
    type: Mapped[MaterialType] = mapped_column(Enum(MaterialType), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    __table_args__ = (UniqueConstraint("organisation_id", "code", name="uq_material_org_code"),)


class Template(Base, TimestampMixin):
    __tablename__ = "templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    scope_type: Mapped[TemplateScopeType] = mapped_column(Enum(TemplateScopeType), nullable=False)
    scope_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    doc_no: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    current_draft_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("template_versions.id", use_alter=True), nullable=True
    )

    versions: Mapped[list["TemplateVersion"]] = relationship(
        back_populates="template",
        foreign_keys="TemplateVersion.template_id",
    )


class TemplateVersion(Base, TimestampMixin):
    __tablename__ = "template_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    template_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("templates.id"), nullable=False)
    rev_no: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[TemplateVersionStatus] = mapped_column(
        Enum(TemplateVersionStatus), default=TemplateVersionStatus.DRAFT
    )
    effective_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    effective_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    published_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    change_summary: Mapped[Optional[str]] = mapped_column(Text)
    is_immutable: Mapped[bool] = mapped_column(Boolean, default=False)

    template: Mapped["Template"] = relationship(
        back_populates="versions",
        foreign_keys=[template_id],
    )
    sections: Mapped[list["TemplateSection"]] = relationship(back_populates="version")
    workflow_definition: Mapped[Optional["WorkflowDefinition"]] = relationship(back_populates="version")

    __table_args__ = (UniqueConstraint("template_id", "rev_no", name="uq_template_rev"),)


class TemplateSection(Base, TimestampMixin):
    __tablename__ = "template_sections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("template_versions.id"), nullable=False)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    section_type: Mapped[str] = mapped_column(String(50), default="fields")
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    version: Mapped["TemplateVersion"] = relationship(back_populates="sections")
    fields: Mapped[list["TemplateField"]] = relationship(back_populates="section")

    __table_args__ = (UniqueConstraint("version_id", "key", name="uq_section_version_key"),)


class TemplateField(Base, TimestampMixin):
    __tablename__ = "template_fields"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    section_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("template_sections.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    field_type: Mapped[FieldType] = mapped_column(Enum(FieldType), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    formula: Mapped[Optional[str]] = mapped_column(Text)

    section: Mapped["TemplateSection"] = relationship(back_populates="fields")


class WorkflowDefinition(Base, TimestampMixin):
    __tablename__ = "workflow_definitions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("template_versions.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    initial_state: Mapped[str] = mapped_column(String(50), nullable=False)

    version: Mapped["TemplateVersion"] = relationship(back_populates="workflow_definition")
    states: Mapped[list["WorkflowState"]] = relationship(back_populates="definition")
    transitions: Mapped[list["WorkflowTransitionDef"]] = relationship(back_populates="definition")


class WorkflowState(Base, TimestampMixin):
    __tablename__ = "workflow_states"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    definition_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflow_definitions.id"), nullable=False)
    key: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    is_terminal: Mapped[bool] = mapped_column(Boolean, default=False)
    color: Mapped[Optional[str]] = mapped_column(String(20))
    allowed_edits: Mapped[list[str]] = mapped_column(JSONB, default=list)

    definition: Mapped["WorkflowDefinition"] = relationship(back_populates="states")

    __table_args__ = (UniqueConstraint("definition_id", "key", name="uq_wf_state_key"),)


class WorkflowTransitionDef(Base, TimestampMixin):
    __tablename__ = "workflow_transition_defs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    definition_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflow_definitions.id"), nullable=False)
    from_state: Mapped[str] = mapped_column(String(50), nullable=False)
    to_state: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    allowed_roles: Mapped[list[str]] = mapped_column(JSONB, default=list)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_trigger_event_type: Mapped[Optional[str]] = mapped_column(String(100))
    validation_rules: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    definition: Mapped["WorkflowDefinition"] = relationship(back_populates="transitions")


class ProcessRun(Base, TimestampMixin):
    __tablename__ = "process_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    run_number: Mapped[str] = mapped_column(String(100), nullable=False)
    run_type: Mapped[ProcessRunType] = mapped_column(Enum(ProcessRunType), nullable=False)
    process_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("processes.id"), nullable=False)
    process_instance_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("process_instances.id"), nullable=False)
    template_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("template_versions.id"), nullable=False)
    workflow_definition_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflow_definitions.id"), nullable=False)
    current_state: Mapped[str] = mapped_column(String(50), nullable=False)
    shift_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("shifts.id"), nullable=True)
    grade_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("steel_grades.id"), nullable=True)
    primary_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("assets.id"), nullable=True)
    secondary_asset_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    previous_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("process_runs.id"), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    outcome: Mapped[Optional[ProcessRunOutcome]] = mapped_column(Enum(ProcessRunOutcome), nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict)

    process_instance: Mapped["ProcessInstance"] = relationship(back_populates="runs")
    field_values: Mapped[list["RunFieldValue"]] = relationship(back_populates="run")
    section_data: Mapped[list["RunSectionData"]] = relationship(back_populates="run")
    transition_logs: Mapped[list["WorkflowTransitionLog"]] = relationship(back_populates="run")
    events: Mapped[list["OperationalEvent"]] = relationship(back_populates="run")
    observations: Mapped[list["Observation"]] = relationship(back_populates="run")
    remarks: Mapped[list["RunRemark"]] = relationship(back_populates="run")
    delay_events: Mapped[list["DelayEvent"]] = relationship(back_populates="run")


class RunFieldValue(Base, TimestampMixin):
    __tablename__ = "run_field_values"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("process_runs.id"), nullable=False)
    field_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("template_fields.id"), nullable=True)
    field_key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[Any] = mapped_column(JSONB)
    source: Mapped[ValueSource] = mapped_column(Enum(ValueSource), default=ValueSource.MANUAL)

    run: Mapped["ProcessRun"] = relationship(back_populates="field_values")


class RunSectionData(Base, TimestampMixin):
    __tablename__ = "run_section_data"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("process_runs.id"), nullable=False)
    section_key: Mapped[str] = mapped_column(String(100), nullable=False)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    run: Mapped["ProcessRun"] = relationship(back_populates="section_data")

    __table_args__ = (UniqueConstraint("run_id", "section_key", name="uq_run_section"),)


class WorkflowTransitionLog(Base):
    __tablename__ = "workflow_transition_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("process_runs.id"), nullable=False)
    from_state: Mapped[str] = mapped_column(String(50), nullable=False)
    to_state: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    trigger: Mapped[str] = mapped_column(String(50), default="manual")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    run: Mapped["ProcessRun"] = relationship(back_populates="transition_logs")


class OperationalEvent(Base):
    __tablename__ = "operational_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    plant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plants.id"), nullable=False)
    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("assets.id"), nullable=True)
    run_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("process_runs.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[EventSeverity] = mapped_column(Enum(EventSeverity), default=EventSeverity.INFO)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    source: Mapped[EventSource] = mapped_column(Enum(EventSource), default=EventSource.MANUAL)
    correlation_id: Mapped[Optional[str]] = mapped_column(String(200))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    processed: Mapped[bool] = mapped_column(Boolean, default=False)

    run: Mapped[Optional["ProcessRun"]] = relationship(back_populates="events")


class Observation(Base, TimestampMixin):
    __tablename__ = "observations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    plant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plants.id"), nullable=False)
    run_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("process_runs.id"), nullable=True)
    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("assets.id"), nullable=True)
    event_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("operational_events.id"), nullable=True)
    category: Mapped[ObservationCategory] = mapped_column(Enum(ObservationCategory), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[ObservationSeverity] = mapped_column(Enum(ObservationSeverity), nullable=False)
    observed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="open")

    run: Mapped[Optional["ProcessRun"]] = relationship(back_populates="observations")
    corrective_actions: Mapped[list["CorrectiveAction"]] = relationship(back_populates="observation")


class CorrectiveAction(Base, TimestampMixin):
    __tablename__ = "corrective_actions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    observation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("observations.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    assigned_to: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    priority: Mapped[CorrectiveActionPriority] = mapped_column(
        Enum(CorrectiveActionPriority), default=CorrectiveActionPriority.MEDIUM
    )
    status: Mapped[CorrectiveActionStatus] = mapped_column(
        Enum(CorrectiveActionStatus), default=CorrectiveActionStatus.OPEN
    )
    closure_notes: Mapped[Optional[str]] = mapped_column(Text)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    closed_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)

    observation: Mapped["Observation"] = relationship(back_populates="corrective_actions")


class DelayCode(Base, TimestampMixin):
    __tablename__ = "delay_codes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    plant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plants.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[DelayCodeCategory] = mapped_column(Enum(DelayCodeCategory), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (UniqueConstraint("plant_id", "code", name="uq_delay_code_plant_code"),)


class DelayEvent(Base, TimestampMixin):
    __tablename__ = "delay_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("process_runs.id"), nullable=False)
    plant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plants.id"), nullable=False)
    row_key: Mapped[str] = mapped_column(String(64), nullable=False)
    delay_code_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("delay_codes.id"), nullable=True)
    time_from: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    time_to: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    time_lost_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    action_taken: Mapped[Optional[str]] = mapped_column(Text)
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[DelayEventStatus] = mapped_column(Enum(DelayEventStatus), default=DelayEventStatus.OPEN)
    observation_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("observations.id"), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)

    run: Mapped["ProcessRun"] = relationship(back_populates="delay_events")
    delay_code: Mapped[Optional["DelayCode"]] = relationship()

    __table_args__ = (UniqueConstraint("run_id", "row_key", name="uq_delay_event_run_row"),)


class Coil(Base, TimestampMixin):
    __tablename__ = "coils"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    plant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plants.id"), nullable=False)
    department_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("departments.id"), nullable=False)
    coil_no: Mapped[str] = mapped_column(String(100), nullable=False)
    work_order_no: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    grade_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("steel_grades.id"), nullable=True)
    heat_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("process_runs.id"), nullable=True)
    heat_no: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    size_mm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[CoilStatus] = mapped_column(Enum(CoilStatus), default=CoilStatus.REGISTERED)
    parent_coil_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("coils.id"), nullable=True)
    source_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("process_runs.id"), nullable=True)
    registered_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    __table_args__ = (UniqueConstraint("plant_id", "coil_no", name="uq_coil_plant_no"),)


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    plant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (UniqueConstraint("plant_id", "name", name="uq_customer_plant_name"),)


class MaintenanceIssue(Base, TimestampMixin):
    __tablename__ = "maintenance_issues"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisations.id"), nullable=False)
    plant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plants.id"), nullable=False)
    run_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("process_runs.id"), nullable=True)
    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("assets.id"), nullable=True)
    category: Mapped[ObservationCategory] = mapped_column(Enum(ObservationCategory), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[ObservationSeverity] = mapped_column(Enum(ObservationSeverity), nullable=False)
    status: Mapped[MaintenanceIssueStatus] = mapped_column(
        Enum(MaintenanceIssueStatus), default=MaintenanceIssueStatus.OPEN
    )
    raised_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    raised_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    raiser: Mapped["User"] = relationship(foreign_keys=[raised_by])
    assignee: Mapped[Optional["User"]] = relationship(foreign_keys=[assigned_to])
    closer: Mapped[Optional["User"]] = relationship(foreign_keys=[closed_by])
    run: Mapped[Optional["ProcessRun"]] = relationship()


class RunRemark(Base):
    __tablename__ = "run_remarks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("process_runs.id"), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("run_remarks.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    run: Mapped["ProcessRun"] = relationship(back_populates="remarks")
    author: Mapped["User"] = relationship()
    attachments: Mapped[list["RunRemarkAttachment"]] = relationship(back_populates="remark")


class RunRemarkAttachment(Base):
    __tablename__ = "run_remark_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    remark_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("run_remarks.id"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    remark: Mapped["RunRemark"] = relationship(back_populates="attachments")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisations.id"), nullable=False)
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_broadcast: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sender: Mapped["User"] = relationship(foreign_keys=[sender_id])
    recipients: Mapped[list["MessageRecipient"]] = relationship(back_populates="message")
    attachments: Mapped[list["MessageAttachment"]] = relationship(back_populates="message")


class MessageRecipient(Base):
    __tablename__ = "message_recipients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("messages.id"), nullable=False)
    recipient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    message: Mapped["Message"] = relationship(back_populates="recipients")
    recipient: Mapped["User"] = relationship(foreign_keys=[recipient_id])

    __table_args__ = (UniqueConstraint("message_id", "recipient_id", name="uq_message_recipient"),)


class MessageAttachment(Base):
    __tablename__ = "message_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("messages.id"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    message: Mapped["Message"] = relationship(back_populates="attachments")


class UserNotification(Base):
    __tablename__ = "user_notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    message_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("messages.id"), nullable=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    notification_type: Mapped[str] = mapped_column(String(50), default="message")
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    message: Mapped["Message"] = relationship()
    user: Mapped["User"] = relationship(foreign_keys=[user_id])


class TelemetryBinding(Base, TimestampMixin):
    __tablename__ = "telemetry_bindings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id"), nullable=False)
    field_key: Mapped[str] = mapped_column(String(100), nullable=False)
    tag_name: Mapped[str] = mapped_column(String(200), nullable=False)
    event_type: Mapped[Optional[str]] = mapped_column(String(100))
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    before: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB)
    after: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TemplateVersionAudit(Base):
    __tablename__ = "template_version_audits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("template_versions.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class KPIDefinition(Base, TimestampMixin):
    __tablename__ = "kpi_definitions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    formula: Mapped[str] = mapped_column(Text, nullable=False)
    dimensions: Mapped[list[str]] = mapped_column(JSONB, default=list)
    refresh_interval_minutes: Mapped[int] = mapped_column(Integer, default=60)


class FactProcessRun(Base):
    __tablename__ = "fact_process_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("process_runs.id"), unique=True, nullable=False)
    plant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plants.id"), nullable=False)
    process_instance_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("process_instances.id"), nullable=False)
    run_type: Mapped[str] = mapped_column(String(50), nullable=False)
    grade_code: Mapped[Optional[str]] = mapped_column(String(50))
    shift_code: Mapped[Optional[str]] = mapped_column(String(10))
    duration_min: Mapped[Optional[float]] = mapped_column()
    tap_to_tap_min: Mapped[Optional[float]] = mapped_column()
    energy_kwh: Mapped[Optional[float]] = mapped_column()
    charge_kg: Mapped[Optional[float]] = mapped_column()
    alloy_kg: Mapped[Optional[float]] = mapped_column()
    outcome: Mapped[Optional[str]] = mapped_column(String(20))
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AggShiftKPI(Base):
    __tablename__ = "agg_shift_kpis"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    plant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plants.id"), nullable=False)
    shift_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shifts.id"), nullable=False)
    shift_date: Mapped[date] = mapped_column(Date, nullable=False)
    runs_completed: Mapped[int] = mapped_column(Integer, default=0)
    avg_tap_to_tap_min: Mapped[Optional[float]] = mapped_column()
    total_energy_kwh: Mapped[Optional[float]] = mapped_column()
    oos_rate: Mapped[Optional[float]] = mapped_column()
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("plant_id", "shift_id", "shift_date", name="uq_shift_kpi"),)


class MLFeatureSnapshot(Base):
    __tablename__ = "ml_feature_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("process_runs.id"), unique=True, nullable=False)
    feature_vector: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Contractor(Base, TimestampMixin):
    __tablename__ = "contractors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisations.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_person: Mapped[Optional[str]] = mapped_column(String(200))
    phone: Mapped[Optional[str]] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    workers: Mapped[list["ContractWorker"]] = relationship(back_populates="contractor")

    __table_args__ = (UniqueConstraint("organisation_id", "code", name="uq_contractor_org_code"),)


class ContractWorker(Base, TimestampMixin):
    __tablename__ = "contract_workers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    contractor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contractors.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    department_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("departments.id"), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    contractor: Mapped["Contractor"] = relationship(back_populates="workers")
    department: Mapped["Department"] = relationship()


class ShiftAssignment(Base, TimestampMixin):
    __tablename__ = "shift_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    department_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("departments.id"), nullable=False)
    shift_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shifts.id"), nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)

    user: Mapped["User"] = relationship()
    department: Mapped["Department"] = relationship()
    shift: Mapped["Shift"] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "user_id", "department_id", "shift_id", "effective_date", name="uq_shift_assignment"
        ),
    )


class AttendanceRecord(Base, TimestampMixin):
    __tablename__ = "attendance_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    department_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("departments.id"), nullable=False)
    shift_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shifts.id"), nullable=False)
    status: Mapped[AttendanceStatus] = mapped_column(String(32), nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    marked_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    department: Mapped["Department"] = relationship()
    shift: Mapped["Shift"] = relationship()
    marked_by: Mapped["User"] = relationship(foreign_keys=[marked_by_id])

    __table_args__ = (
        UniqueConstraint(
            "attendance_date", "user_id", "department_id", "shift_id", name="uq_attendance_record"
        ),
    )


class ContractorAttendance(Base, TimestampMixin):
    __tablename__ = "contractor_attendance"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    contractor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contractors.id"), nullable=False)
    department_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("departments.id"), nullable=False)
    shift_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shifts.id"), nullable=False)
    workers_present: Mapped[int] = mapped_column(Integer, default=0)
    workers_absent: Mapped[int] = mapped_column(Integer, default=0)
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    marked_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    contractor: Mapped["Contractor"] = relationship()
    department: Mapped["Department"] = relationship()
    shift: Mapped["Shift"] = relationship()
    marked_by: Mapped["User"] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "attendance_date",
            "contractor_id",
            "department_id",
            "shift_id",
            name="uq_contractor_attendance",
        ),
    )


class ShiftHandoverNote(Base, TimestampMixin):
    __tablename__ = "shift_handover_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    note_date: Mapped[date] = mapped_column(Date, nullable=False)
    department_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("departments.id"), nullable=False)
    shift_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shifts.id"), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)

    department: Mapped["Department"] = relationship()
    shift: Mapped["Shift"] = relationship()
    author: Mapped["User"] = relationship()
