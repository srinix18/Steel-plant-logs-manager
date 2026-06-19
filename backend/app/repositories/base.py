from typing import Generic, TypeVar
from uuid import UUID

from beanie import Document

T = TypeVar("T", bound=Document)


class BaseRepository(Generic[T]):
    def __init__(self, model: type[T]):
        self.model = model

    async def get_by_id(self, entity_id: UUID) -> T | None:
        return await self.model.get(entity_id)

    async def get_all(self) -> list[T]:
        return await self.model.find_all().to_list()

    async def create(self, entity: T) -> T:
        await entity.insert()
        return entity

    async def update(self, entity: T) -> T:
        await entity.save()
        return entity

    async def delete(self, entity: T) -> None:
        await entity.delete()

    async def count(self) -> int:
        return await self.model.count()
