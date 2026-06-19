from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ServerSelectionTimeoutError

from app.core.config import settings
from app.models.department import Department
from app.models.organisation import Organisation
from app.models.record import Record
from app.models.record_value import RecordValue
from app.models.template import Template
from app.models.template_field import TemplateField
from app.models.user import User

client: AsyncIOMotorClient | None = None

MONGODB_HELP = """
MongoDB is not running or not installed.

Windows (no Docker):
  1. Run:  .\\scripts\\install-mongodb.ps1
  2. Or install manually: winget install MongoDB.Server
  3. Then run:  .\\scripts\\start.ps1

See README.md for full setup instructions.
"""


async def connect_to_mongo() -> None:
    global client
    client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
    try:
        await client.admin.command("ping")
    except ServerSelectionTimeoutError as exc:
        raise RuntimeError(MONGODB_HELP.strip()) from exc

    await init_beanie(
        database=client[settings.MONGODB_DB_NAME],
        document_models=[
            User,
            Organisation,
            Department,
            Template,
            TemplateField,
            Record,
            RecordValue,
        ],
    )


async def close_mongo_connection() -> None:
    global client
    if client:
        client.close()
        client = None
