from fastapi import APIRouter

from app.api.v1 import analytics, auth, maintenance, messages, operations, platform, process_runs, templates_moi, websocket

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(platform.router, tags=["Platform"])
api_router.include_router(messages.router, tags=["Messages"])
api_router.include_router(maintenance.router, tags=["Maintenance"])
api_router.include_router(templates_moi.router, prefix="/templates", tags=["Templates"])
api_router.include_router(process_runs.router, tags=["Process Runs"])
api_router.include_router(operations.router, tags=["Operations"])
api_router.include_router(analytics.router, tags=["Analytics"])
api_router.include_router(websocket.router, tags=["WebSocket"])
