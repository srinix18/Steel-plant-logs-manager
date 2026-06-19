import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.security import decode_access_token
from app.db.models import OperationalEvent, ProcessRun
from app.db.session import async_session_factory

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, channel: str, websocket: WebSocket):
        await websocket.accept()
        self.active.setdefault(channel, []).append(websocket)

    def disconnect(self, channel: str, websocket: WebSocket):
        if channel in self.active:
            self.active[channel] = [w for w in self.active[channel] if w != websocket]

    async def broadcast(self, channel: str, message: dict):
        for ws in self.active.get(channel, []):
            try:
                await ws.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@router.websocket("/ws/plants/{plant_id}/runs")
async def plant_runs_ws(websocket: WebSocket, plant_id: UUID, token: str):
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001)
        return
    channel = f"plant:{plant_id}"
    await manager.connect(channel, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(channel, websocket)


@router.websocket("/ws/process-runs/{run_id}")
async def run_events_ws(websocket: WebSocket, run_id: UUID, token: str):
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001)
        return
    channel = f"run:{run_id}"
    await manager.connect(channel, websocket)
    try:
        async with async_session_factory() as session:
            result = await session.execute(
                select(OperationalEvent)
                .where(OperationalEvent.run_id == run_id)
                .order_by(OperationalEvent.occurred_at.desc())
                .limit(20)
            )
            for event in reversed(result.scalars().all()):
                await websocket.send_json(
                    {
                        "type": "event",
                        "event_type": event.event_type,
                        "occurred_at": event.occurred_at.isoformat(),
                        "payload": event.payload,
                    }
                )
            run = await session.get(ProcessRun, run_id)
            if run:
                await websocket.send_json({"type": "state", "current_state": run.current_state})
        while True:
            await asyncio.sleep(30)
            async with async_session_factory() as session:
                run = await session.get(ProcessRun, run_id)
                if run:
                    await websocket.send_json({"type": "state", "current_state": run.current_state})
    except WebSocketDisconnect:
        manager.disconnect(channel, websocket)
