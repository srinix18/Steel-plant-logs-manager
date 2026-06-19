from uuid import UUID

from app.models.department import Department
from app.repositories.base import BaseRepository


class DepartmentRepository(BaseRepository[Department]):
    def __init__(self):
        super().__init__(Department)

    async def get_by_name(self, name: str, organisation_id: UUID) -> Department | None:
        return await Department.find_one(
            Department.name == name,
            Department.organisation_id == organisation_id,
        )

    async def list_by_organisation(self, organisation_id: UUID) -> list[Department]:
        return await Department.find(Department.organisation_id == organisation_id).to_list()

    async def count_by_organisation(self, organisation_id: UUID) -> int:
        return await Department.find(Department.organisation_id == organisation_id).count()
