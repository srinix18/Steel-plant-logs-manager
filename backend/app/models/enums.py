import enum


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    CEO = "ceo"
    HR = "hr"
    HOD = "hod"
    ORG_ADMIN = "org_admin"
    PLANT_ADMIN = "plant_admin"
    SUPERVISOR = "supervisor"
    WORKER = "worker"
    MAINTENANCE = "maintenance"
    # Legacy aliases for migration
    ADMIN = "admin"
    DEPARTMENT = "department"
    MEMBER = "member"


class TemplateScopeType(str, enum.Enum):
    PROCESS = "process"
    PROCESS_INSTANCE = "process_instance"


class TemplateVersionStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    RETIRED = "retired"


class ProcessInstanceStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"


class AssetStatus(str, enum.Enum):
    ACTIVE = "active"
    MAINTENANCE = "maintenance"
    DECOMMISSIONED = "decommissioned"


class FieldType(str, enum.Enum):
    TEXT = "text"
    NUMBER = "number"
    EMAIL = "email"
    DATE = "date"
    TIME = "time"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    DROPDOWN = "dropdown"
    TEXTAREA = "textarea"
    FILE = "file"
    SIGNATURE = "signature"
    USER_REF = "user_ref"
    ASSET_REF = "asset_ref"
    MATERIAL_REF = "material_ref"
    GRADE_REF = "grade_ref"
    HEAT_REF = "heat_ref"
    REPEATABLE_GROUP = "repeatable_group"
    TABLE = "table"
    CALCULATED = "calculated"


class ProcessRunType(str, enum.Enum):
    HEAT = "heat"
    SHIFT = "shift"
    DAILY = "daily"
    LADLE_METALLURGY = "ladle_metallurgy"
    CAST = "cast"
    INSPECTION = "inspection"
    MAINTENANCE = "maintenance"
    QUALITY_CHECK = "quality_check"


class ProcessRunOutcome(str, enum.Enum):
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    REWORK = "rework"
    ABORTED = "aborted"


class EventSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class EventSource(str, enum.Enum):
    PLC = "plc"
    SCADA = "scada"
    LIMS = "lims"
    MANUAL = "manual"
    SYSTEM = "system"
    KAFKA = "kafka"


class ObservationCategory(str, enum.Enum):
    QUALITY = "quality"
    SAFETY = "safety"
    ENERGY = "energy"
    EQUIPMENT = "equipment"
    PROCESS = "process"


class ObservationSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class MaintenanceIssueStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    CLOSED = "closed"


class DelayCodeCategory(str, enum.Enum):
    EQUIPMENT = "equipment"
    PROCESS = "process"


class DelayEventStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class EmploymentStatus(str, enum.Enum):
    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    RESIGNED = "resigned"
    TERMINATED = "terminated"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LEAVE = "leave"
    HALF_DAY = "half_day"


class CoilStatus(str, enum.Enum):
    REGISTERED = "registered"
    IN_FURNACE = "in_furnace"
    COMPLETED = "completed"
    CONSUMED = "consumed"


class CorrectiveActionStatus(str, enum.Enum):
    OPEN = "open"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class DocumentCategory(str, enum.Enum):
    SOP = "sop"
    WORK_INSTRUCTION = "work_instruction"
    SAFETY_PROCEDURE = "safety_procedure"
    QUALITY_DOCUMENT = "quality_document"
    MAINTENANCE_MANUAL = "maintenance_manual"
    TRAINING_MATERIAL = "training_material"


class ApprovalAction(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REVIEWED = "reviewed"
    APPROVED = "approved"
    REJECTED = "rejected"
    CLOSED = "closed"


class KpiFrequency(str, enum.Enum):
    SHIFT = "shift"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class AssetEventType(str, enum.Enum):
    INSPECTION = "inspection"
    BREAKDOWN = "breakdown"
    MAINTENANCE = "maintenance"
    READING = "reading"
    MANUAL_ENTRY = "manual_entry"


class CorrectiveActionPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class MaterialType(str, enum.Enum):
    SCRAP = "scrap"
    ALLOY = "alloy"


class ValueSource(str, enum.Enum):
    MANUAL = "manual"
    TELEMETRY = "telemetry"
    LIMS = "lims"
    SYSTEM = "system"


class RemarkAuthorRole(str, enum.Enum):
    MELTER = "melter"
    SUPERVISOR = "supervisor"
    SYSTEM = "system"


class CostCategory(str, enum.Enum):
    RAW_MATERIAL = "raw_material"
    POWER = "power"
    FUEL = "fuel"
    LABOUR = "labour"
    MAINTENANCE = "maintenance"
    CONSUMABLES = "consumables"
    OTHER = "other"


class CostMappingSourceType(str, enum.Enum):
    SCALAR_FIELD = "scalar_field"
    SECTION_ROW = "section_row"
    SECTION_AGGREGATE = "section_aggregate"


class CostCalculationStatus(str, enum.Enum):
    COMPLETE = "complete"
    PARTIAL = "partial"
    FAILED = "failed"
