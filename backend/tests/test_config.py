import pytest

from app.core.config import Settings


@pytest.mark.parametrize("raw,expected", [
    ("postgresql://u:p@ep-x.neon.tech/neondb?sslmode=require&channel_binding=require",
     "postgresql+asyncpg://u:p@ep-x.neon.tech/neondb?ssl=require"),
    ("postgres://u:p@dpg-x.render.com/moi", "postgresql+asyncpg://u:p@dpg-x.render.com/moi"),
    ("postgresql+asyncpg://u:p@localhost:5433/db", "postgresql+asyncpg://u:p@localhost:5433/db"),
    ("postgresql://u:p@localhost/db?sslmode=disable", "postgresql+asyncpg://u:p@localhost/db"),
])
def test_database_url_normalised_for_asyncpg(raw, expected):
    assert Settings(DATABASE_URL=raw).DATABASE_URL == expected
