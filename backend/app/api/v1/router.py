from fastapi import APIRouter

from app.api.v1 import analytics, auth, bright_bar, finance, foundation, maintenance, messages, operations, platform, process_runs, rolling_mill, templates_moi, websocket, wire, workforce

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(platform.router, tags=["Platform"])
api_router.include_router(messages.router, tags=["Messages"])
api_router.include_router(maintenance.router, tags=["Maintenance"])
api_router.include_router(templates_moi.router, prefix="/templates", tags=["Templates"])
api_router.include_router(process_runs.router, tags=["Process Runs"])
api_router.include_router(rolling_mill.router, tags=["Rolling Mill"])
api_router.include_router(wire.router, tags=["Wire Division"])
api_router.include_router(bright_bar.router, tags=["Bright Bar"])
api_router.include_router(workforce.router, tags=["Workforce"])
api_router.include_router(finance.router, tags=["Finance"])
api_router.include_router(operations.router, tags=["Operations"])
api_router.include_router(analytics.router, tags=["Analytics"])
api_router.include_router(foundation.router, tags=["Foundation"])
api_router.include_router(websocket.router, tags=["WebSocket"])
