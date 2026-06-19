from uuid import UUID

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self):
        super().__init__(User)

    async def get_by_email(self, email: str) -> User | None:
        return await User.find_one(User.email == email)

    async def list_by_department(self, department_id: UUID) -> list[User]:
        return await User.find(User.department_id == department_id).to_list()
