"""Process-run (logbook) lifecycle + access control, for every digitized process."""

from dataclasses import dataclass

import pytest


@dataclass
class Proc:
    code: str
    worker: str
    supervisor: str
    hod: str
    run_type: str
    path: list[tuple[str, str]]  # (to_state, actor)


def simple_path(worker: str, supervisor: str, hod: str) -> list[tuple[str, str]]:
    return [
        ("in_progress", worker),
        ("completed", worker),
        ("approved", supervisor),
        ("closed", hod),
    ]


PROCS = [
    Proc("IAF", "worker_sms", "sup_iaf", "hod_sms", "heat", [
        ("in_progress", "worker_sms"),
        ("waiting_for_sample", "worker_sms"),
        ("refining", "worker_sms"),
        ("ready_to_tap", "worker_sms"),
        ("completed", "worker_sms"),
        ("approved", "sup_iaf"),
        ("closed", "hod_sms"),
    ]),
    Proc("AOD", "worker_sms", "sup_aod", "hod_sms", "ladle_metallurgy", simple_path("worker_sms", "sup_aod", "hod_sms")),
    Proc("CCM", "worker_sms", "sup_ccm", "hod_sms", "cast", simple_path("worker_sms", "sup_ccm", "hod_sms")),
    Proc("RMILL", "worker_rolling", "sup_rolling", "hod_rolling", "shift",
         simple_path("worker_rolling", "sup_rolling", "hod_rolling")),
    Proc("WFURN", "worker_wire", "sup_wire", "hod_wire", "shift", simple_path("worker_wire", "sup_wire", "hod_wire")),
    Proc("WDRAW", "worker_wire", "sup_wire", "hod_wire", "shift", simple_path("worker_wire", "sup_wire", "hod_wire")),
    Proc("BBAR", "worker_bbd", "sup_bbd", "hod_bbd", "daily", simple_path("worker_bbd", "sup_bbd", "hod_bbd")),
    Proc("GRIND", "worker_forge", "sup_forge", "hod_forge", "daily", [
        ("in_progress", "worker_forge"),
        ("completed", "worker_forge"),
        ("closed", "sup_forge"),
    ]),
]
BY_CODE = {p.code: p for p in PROCS}

# Users from a *different* department than the process under test.
OUTSIDERS_OF_SMS = ["worker_rolling", "sup_rolling", "hod_rolling"]
OUTSIDERS_OF_OTHERS = ["worker_sms", "sup_iaf", "hod_sms"]


async def create_run(api, proc: Proc, who: str | None = None) -> dict:
    who = who or proc.worker
    processes = await api.ok(who, "GET", "/processes")
    process = next((p for p in processes if p["code"] == proc.code), None)
    assert process, f"{who} cannot see process {proc.code}: {[p['code'] for p in processes]}"
    instances = await api.ok(who, "GET", "/process-instances", params={"process_id": process["id"]})
    assert instances, f"no instances for {proc.code}"
    shifts = await api.ok(who, "GET", "/shifts")
    body = {"run_type": proc.run_type}
    if shifts:
        body["shift_id"] = shifts[0]["id"]
    run = await api.ok(who, "POST", f"/process-instances/{instances[0]['id']}/runs", status=201, json=body)
    assert run["current_state"] == "created"
    return run


async def transition(api, who, run_id, to_state):
    return await api.post(who, f"/process-runs/{run_id}/transitions", json={"to_state": to_state})


async def advance(api, proc: Proc, run_id: str, until: str | None = None) -> None:
    for to_state, actor in proc.path:
        if to_state == until:
            return
        r = await transition(api, actor, run_id, to_state)
        assert r.status_code == 200, f"{actor} -> {to_state}: {r.status_code} {r.text[:300]}"


@pytest.mark.parametrize("code", list(BY_CODE))
async def test_full_lifecycle(api, code):
    proc = BY_CODE[code]
    run = await create_run(api, proc)
    rid = run["id"]

    saved = await api.ok(proc.worker, "PATCH", f"/process-runs/{rid}", json={
        "field_values": [{"field_key": "remarks_test", "value": "from pytest"}],
        "section_data": [{"section_key": "pytest_section", "data": {"rows": [{"a": 1}]}}],
    })
    fv = {f["field_key"]: f["value"] for f in saved["field_values"]}
    assert fv.get("remarks_test") == "from pytest"
    assert any(s["section_key"] == "pytest_section" for s in saved["section_data"])

    for to_state, actor in proc.path:
        r = await transition(api, actor, rid, to_state)
        assert r.status_code == 200, f"{actor} -> {to_state}: {r.status_code} {r.text[:300]}"
        assert r.json()["current_state"] == to_state

    history = await api.ok(proc.worker, "GET", f"/process-runs/{rid}/transitions/history")
    assert [h["to_state"] for h in history] == [s for s, _ in proc.path]

    mine = await api.ok(proc.worker, "GET", "/process-runs/mine")
    assert rid in {r["id"] for r in mine}

    for viewer in (proc.supervisor, proc.hod, "ceo", "admin"):
        await api.ok(viewer, "GET", f"/process-runs/{rid}")


@pytest.mark.parametrize("code", list(BY_CODE))
async def test_worker_cannot_abort_or_finalise(api, code):
    proc = BY_CODE[code]
    run = await create_run(api, proc)
    rid = run["id"]
    await advance(api, proc, rid, until="completed")
    assert (await transition(api, proc.worker, rid, "aborted")).status_code in (400, 403)
    assert (await transition(api, proc.worker, rid, "completed")).status_code == 200
    final_state = "closed" if code == "GRIND" else "approved"
    assert (await transition(api, proc.worker, rid, final_state)).status_code == 403


@pytest.mark.parametrize("code", list(BY_CODE))
async def test_invalid_transition_rejected(api, code):
    proc = BY_CODE[code]
    run = await create_run(api, proc)
    assert (await transition(api, proc.supervisor, run["id"], "closed")).status_code == 400


@pytest.mark.parametrize("code", list(BY_CODE))
async def test_other_department_cannot_read_edit_or_transition(api, code):
    proc = BY_CODE[code]
    run = await create_run(api, proc)
    rid = run["id"]
    outsiders = OUTSIDERS_OF_SMS if proc.hod == "hod_sms" else OUTSIDERS_OF_OTHERS
    problems = []
    for who in outsiders:
        if (r := await api.get(who, f"/process-runs/{rid}")).status_code != 403:
            problems.append(f"{who} GET -> {r.status_code}")
        r = await api.patch(who, f"/process-runs/{rid}", json={"field_values": [{"field_key": "x", "value": "hack"}]})
        if r.status_code != 403:
            problems.append(f"{who} PATCH -> {r.status_code}")
        if (r := await transition(api, who, rid, "in_progress")).status_code != 403:
            problems.append(f"{who} transition -> {r.status_code}")
        if (r := await api.get(who, f"/process-runs/{rid}/remarks")).status_code != 403:
            problems.append(f"{who} GET remarks -> {r.status_code}")
        if (r := await api.get(who, f"/process-runs/{rid}/transitions/history")).status_code != 403:
            problems.append(f"{who} GET history -> {r.status_code}")
    after = await api.ok("admin", "GET", f"/process-runs/{rid}")
    if after["current_state"] != "created":
        problems.append(f"run state changed by outsider: {after['current_state']}")
    assert not problems, "\n".join(problems)


@pytest.mark.parametrize("who", ["hr", "maint_quality", "maint_equipment"])
async def test_non_production_roles_cannot_touch_runs(api, who):
    run = await create_run(api, BY_CODE["IAF"])
    rid = run["id"]
    problems = []
    if (r := await api.get(who, f"/process-runs/{rid}")).status_code != 403:
        problems.append(f"GET -> {r.status_code}")
    r = await api.patch(who, f"/process-runs/{rid}", json={"field_values": [{"field_key": "x", "value": "hack"}]})
    if r.status_code != 403:
        problems.append(f"PATCH -> {r.status_code}")
    if (r := await transition(api, who, rid, "in_progress")).status_code != 403:
        problems.append(f"transition -> {r.status_code}")
    listed = await api.ok(who, "GET", "/process-runs")
    if any(x["id"] == rid for x in listed):
        problems.append("run visible in GET /process-runs")
    assert not problems, "\n".join(problems)


async def test_process_scoped_supervisor_cannot_access_other_process(api):
    run = await create_run(api, BY_CODE["IAF"])
    for who in ("sup_aod", "sup_ccm"):
        assert (await api.get(who, f"/process-runs/{run['id']}")).status_code == 403
        assert (await transition(api, who, run["id"], "in_progress")).status_code == 403


async def test_worker_cannot_see_runs_created_by_others(api):
    run = await create_run(api, BY_CODE["IAF"], who="sup_iaf")
    assert (await api.get("worker_sms", f"/process-runs/{run['id']}")).status_code == 403
    listed = await api.ok("worker_sms", "GET", "/process-runs")
    assert run["id"] not in {r["id"] for r in listed}


async def test_worker_cannot_create_run_in_other_department(api):
    processes = await api.ok("admin", "GET", "/processes")
    iaf = next(p for p in processes if p["code"] == "IAF")
    instances = await api.ok("admin", "GET", "/process-instances", params={"process_id": iaf["id"]})
    r = await api.post("worker_rolling", f"/process-instances/{instances[0]['id']}/runs", json={"run_type": "heat"})
    assert r.status_code == 403


async def test_closed_run_is_read_only(api):
    proc = BY_CODE["RMILL"]
    run = await create_run(api, proc)
    await advance(api, proc, run["id"])
    r = await api.patch(proc.worker, f"/process-runs/{run['id']}",
                        json={"field_values": [{"field_key": "remarks_test", "value": "edited after close"}]})
    assert r.status_code in (400, 403, 409), f"closed run edited: {r.status_code}"


async def test_run_numbers_unique_per_instance(api):
    proc = BY_CODE["BBAR"]
    a = await create_run(api, proc)
    b = await create_run(api, proc)
    assert a["run_number"] != b["run_number"]


async def test_remarks_thread(api):
    run = await create_run(api, BY_CODE["IAF"])
    rid = run["id"]
    remark = await api.ok("worker_sms", "POST", f"/process-runs/{rid}/remarks", status=201, json={"body": "Slag high"})
    # Supervisor replies are only allowed once the heat is completed.
    early = await api.post("sup_iaf", f"/process-runs/{rid}/remarks/{remark['id']}/reply", json={"body": "early"})
    assert early.status_code == 400
    await advance(api, BY_CODE["IAF"], rid, until="approved")
    await api.ok("sup_iaf", "POST",f"/process-runs/{rid}/remarks/{remark['id']}/reply", status=201,
                 json={"body": "Add lime"})
    remarks = await api.ok("hod_sms", "GET", f"/process-runs/{rid}/remarks")
    assert remarks


async def test_concurrent_run_creation_gets_unique_numbers(api):
    import asyncio

    proc = BY_CODE["GRIND"]
    runs = await asyncio.gather(*(create_run(api, proc) for _ in range(8)), return_exceptions=True)
    errors = [r for r in runs if isinstance(r, BaseException)]
    assert not errors, errors
    numbers = [r["run_number"] for r in runs]
    assert len(set(numbers)) == len(numbers), f"duplicate run numbers: {sorted(numbers)}"
