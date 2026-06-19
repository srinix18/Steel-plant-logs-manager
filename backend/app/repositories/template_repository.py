from uuid import UUID

from app.models.template import Template
from app.repositories.base import BaseRepository


class TemplateRepository(BaseRepository[Template]):
    def __init__(self):
        super().__init__(Template)

    async def list_by_department(self, department_id: UUID) -> list[Template]:
        return await Template.find(Template.department_id == department_id).to_list()

    async def list_active_by_department(self, department_id: UUID) -> list[Template]:
        return await Template.find(
            Template.department_id == department_id,
            Template.is_active == True,  # noqa: E712
        ).to_list()
