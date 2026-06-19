from uuid import UUID

from app.models.record_value import RecordValue
from app.repositories.base import BaseRepository


class RecordValueRepository(BaseRepository[RecordValue]):
    def __init__(self):
        super().__init__(RecordValue)

    async def list_by_record(self, record_id: UUID) -> list[RecordValue]:
        return await RecordValue.find(RecordValue.record_id == record_id).to_list()

    async def delete_by_record(self, record_id: UUID) -> None:
        await RecordValue.find(RecordValue.record_id == record_id).delete()
