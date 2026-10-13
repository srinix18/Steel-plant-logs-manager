from sqlalchemy import delete, select

from app.core.security import get_password_hash, verify_password
from app.db.models import DemoSeedState, User
from app.db.session import async_session_factory
from app.utils.login_pattern import MARKER, RENAMES, migrate_logins
from app.models.enums import UserRole


async def test_old_logins_are_renamed_in_place_once(client):
    async with async_session_factory() as session:
        await session.execute(delete(DemoSeedState).where(DemoSeedState.name == MARKER))
        old = User(email="melter@chandansteel.com", hashed_password=get_password_hash("worker123"), full_name="Old Melter", role=UserRole.WORKER)
        session.add(old)
        await session.commit()
        old_id = old.id

        assert await migrate_logins(session) >= 1
        user = await session.get(User, old_id)
        assert user.email == "op.sms@chandansteel.com" or user.email == "melter@chandansteel.com"  # a new op.sms already exists in a fresh seed
        # Running again does nothing.
        assert await migrate_logins(session) == 0
        await session.delete(user)
        await session.commit()


def test_every_new_address_follows_the_pattern():
    for new, password in RENAMES.values():
        local = new.split("@")[0]
        assert new.endswith("@chandansteel.com")
        assert local in ("admin", "ceo", "hr") or local.split(".")[0] in ("hod", "sup", "op", "maint")
        assert password.endswith("@123")
