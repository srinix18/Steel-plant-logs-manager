import enum


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ORG_ADMIN = "org_admin"
    PLANT_ADMIN = "plant_admin"
    SUPERVISOR = "supervisor"
    WORKER = "worker"
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
    REPEATABLE_GROUP = "repeatable_group"
    TABLE = "table"
    CALCULATED = "calculated"


class ProcessRunType(str, enum.Enum):
    HEAT = "heat"
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


class CorrectiveActionStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    CLOSED = "closed"
    CANCELLED = "cancelled"


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
