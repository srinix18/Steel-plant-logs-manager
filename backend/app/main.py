from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import async_session_factory, init_db
from app.utils.seed_aod import patch_aod_calculated_fields, seed_aod_template
from app.utils.seed_concast import seed_concast_template
from app.utils.seed_moi import seed_all
from app.utils.seed_patches import patch_eaf_to_iaf, patch_extra_steel_grades


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    async with async_session_factory() as session:
        await seed_all(session)
        await seed_aod_template(session)
        await patch_aod_calculated_fields(session)
        await seed_concast_template(session)
        await patch_eaf_to_iaf(session)
        await patch_extra_steel_grades(session)
        await session.commit()
    yield


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok"}
