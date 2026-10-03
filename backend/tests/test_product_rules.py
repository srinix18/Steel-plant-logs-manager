"""Product rules: who may sign off, what is locked, who sees energy/inventory/cost
masters, and brute-force protection on login."""

from datetime import datetime

import pytest

from tests.test_process_runs import BY_CODE, advance, create_run, transition


# ------------------------------------------------------------ platform admin


async def test_platform_admin_is_read_only_on_logbooks(api):
    run = await create_run(api, BY_CODE["IAF"])
    rid = run["id"]
    await api.ok("admin", "GET", f"/process-runs/{rid}")
    assert (await transition(api, "admin", rid, "in_progress")).status_code == 403
    r = await api.patch("admin", f"/process-runs/{rid}", json={"field_values": [{"field_key": "x", "value": "y"}]})
    assert r.status_code == 403
    instance = run["process_instance_id"]
    assert (await api.post("admin", f"/process-instances/{instance}/runs", json={"run_type": "heat"})).status_code == 403


# ------------------------------------------------------- four-eyes sign-off


async def test_supervisor_cannot_sign_off_own_run(api):
    proc = BY_CODE["IAF"]
    run = await create_run(api, proc, who="sup_iaf")
    rid = run["id"]
    for to_state, _ in proc.path:
        if to_state == "approved":
            break
        assert (await transition(api, "sup_iaf", rid, to_state)).status_code == 200
    r = await transition(api, "sup_iaf", rid, "approved")
    assert r.status_code == 403, r.text
    # A second IAF supervisor (or the HoD) can.
    assert (await transition(api, "sup_sms", rid, "approved")).status_code == 200


async def test_completer_cannot_sign_off(api):
    proc = BY_CODE["GRIND"]
    run = await create_run(api, proc)  # worker creates
    rid = run["id"]
    assert (await transition(api, "sup_forge", rid, "in_progress")).status_code == 200
    assert (await transition(api, "sup_forge", rid, "completed")).status_code == 200
    assert (await transition(api, "sup_forge", rid, "closed")).status_code == 403
    assert (await transition(api, "hod_forge", rid, "closed")).status_code == 200


# --------------------------------------------------------------- run locking


@pytest.mark.parametrize("code", ["IAF", "RMILL"])
async def test_approved_run_is_locked_but_remarks_allowed(api, code):
    proc = BY_CODE[code]
    run = await create_run(api, proc)
    rid = run["id"]
    await advance(api, proc, rid, until="closed")
    assert (await api.ok("admin", "GET", f"/process-runs/{rid}"))["current_state"] == "approved"
    r = await api.patch(proc.worker, f"/process-runs/{rid}", json={"field_values": [{"field_key": "x", "value": "late"}]})
    assert r.status_code == 409
    await api.ok(proc.supervisor, "POST", f"/process-runs/{rid}/remarks", status=201, json={"body": "Reviewed"})


async def test_completed_run_still_editable_before_sign_off(api):
    proc = BY_CODE["RMILL"]
    run = await create_run(api, proc)
    await advance(api, proc, run["id"], until="approved")
    await api.ok(proc.supervisor, "PATCH", f"/process-runs/{run['id']}",
                 json={"field_values": [{"field_key": "remarks_test", "value": "corrected"}]})


# ------------------------------------------------------ energy / inventory


@pytest.mark.parametrize("who,expected", [
    ("worker_sms", 403), ("hr", 403), ("sup_iaf", 200), ("maint_energy", 200), ("hod_sms", 200), ("ceo", 200),
])
async def test_energy_access(api, who, expected):
    plant = api.user("sup_iaf")["plant_id"]
    assert (await api.get(who, f"/energy/plant/{plant}")).status_code == expected


@pytest.mark.parametrize("who,expected", [
    ("worker_sms", 403), ("hr", 403), ("sup_iaf", 403), ("maint_energy", 403), ("hod_sms", 200), ("ceo", 200),
])
async def test_inventory_view_access(api, who, expected):
    plant = api.user("sup_iaf")["plant_id"]
    assert (await api.get(who, f"/inventory-pulse/{plant}")).status_code == expected


async def test_inventory_adjust_is_management_only(api):
    plant = api.user("sup_iaf")["plant_id"]
    items = await api.ok("ceo", "GET", f"/inventory-pulse/{plant}")
    body = {"material_code": items[0]["material_code"], "quantity": items[0]["quantity"]}
    for who in ("worker_sms", "sup_iaf", "hod_sms", "hr"):
        assert (await api.post(who, f"/inventory-pulse/{plant}/adjust", json=body)).status_code == 403, who
    await api.ok("ceo", "POST", f"/inventory-pulse/{plant}/adjust", json=body)


# --------------------------------------------------------------- cost rates


@pytest.mark.parametrize("path", ["raw-materials", "power", "fuel", "labour", "maintenance"])
@pytest.mark.parametrize("who,expected", [("sup_iaf", 403), ("worker_sms", 403), ("hod_sms", 200), ("ceo", 200)])
async def test_cost_masters_are_managers_only(api, path, who, expected):
    assert (await api.get(who, f"/finance/masters/{path}")).status_code == expected


async def test_supervisor_keeps_department_cost_dashboard(api):
    await api.ok("sup_iaf", "GET", f"/finance/dashboard/departments/{api.user('sup_iaf')['department_id']}")


# ------------------------------------------------------------ login lockout


async def test_login_lockout_after_repeated_failures(api, client):
    org = api.user("ceo")["organisation_id"]
    email = f"lockout.{datetime.now().strftime('%H%M%S%f')}@chandansteel.com"
    await api.ok("ceo", "POST", f"/organisations/{org}/users", json={
        "email": email, "password": "right-pass", "full_name": "Lockout Test", "role": "worker",
        "department_id": api.user("worker_sms")["department_id"], "plant_id": api.user("worker_sms")["plant_id"],
    })
    headers = {"X-Forwarded-For": "10.9.9.9"}
    for _ in range(5):
        r = await client.post("/auth/login", json={"email": email, "password": "wrong"}, headers=headers)
        assert r.status_code == 401
    r = await client.post("/auth/login", json={"email": email, "password": "right-pass"}, headers=headers)
    assert r.status_code == 429
    assert "Retry-After" in r.headers
    # Other accounts are unaffected.
    r = await client.post("/auth/login", json={"email": "ceo@chandansteel.com", "password": "ceo123"}, headers=headers)
    assert r.status_code == 200


async def test_success_resets_failure_count(client):
    email, pw = "worker.forge@chandansteel.com", "forge123"
    headers = {"X-Forwarded-For": "10.8.8.8"}
    for _ in range(4):
        await client.post("/auth/login", json={"email": email, "password": "wrong"}, headers=headers)
    assert (await client.post("/auth/login", json={"email": email, "password": pw}, headers=headers)).status_code == 200
    for _ in range(4):
        await client.post("/auth/login", json={"email": email, "password": "wrong"}, headers=headers)
    assert (await client.post("/auth/login", json={"email": email, "password": pw}, headers=headers)).status_code == 200


async def test_ip_lockout(client):
    headers = {"X-Forwarded-For": "10.7.7.7"}
    for i in range(30):
        await client.post("/auth/login", json={"email": f"spray{i}@chandansteel.com", "password": "x"}, headers=headers)
    r = await client.post("/auth/login", json={"email": "ceo@chandansteel.com", "password": "ceo123"}, headers=headers)
    assert r.status_code == 429


async def test_sign_off_button_hidden_for_ineligible_users(api):
    proc = BY_CODE["RMILL"]
    run = await create_run(api, proc, who="sup_rolling")
    for state in ("in_progress", "completed"):
        assert (await transition(api, "sup_rolling", run["id"], state)).status_code == 200
    own = await api.ok("sup_rolling", "GET", f"/process-runs/{run['id']}")
    assert "approved" not in {t["to_state"] for t in own["workflow"]["available_transitions"]}
    hod = await api.ok("hod_rolling", "GET", f"/process-runs/{run['id']}")
    assert "approved" in {t["to_state"] for t in hod["workflow"]["available_transitions"]}
    admin = await api.ok("admin", "GET", f"/process-runs/{run['id']}")
    assert admin["workflow"]["available_transitions"] == []
