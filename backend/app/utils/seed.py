from app.core.config import settings
from app.core.security import get_password_hash
from app.models.department import Department
from app.models.enums import UserRole
from app.models.organisation import Organisation
from app.models.user import User
from app.repositories.department_repository import DepartmentRepository
from app.repositories.organisation_repository import OrganisationRepository
from app.repositories.user_repository import UserRepository

DEFAULT_ORG_NAME = "Default Organisation"


async def seed_admin_user() -> None:
    repo = UserRepository()
    existing = await repo.get_by_email(settings.SEED_ADMIN_EMAIL)
    if existing:
        return
    admin = User(
        email=settings.SEED_ADMIN_EMAIL,
        hashed_password=get_password_hash(settings.SEED_ADMIN_PASSWORD),
        full_name=settings.SEED_ADMIN_NAME,
        role=UserRole.ADMIN,
    )
    await repo.create(admin)


async def seed_organisation_data() -> None:
    org_repo = OrganisationRepository()
    dept_repo = DepartmentRepository()

    default_org = await org_repo.get_by_name(DEFAULT_ORG_NAME)
    if not default_org:
        default_org = Organisation(name=DEFAULT_ORG_NAME, description="Default organisation for existing data")
        await org_repo.create(default_org)

    departments = await dept_repo.get_all()
    for dept in departments:
        if not getattr(dept, "organisation_id", None):
            dept.organisation_id = default_org.id
            await dept_repo.update(dept)

    # Migrate legacy documents that may lack organisation_id field entirely
    legacy_depts = await Department.find({"organisation_id": {"$exists": False}}).to_list()
    for dept in legacy_depts:
        dept.organisation_id = default_org.id
        await dept_repo.update(dept)


async def seed_data() -> None:
    await seed_organisation_data()
    await seed_admin_user()
