import asyncio
import os
import sys
from urllib.parse import urlparse

import asyncpg


async def main() -> None:
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5433/moi_platform",
    )
    parsed = urlparse(db_url.replace("+asyncpg", ""))
    host = sys.argv[1] if len(sys.argv) > 1 else (parsed.hostname or "127.0.0.1")
    port = parsed.port or 5433
    user = parsed.username or "postgres"
    password = parsed.password or "postgres"
    database = (parsed.path or "/moi_platform").lstrip("/")
    try:
        conn = await asyncpg.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
        )
        val = await conn.fetchval("SELECT 1")
        print(f"OK {host}:{port}: {val}")
        await conn.close()
    except Exception as exc:
        print(f"FAIL {host}:{port}: {exc}")


asyncio.run(main())
