from typing import Any

import httpx

# key -> (email, password); mirrors LOGINS.md / mobile ALL_DEMO_LOGINS
ACCOUNTS: dict[str, tuple[str, str]] = {
    "admin": ("admin@logbook.app", "admin123"),
    "ceo": ("ceo@chandansteel.com", "ceo123"),
    "hr": ("hr@chandansteel.com", "hr123"),
    "hod_sms": ("hod@chandansteel.com", "hod123"),
    "sup_iaf": ("iaf.supervisor@chandansteel.com", "iaf123"),
    "sup_aod": ("aod.supervisor@chandansteel.com", "aod123"),
    "sup_ccm": ("ccm.supervisor@chandansteel.com", "ccm123"),
    "sup_sms": ("supervisor@chandansteel.com", "supervisor123"),
    "worker_sms": ("melter@chandansteel.com", "worker123"),
    "maint_quality": ("maint.quality@chandansteel.com", "maint123"),
    "maint_safety": ("maint.safety@chandansteel.com", "maint123"),
    "maint_energy": ("maint.energy@chandansteel.com", "maint123"),
    "maint_equipment": ("maint.equipment@chandansteel.com", "maint123"),
    "maint_process": ("maint.process@chandansteel.com", "maint123"),
    "hod_rolling": ("hod.rolling@chandansteel.com", "hod123"),
    "sup_rolling": ("supervisor.rolling@chandansteel.com", "rolling123"),
    "worker_rolling": ("worker.rolling@chandansteel.com", "rolling123"),
    "hod_wire": ("hod.wire@chandansteel.com", "hod123"),
    "sup_wire": ("supervisor.wire@chandansteel.com", "wire123"),
    "worker_wire": ("worker.wire@chandansteel.com", "wire123"),
    "hod_bbd": ("hod.bbd@chandansteel.com", "hod123"),
    "sup_bbd": ("supervisor.bbd@chandansteel.com", "bbd123"),
    "worker_bbd": ("worker.bbd@chandansteel.com", "bbd123"),
    "hod_forge": ("hod.forge@chandansteel.com", "hod123"),
    "sup_forge": ("supervisor.forge@chandansteel.com", "forge123"),
    "worker_forge": ("worker.forge@chandansteel.com", "forge123"),
}


class Api:
    """Thin per-role request helper: ``await api.get("ceo", "/plants")``."""

    def __init__(self, client: httpx.AsyncClient, tokens: dict[str, dict]):
        self.client = client
        self.tokens = tokens

    def user(self, who: str) -> dict:
        return self.tokens[who]["user"]

    def _h(self, who: str | None) -> dict:
        return {"Authorization": f"Bearer {self.tokens[who]['token']}"} if who else {}

    async def req(self, who: str | None, method: str, path: str, **kw: Any) -> httpx.Response:
        return await self.client.request(method, path, headers=self._h(who), **kw)

    async def get(self, who, path, **kw):
        return await self.req(who, "GET", path, **kw)

    async def post(self, who, path, **kw):
        return await self.req(who, "POST", path, **kw)

    async def patch(self, who, path, **kw):
        return await self.req(who, "PATCH", path, **kw)

    async def ok(self, who, method, path, status=(200, 201), **kw) -> Any:
        r = await self.req(who, method, path, **kw)
        allowed = (status,) if isinstance(status, int) else status
        assert r.status_code in allowed, f"{who} {method} {path} -> {r.status_code}: {r.text[:500]}"
        return r.json() if r.content else None
