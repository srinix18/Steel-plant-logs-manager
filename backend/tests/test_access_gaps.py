"""Access gaps found while testing every role against the running app: things the server
used to allow although no app screen offers them."""

from datetime import datetime, timezone

from tests.test_process_runs import BY_CODE, create_run


def _unique(prefix: str) -> str:
    return f"{prefix}{datetime.now(timezone.utc).strftime('%H%M%S%f')}"


# ------------------------------------------------------ maintenance issues


async def test_who_can_raise_maintenance_issues(api):
    body = {"title": _unique("gap"), "description": "x", "category": "equipment", "severity": "low"}
    # Floor staff (supervisors and workers) raise issues; management and the crew do not.
    for who in ("sup_iaf", "worker_sms"):
        assert (await api.post(who, "/maintenance/issues", json=body)).status_code == 201
    for who in ("hod_sms", "ceo", "hr", "maint_equipment"):
        r = await api.post(who, "/maintenance/issues", json=body)
        assert r.status_code == 403, f"{who} -> {r.status_code}"


async def test_hr_cannot_read_maintenance_issues(api):
    body = {"title": _unique("hr"), "description": "x", "category": "equipment", "severity": "low"}
    issue = await api.ok("sup_iaf", "POST", "/maintenance/issues", json=body)
    listing = await api.ok("hr", "GET", "/maintenance/issues")
    assert listing == []
    assert (await api.get("hr", f"/maintenance/issues/{issue['id']}")).status_code == 403


# ------------------------------------------------------------------ safety


def _incident():
    return {
        "title": _unique("inc"),
        "description": "x",
        "severity": "low",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    }


async def test_safety_writes_are_role_gated(api):
    plant = api.user("sup_iaf")["plant_id"]
    for who in ("worker_sms", "sup_iaf", "maint_safety", "hod_sms", "ceo"):
        r = await api.post(who, f"/safety/incidents/{plant}", json=_incident())
        assert r.status_code == 201, f"{who} incident -> {r.status_code} {r.text[:120]}"
    assert (await api.post("hr", f"/safety/incidents/{plant}", json=_incident())).status_code == 403
    insp = {"inspection_type": "guide", "findings": "ok"}
    for who in ("sup_iaf", "maint_safety", "hod_sms", "ceo"):
        r = await api.post(who, f"/safety/inspections/{plant}", json=insp)
        assert r.status_code == 201, f"{who} inspection -> {r.status_code}"
    for who in ("worker_sms", "hr"):
        assert (await api.post(who, f"/safety/inspections/{plant}", json=insp)).status_code == 403


# --------------------------------------------------------------- run events


async def test_run_events_follow_run_access(api):
    run = await create_run(api, BY_CODE["IAF"])
    rid = run["id"]
    for who in ("worker_sms", "sup_iaf", "hod_sms", "ceo", "admin"):
        assert (await api.get(who, f"/process-runs/{rid}/events")).status_code == 200, who
    for who in ("hr", "maint_quality", "worker_rolling", "hod_rolling"):
        assert (await api.get(who, f"/process-runs/{rid}/events")).status_code == 403, who


async def test_event_ingest_needs_supervisor_or_above(api):
    r = await api.post("worker_sms", "/integrations/events", json=[])
    assert r.status_code == 403
    r = await api.post("sup_iaf", "/integrations/events", json=[])
    assert r.status_code == 200


# ---------------------------------------------------------------- documents


async def _upload(api, who, plant_id, department_id, title):
    files = {"file": ("sop.pdf", b"%PDF-1.4 test", "application/pdf")}
    data = {"plant_id": plant_id, "department_id": department_id, "category": "sop", "title": title, "version": "1"}
    return await api.client.post(
        "/foundation/documents", headers=api._h(who), data=data, files=files
    )


async def test_documents_are_scoped_to_the_department(api):
    plant = api.user("hod_sms")["plant_id"]
    sms = api.user("hod_sms")["department_id"]
    rolling = api.user("hod_rolling")["department_id"]
    title = _unique("doc")
    assert (await _upload(api, "hod_sms", plant, sms, title)).status_code == 201
    # A HoD uploads for their own department only; CEO tier and HR may upload anywhere.
    assert (await _upload(api, "hod_sms", plant, rolling, _unique("x"))).status_code == 403
    assert (await _upload(api, "hr", plant, rolling, _unique("hr"))).status_code == 201
    # Workers see their own department's documents, not another department's, even when asking for it.
    mine = await api.ok("worker_sms", "GET", "/foundation/documents", params={"department_id": sms})
    assert any(d["title"] == title for d in mine)
    other = await api.ok("worker_rolling", "GET", "/foundation/documents", params={"department_id": sms})
    assert not any(d["title"] == title for d in other)
    # CEO and HR still see everything.
    everything = await api.ok("ceo", "GET", "/foundation/documents")
    assert any(d["title"] == title for d in everything)


# ------------------------------------------------------------------- assets


async def test_asset_rules(api):
    plant = api.user("hod_sms")["plant_id"]
    sms = api.user("hod_sms")["department_id"]
    rolling = api.user("hod_rolling")["department_id"]
    groups = await api.ok("ceo", "GET", "/foundation/asset-groups", params={"plant_id": plant})
    group = groups[0]["id"]
    no = _unique("A")
    body = {"plant_id": plant, "group_id": group, "asset_no": no, "name": "gap asset", "department_id": sms}
    created = await api.ok("hod_sms", "POST", "/foundation/assets", json=body, status=201)
    # Duplicate Asset No is a clear conflict, not a server error.
    dup = await api.post("hod_sms", "/foundation/assets", json=body)
    assert dup.status_code == 409 and "already exists" in dup.json()["detail"]
    # A HoD manages their own department's assets only.
    other = dict(body, asset_no=_unique("B"), department_id=rolling)
    assert (await api.post("hod_sms", "/foundation/assets", json=other)).status_code == 403
    assert (await api.patch("hod_rolling", f"/foundation/assets/{created['id']}", json={"name": "x"})).status_code == 403
    assert (await api.post("ceo", "/foundation/assets", json=other)).status_code == 201


# -------------------------------------------------------------- work orders


async def test_work_order_needs_tasks_done_before_completing(api):
    plant = api.user("ceo")["plant_id"]
    program = await api.ok("ceo", "POST", "/maintenance/pm/programs", json={
        "plant_id": plant, "name": _unique("PM"), "category": "equipment", "priority": "low",
        "status": "active", "auto_generate_work_orders": False,
    })
    await api.ok("ceo", "POST", f"/maintenance/pm/programs/{program['id']}/tasks", json={"name": "Check", "is_required": True, "sort_order": 1})
    wo = await api.ok("ceo", "POST", f"/maintenance/pm/programs/{program['id']}/generate-work-order", status=201)
    wid = wo["id"]
    for who, to in (("hod_sms", "assigned"), ("maint_equipment", "accepted"), ("maint_equipment", "in_progress")):
        await api.ok(who, "POST", f"/maintenance/pm/work-orders/{wid}/transition", json={"to_state": to})
    early = await api.post("maint_equipment", f"/maintenance/pm/work-orders/{wid}/transition", json={"to_state": "completed"})
    assert early.status_code == 400
    task = (await api.ok("ceo", "GET", f"/maintenance/pm/work-orders/{wid}"))["tasks"][0]
    await api.ok("maint_equipment", "POST", f"/maintenance/pm/work-orders/{wid}/tasks/{task['id']}/execute", json={"status": "pass"})
    await api.ok("maint_equipment", "POST", f"/maintenance/pm/work-orders/{wid}/transition", json={"to_state": "completed"})
