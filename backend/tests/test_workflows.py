"""Cross-module workflows: maintenance, leave, attendance, handover, messages,
observations, safety, payroll and user administration — each checked for the
happy path *and* for the roles that must be refused."""

from datetime import date, datetime, timedelta, timezone

import pytest

from tests.test_process_runs import BY_CODE, create_run


def _today() -> str:
    return date.today().isoformat()


# ---------------------------------------------------------------- maintenance


async def test_maintenance_issue_lifecycle(api):
    run = await create_run(api, BY_CODE["IAF"])
    issue = await api.ok("worker_sms", "POST", "/maintenance/issues", status=201, json={
        "run_id": run["id"],
        "category": "equipment",
        "title": "Crucible lining crack",
        "description": "Visible crack on furnace 1",
        "severity": "high",
    })
    iid = issue["id"]
    assert issue["status"] == "open"

    # Visible to the matching division, not to the others.
    eq_queue = await api.ok("maint_equipment", "GET", "/maintenance/issues")
    assert iid in {i["id"] for i in eq_queue}
    q_queue = await api.ok("maint_quality", "GET", "/maintenance/issues")
    assert iid not in {i["id"] for i in q_queue}
    assert (await api.get("maint_quality", f"/maintenance/issues/{iid}")).status_code == 403
    assert (await api.post("maint_quality", f"/maintenance/issues/{iid}/assign")).status_code == 403

    # Equipment maintenance can open the linked run read-only, but not edit it.
    await api.ok("maint_equipment", "GET", f"/process-runs/{run['id']}")
    r = await api.patch("maint_equipment", f"/process-runs/{run['id']}",
                        json={"field_values": [{"field_key": "x", "value": "y"}]})
    assert r.status_code == 403
    assert (await api.get("maint_quality", f"/process-runs/{run['id']}")).status_code == 403

    # Non-maintenance roles cannot assign/close.
    assert (await api.post("sup_iaf", f"/maintenance/issues/{iid}/assign")).status_code == 403

    assigned = await api.ok("maint_equipment", "POST", f"/maintenance/issues/{iid}/assign")
    assert assigned["status"] == "in_progress"
    mine = await api.ok("maint_equipment", "GET", "/maintenance/issues/mine")
    assert iid in {i["id"] for i in mine}

    closed = await api.ok("maint_equipment", "POST", f"/maintenance/issues/{iid}/close",
                          json={"resolution_notes": "Relined"})
    assert closed["status"] == "closed"

    # Raiser's department chain can see it; another department cannot.
    for who in ("sup_iaf", "hod_sms", "ceo"):
        await api.ok(who, "GET", f"/maintenance/issues/{iid}")
    assert (await api.get("hod_rolling", f"/maintenance/issues/{iid}")).status_code == 403


async def test_hod_and_hr_cannot_raise_maintenance_issue(api):
    for who in ("hod_sms", "hr", "ceo"):
        r = await api.post(who, "/maintenance/issues", json={
            "category": "safety", "title": "t", "description": "d", "severity": "low",
        })
        assert r.status_code in (400, 403), f"{who} -> {r.status_code}"


# ---------------------------------------------------------------------- leave


async def _leave_type(api, who="worker_sms") -> str:
    types = await api.ok(who, "GET", "/workforce/leave/types")
    assert types, "no leave types seeded"
    return types[0]["id"]


async def _request_leave(api, who: str, days_ahead: int) -> dict:
    start = date.today() + timedelta(days=days_ahead)
    return await api.ok(who, "POST", "/workforce/leave/requests", status=(200, 201), json={
        "leave_type_id": await _leave_type(api, who),
        "from_date": start.isoformat(),
        "to_date": (start + timedelta(days=1)).isoformat(),
        "remarks": "family function",
    })


async def test_leave_request_approved_by_own_hod(api):
    req = await _request_leave(api, "worker_sms", 30)
    assert req["status"] == "pending"
    mine = await api.ok("worker_sms", "GET", "/workforce/leave/requests/mine")
    assert req["id"] in {r["id"] for r in mine}

    # Peers cannot decide.
    for who in ("worker_sms", "sup_iaf"):
        r = await api.post(who, f"/workforce/leave/requests/{req['id']}/approve", json={})
        assert r.status_code == 403, f"{who} -> {r.status_code}"

    approved = await api.ok("hod_sms", "POST", f"/workforce/leave/requests/{req['id']}/approve", json={})
    assert approved["status"] == "approved"
    again = await api.post("hr", f"/workforce/leave/requests/{req['id']}/reject", json={})
    assert again.status_code == 400


async def test_leave_rejected_by_hr(api):
    req = await _request_leave(api, "worker_rolling", 40)
    rejected = await api.ok("hr", "POST", f"/workforce/leave/requests/{req['id']}/reject", json={"remarks": "peak"})
    assert rejected["status"] == "rejected"


async def test_hod_cannot_decide_other_department_leave(api):
    req = await _request_leave(api, "worker_sms", 50)
    r = await api.post("hod_rolling", f"/workforce/leave/requests/{req['id']}/approve", json={})
    assert r.status_code == 403, f"Rolling HoD approved SMS leave: {r.status_code}"


async def test_hod_cannot_approve_own_leave(api):
    req = await _request_leave(api, "hod_sms", 60)
    r = await api.post("hod_sms", f"/workforce/leave/requests/{req['id']}/approve", json={})
    assert r.status_code == 403, f"HoD self-approved leave: {r.status_code}"


async def test_leave_dates_validated(api):
    r = await api.post("worker_sms", "/workforce/leave/requests", json={
        "leave_type_id": await _leave_type(api),
        "from_date": "2026-12-10",
        "to_date": "2026-12-01",
    })
    assert r.status_code in (400, 422)


# ------------------------------------------------------- attendance / handover


async def _dept_and_shift(api, who: str) -> tuple[str, str]:
    dept = api.user(who)["department_id"]
    shifts = await api.ok(who, "GET", "/workforce/shifts")
    return dept, shifts[0]["id"]


async def test_hr_marks_attendance_and_worker_sees_it(api):
    dept, shift = await _dept_and_shift(api, "hr")
    sms_dept = api.user("worker_sms")["department_id"]
    worker_id = api.user("worker_sms")["id"]
    await api.ok("hr", "POST", "/workforce/attendance/bulk", json={
        "attendance_date": _today(),
        "department_id": sms_dept,
        "shift_id": shift,
        "entries": [{"user_id": worker_id, "status": "present"}],
    })
    me = await api.ok("worker_sms", "GET", "/workforce/me")
    assert me is not None


@pytest.mark.parametrize("who", ["worker_sms", "sup_iaf", "hod_sms"])
async def test_only_hr_or_admin_mark_attendance(api, who):
    _, shift = await _dept_and_shift(api, "hr")
    r = await api.post(who, "/workforce/attendance/bulk", json={
        "attendance_date": _today(),
        "department_id": api.user("worker_sms")["department_id"],
        "shift_id": shift,
        "entries": [{"user_id": api.user("worker_sms")["id"], "status": "absent"}],
    })
    assert r.status_code == 403, f"{who} -> {r.status_code}"


async def test_handover_notes(api):
    dept, shift = await _dept_and_shift(api, "sup_iaf")
    await api.ok("sup_iaf", "POST", "/workforce/handover-notes", json={
        "note_date": _today(), "department_id": dept, "shift_id": shift, "note": "Furnace 2 on low power",
    })
    notes = await api.ok("worker_sms", "GET", "/workforce/handover-notes",
                         params={"department_id": dept, "note_date": _today()})
    assert notes is not None
    # Another department's supervisor cannot write SMS notes; a worker cannot write at all.
    for who in ("sup_rolling", "worker_sms"):
        r = await api.post(who, "/workforce/handover-notes", json={
            "note_date": _today(), "department_id": dept, "shift_id": shift, "note": "x",
        })
        assert r.status_code == 403, f"{who} -> {r.status_code}"


# ------------------------------------------------------------------- messages


async def test_message_send_and_receive(api):
    sup_id = api.user("sup_iaf")["id"]
    msg = await api.ok("worker_sms", "POST", "/messages", status=(200, 201), json={
        "subject": "Need ladle", "body": "Ladle 3 not available", "recipient_ids": [sup_id],
    })
    inbox = await api.ok("sup_iaf", "GET", "/messages/inbox")
    assert any(m["id"] == msg["id"] for m in inbox) or any(
        m.get("message", {}).get("id") == msg["id"] for m in inbox
    )
    sent = await api.ok("worker_sms", "GET", "/messages/sent")
    assert sent
    # Non-recipients cannot read it.
    assert (await api.get("worker_rolling", f"/messages/{msg['id']}")).status_code in (403, 404)


async def test_worker_cannot_message_other_department(api):
    r = await api.post("worker_sms", "/messages", json={
        "subject": "hi", "body": "x", "recipient_ids": [api.user("worker_rolling")["id"]],
    })
    assert r.status_code in (400, 403)


async def test_worker_cannot_broadcast(api):
    r = await api.post("worker_sms", "/messages", json={"subject": "all", "body": "x", "is_broadcast": True})
    assert r.status_code in (400, 403)


# ------------------------------------------------------- observations / CAPA


async def test_observation_to_corrective_action(api):
    plant = api.user("sup_iaf")["plant_id"]
    obs = await api.ok("sup_iaf", "POST", "/observations", status=(200, 201), json={
        "plant_id": plant, "category": "safety", "description": "Missing guard on conveyor", "severity": "high",
    })
    ca = await api.ok("sup_iaf", "POST", f"/observations/{obs['id']}/corrective-actions", status=(200, 201), json={
        "title": "Install guard", "assigned_to": api.user("worker_sms")["id"], "priority": "high",
    })
    done = await api.ok("sup_iaf", "PATCH", f"/corrective-actions/{ca['id']}",
                        json={"status": "completed", "closure_notes": "Guard fitted"})
    assert done["status"] == "completed"
    assert (await api.get("worker_sms", "/observations")).status_code == 403


# --------------------------------------------------------------------- safety


async def test_safety_incident_and_inspection(api):
    plant = api.user("sup_iaf")["plant_id"]
    await api.ok("sup_iaf", "POST", f"/safety/incidents/{plant}", json={
        "title": "Slip near tundish", "description": "Wet floor", "severity": "medium",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    })
    await api.ok("sup_iaf", "POST", f"/safety/inspections/{plant}", json={
        "inspection_type": "fire_extinguisher", "findings": "OK",
    })
    incidents = await api.ok("ceo", "GET", f"/safety/incidents/{plant}")
    assert incidents


# -------------------------------------------------------------------- payroll


async def test_payroll_run_is_hr_only(api):
    plant = api.user("hr")["plant_id"] or api.user("ceo")["plant_id"]
    if not plant:
        plants = await api.ok("admin", "GET", "/plants")
        plant = plants[0]["id"]
    for who in ("worker_sms", "sup_iaf", "hod_sms"):
        r = await api.post(who, "/workforce/payroll/runs", json={"plant_id": plant, "month": 1, "year": 2026})
        assert r.status_code == 403, f"{who} -> {r.status_code}"
    run = await api.ok("hr", "POST", "/workforce/payroll/runs", json={"plant_id": plant, "month": 2, "year": 2026})
    await api.ok("hr", "POST", f"/workforce/payroll/runs/{run['id']}/process")
    items = await api.ok("hr", "GET", f"/workforce/payroll/runs/{run['id']}/line-items")
    assert isinstance(items, list)
    # Workers only see their own payslips.
    await api.ok("worker_sms", "GET", "/workforce/payroll/payslips/mine")
    others = [i for i in items if i.get("user_id") != api.user("worker_sms")["id"]]
    if others:
        r = await api.get("worker_sms", f"/workforce/payroll/payslips/{others[0]['id']}")
        assert r.status_code in (403, 404), f"worker read someone else's payslip: {r.status_code}"
    assert (await api.get("worker_sms", f"/workforce/payroll/runs/{run['id']}/line-items")).status_code == 403


# ------------------------------------------------------------ user management


async def test_ceo_creates_user_who_can_login(api, client):
    org = api.user("ceo")["organisation_id"]
    dept = api.user("worker_sms")["department_id"]
    email = f"pytest.worker.{datetime.now().strftime('%H%M%S%f')}@chandansteel.com"
    created = await api.ok("ceo", "POST", f"/organisations/{org}/users", status=(200, 201), json={
        "email": email, "password": "secret123", "full_name": "Pytest Worker",
        "role": "worker", "department_id": dept, "plant_id": api.user("worker_sms")["plant_id"],
    })
    r = await client.post("/auth/login", json={"email": email, "password": "secret123"})
    assert r.status_code == 200

    # Deactivate -> can no longer log in / use token.
    token = r.json()["access_token"]
    await api.ok("ceo", "PATCH", f"/organisations/{org}/users/{created['id']}", json={"is_active": False})
    assert (await client.post("/auth/login", json={"email": email, "password": "secret123"})).status_code in (401, 403)
    assert (await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})).status_code == 401


@pytest.mark.parametrize("who", ["hod_sms", "sup_iaf", "worker_sms", "hr", "maint_quality"])
async def test_only_ceo_or_admin_create_org_users(api, who):
    org = api.user("ceo")["organisation_id"]
    r = await api.post(who, f"/organisations/{org}/users", json={
        "email": f"nope.{who}@chandansteel.com", "password": "secret123", "full_name": "Nope", "role": "worker",
    })
    assert r.status_code == 403


async def test_ceo_cannot_create_super_admin(api):
    org = api.user("ceo")["organisation_id"]
    r = await api.post("ceo", f"/organisations/{org}/users", json={
        "email": "evil.admin@chandansteel.com", "password": "secret123", "full_name": "Evil", "role": "super_admin",
    })
    assert r.status_code in (400, 403, 422)


async def test_user_cannot_escalate_own_role_via_profile(api):
    r = await api.patch("worker_sms", "/auth/me", json={"role": "super_admin", "full_name": "Plant Melter"})
    assert r.status_code in (200, 422)
    me = await api.ok("worker_sms", "GET", "/auth/me")
    assert me["role"] in ("worker", "WORKER")


async def test_leave_list_scoping(api):
    req = await _request_leave(api, "worker_sms", 70)
    victim = api.user("worker_sms")["id"]
    # A worker in another department cannot read it via ?user_id=
    leaked = await api.ok("worker_rolling", "GET", "/workforce/leave/requests", params={"user_id": victim})
    assert req["id"] not in {r["id"] for r in leaked}
    # Own HoD sees it (so they can act on it); other HoD does not.
    assert req["id"] in {r["id"] for r in await api.ok("hod_sms", "GET", "/workforce/leave/requests")}
    assert req["id"] not in {r["id"] for r in await api.ok("hod_rolling", "GET", "/workforce/leave/requests")}
    assert req["id"] in {r["id"] for r in await api.ok("hr", "GET", "/workforce/leave/requests")}


async def test_plant_users_unknown_plant(api):
    import uuid

    assert (await api.get("worker_sms", f"/plants/{uuid.uuid4()}/users")).status_code == 404
    own = await api.ok("worker_sms", "GET", f"/plants/{api.user('worker_sms')['plant_id']}/users")
    assert own
