from typing import Any

import httpx

# key -> (email, password); mirrors LOGINS.md / mobile ALL_DEMO_LOGINS
ACCOUNTS: dict[str, tuple[str, str]] = {
    "admin": ("admin@chandansteel.com", "Admin@123"),
    "ceo": ("ceo@chandansteel.com", "Ceo@123"),
    "hr": ("hr@chandansteel.com", "Hr@123"),
    "hod_sms": ("hod.sms@chandansteel.com", "Hod@123"),
    "sup_iaf": ("sup.iaf@chandansteel.com", "Sup@123"),
    "sup_aod": ("sup.aod@chandansteel.com", "Sup@123"),
    "sup_ccm": ("sup.ccm@chandansteel.com", "Sup@123"),
    "sup_sms": ("sup.sms@chandansteel.com", "Sup@123"),
    "worker_sms": ("op.sms@chandansteel.com", "Op@123"),
    "maint_quality": ("maint.quality@chandansteel.com", "Maint@123"),
    "maint_safety": ("maint.safety@chandansteel.com", "Maint@123"),
    "maint_energy": ("maint.energy@chandansteel.com", "Maint@123"),
    "maint_equipment": ("maint.equipment@chandansteel.com", "Maint@123"),
    "maint_process": ("maint.process@chandansteel.com", "Maint@123"),
    "hod_rolling": ("hod.rolling@chandansteel.com", "Hod@123"),
    "sup_rolling": ("sup.rolling@chandansteel.com", "Sup@123"),
    "worker_rolling": ("op.rolling@chandansteel.com", "Op@123"),
    "hod_wire": ("hod.wire@chandansteel.com", "Hod@123"),
    "sup_wire": ("sup.wire@chandansteel.com", "Sup@123"),
    "worker_wire": ("op.wire@chandansteel.com", "Op@123"),
    "hod_bbd": ("hod.bbd@chandansteel.com", "Hod@123"),
    "sup_bbd": ("sup.bbd@chandansteel.com", "Sup@123"),
    "worker_bbd": ("op.bbd@chandansteel.com", "Op@123"),
    "hod_forge": ("hod.forge@chandansteel.com", "Hod@123"),
    "sup_forge": ("sup.forge@chandansteel.com", "Sup@123"),
    "worker_forge": ("op.forge@chandansteel.com", "Op@123"),
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
