from app.models.organisation import Organisation
from app.repositories.base import BaseRepository


class OrganisationRepository(BaseRepository[Organisation]):
    def __init__(self):
        super().__init__(Organisation)

    async def get_by_name(self, name: str) -> Organisation | None:
        return await Organisation.find_one(Organisation.name == name)
