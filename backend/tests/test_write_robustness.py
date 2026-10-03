"""Every mutating endpoint, called with junk input (empty body, unknown ids),
must answer with a 4xx — never a 500 — for every class of role."""

import re
import uuid

import pytest
from fastapi.routing import APIRoute

from app.main import app

PREFIX = "/api/v1"
ROLES = ["admin", "ceo", "hr", "hod_sms", "sup_iaf", "worker_sms", "maint_equipment"]
SKIP = {"/auth/login"}


def _routes() -> list[tuple[str, str]]:
    seen, out = set(), []
    for r in app.routes:
        if not isinstance(r, APIRoute) or not r.path.startswith(PREFIX):
            continue
        path = r.path[len(PREFIX):]
        if path in SKIP:
            continue
        for m in sorted(r.methods & {"POST", "PATCH", "PUT", "DELETE"}):
            if (m, path) not in seen:
                seen.add((m, path))
                out.append((m, path))
    return out


@pytest.mark.parametrize("method,route", _routes(), ids=lambda v: v if isinstance(v, str) else None)
async def test_junk_input_never_500s(api, method, route):
    missing = str(uuid.uuid4())

    def fill(m):
        name = m.group(1)
        if name == "module_key":
            return "employees"
        if name == "entity_type":
            return "observation"
        if name == "plant_id":
            return api.user("sup_iaf")["plant_id"]
        return missing

    path = re.sub(r"\{(\w+)\}", fill, route)
    failures = []
    for who in ROLES:
        kw = {} if method == "DELETE" else {"json": {}}
        r = await api.req(who, method, path, **kw)
        if r.status_code >= 500:
            failures.append(f"{who}: {r.status_code} {r.text[:200]}")
    assert not failures, "\n".join(failures)
