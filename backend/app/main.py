from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import async_session_factory, init_db
from app.utils.seed_aod import patch_aod_calculated_fields, seed_aod_template
from app.utils.seed_concast import seed_concast_template
from app.utils.chandan_org import patch_unified_chandan_plant
from app.utils.seed_divisions import seed_chandan_divisions
from app.utils.seed_moi import seed_all
from app.utils.seed_rolling_mill import seed_rolling_mill_template
from app.utils.seed_wire_furnace import seed_wire_furnace_template
from app.utils.seed_wire_drawing import seed_wire_drawing_template
from app.utils.seed_bright_bar import seed_bright_bar_template
from app.utils.seed_forge_grinding import seed_forge_grinding_template
from app.utils.seed_org_roles import seed_org_role_users
from app.utils.seed_patches import patch_eaf_to_iaf, patch_extra_steel_grades, patch_workflow_roles
from app.utils.seed_workforce import seed_workforce_demo


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    async with async_session_factory() as session:
        await seed_all(session)
        await patch_unified_chandan_plant(session)
        await seed_chandan_divisions(session)
        await seed_rolling_mill_template(session)
        await seed_wire_furnace_template(session)
        await seed_wire_drawing_template(session)
        await seed_bright_bar_template(session)
        await seed_forge_grinding_template(session)
        await seed_aod_template(session)
        await patch_aod_calculated_fields(session)
        await seed_concast_template(session)
        await patch_eaf_to_iaf(session)
        await patch_extra_steel_grades(session)
        await patch_workflow_roles(session)
        await seed_org_role_users(session)
        await seed_workforce_demo(session)
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
