"""Every role hits every GET endpoint. No endpoint may 5xx for any role.

Path params are filled from the caller's own scope (plant / department) or from
a real seeded entity, so these exercise real queries, not just 404 paths.
"""

import re

import pytest
from fastapi.routing import APIRoute

from app.main import app
from tests.helpers import ACCOUNTS

PREFIX = "/api/v1"
SKIP_PARAMS = set()


def _get_routes() -> list[str]:
    seen, out = set(), []
    for r in app.routes:
        if isinstance(r, APIRoute) and "GET" in r.methods and r.path.startswith(PREFIX):
            p = r.path[len(PREFIX):]
            if p not in seen:
                seen.add(p)
                out.append(p)
    return out


GET_ROUTES = _get_routes()


@pytest.fixture(scope="session")
async def ids(api):
    """Real IDs for path params, resolved with the admin token."""
    a = "admin"
    plants = await api.ok(a, "GET", "/plants")
    depts = await api.ok(a, "GET", "/departments")
    processes = await api.ok(a, "GET", "/processes")
    assets = await api.ok(a, "GET", "/assets")
    orgs = await api.ok(a, "GET", "/organisations")
    grades = await api.ok(a, "GET", "/steel-grades")
    shifts = await api.ok(a, "GET", "/shifts")
    cs = next(p for p in plants if p.get("code") == "CS") if any(p.get("code") == "CS" for p in plants) else plants[0]
    return {
        "plant_id": cs["id"],
        "department_id": depts[0]["id"],
        "dept_id": depts[0]["id"],
        "process_id": processes[0]["id"],
        "asset_id": assets[0]["id"] if assets else None,
        "org_id": next((o["id"] for o in orgs if o.get("code") == "CHANDAN"), orgs[0]["id"]),
        "grade_id": grades[0]["id"] if grades else None,
        "shift_id": shifts[0]["id"] if shifts else None,
    }


def _fill(path: str, who_user: dict, ids: dict) -> str | None:
    def sub(m):
        name = m.group(1)
        if name == "plant_id" and who_user.get("plant_id"):
            return who_user["plant_id"]
        if name in ("department_id", "dept_id") and who_user.get("department_id"):
            return who_user["department_id"]
        if name == "scope_type":
            return "plant"
        if name == "scope_id":
            return ids["plant_id"]
        if name == "module_key":
            return "employees"
        if name == "entity_type":
            return "observation"
        val = ids.get(name)
        if val is None:
            raise KeyError(name)
        return val

    try:
        return re.sub(r"\{(\w+)\}", sub, path)
    except KeyError:
        return None


@pytest.mark.parametrize("route", GET_ROUTES)
async def test_get_endpoint_never_500s(api, ids, route):
    failures = []
    for who in ACCOUNTS:
        path = _fill(route, api.user(who), ids)
        if path is None:
            pytest.skip("needs an entity id produced by a workflow test")
        r = await api.get(who, path)
        if r.status_code >= 500:
            failures.append(f"{who}: {r.status_code} {r.text[:200]}")
    assert not failures, "\n".join(failures)
