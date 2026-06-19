from uuid import UUID

from app.models.record import Record
from app.repositories.base import BaseRepository


class RecordRepository(BaseRepository[Record]):
    def __init__(self):
        super().__init__(Record)

    async def list_by_department(self, department_id: UUID) -> list[Record]:
        return await Record.find(Record.department_id == department_id).to_list()

    async def list_by_submitter(self, user_id: UUID) -> list[Record]:
        return await Record.find(Record.submitted_by == user_id).to_list()

    async def list_by_template(self, template_id: UUID) -> list[Record]:
        return await Record.find(Record.template_id == template_id).to_list()

    async def count_by_department(self, department_id: UUID) -> int:
        return await Record.find(Record.department_id == department_id).count()
