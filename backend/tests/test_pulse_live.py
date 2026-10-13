"""The pulse follows real changes: attendance, maintenance issues, and no invented OEE."""

from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))


def _today() -> str:
    return datetime.now(IST).date().isoformat()


async def _dept_pulse(api, who, department_id):
    return await api.ok(who, "GET", f"/pulse/department/{department_id}")


async def test_attendance_edit_moves_department_and_plant_pulse(api):
    groups: dict[tuple[str, str], int] = {}
    for a in await api.ok("hr", "GET", "/workforce/shift-assignments"):
        groups[(a["department_id"], a["shift_id"])] = groups.get((a["department_id"], a["shift_id"]), 0) + 1
    (dept, shift), _ = max(groups.items(), key=lambda kv: kv[1])
    people = await api.ok("hr", "GET", "/workforce/attendance", params={"attendance_date": _today(), "department_id": dept, "shift_id": shift})
    assert len(people) >= 2

    async def save(statuses):
        entries = [{"user_id": p["user_id"], "status": s} for p, s in zip(people, statuses)]
        await api.ok("hr", "POST", "/workforce/attendance/bulk", json={"attendance_date": _today(), "department_id": dept, "shift_id": shift, "entries": entries})

    await save(["present", "absent"] + ["present"] * (len(people) - 2))
    pulse = await _dept_pulse(api, "ceo", dept)
    expected = round((len(people) - 1) / len(people) * 100, 1)
    assert pulse["attendance_pct"] == expected  # this department only, no refresh needed
    await save(["absent"] * len(people))
    assert (await _dept_pulse(api, "ceo", dept))["attendance_pct"] == 0.0
    await save(["half_day"] * len(people))
    assert (await _dept_pulse(api, "ceo", dept))["attendance_pct"] == 50.0  # a half-day counts as half a person
    plant_id = api.user("ceo")["plant_id"]
    plant = await api.ok("ceo", "GET", f"/pulse/plant/{plant_id}")
    assert plant["attendance_pct"] is not None


async def test_open_issue_counts_are_per_department(api):
    wire = api.user("hod_wire")["department_id"]
    rolling = api.user("hod_rolling")["department_id"]
    before_wire = (await _dept_pulse(api, "ceo", wire))["open_issues"]
    before_rolling = (await _dept_pulse(api, "ceo", rolling))["open_issues"]
    plant_id = api.user("ceo")["plant_id"]
    before_plant = (await api.ok("ceo", "GET", f"/pulse/plant/{plant_id}"))["active_alerts"]

    issue = await api.ok("sup_rolling", "POST", "/maintenance/issues", json={"title": "Pulse test", "description": "t", "category": "equipment", "severity": "high"})
    assert (await _dept_pulse(api, "ceo", rolling))["open_issues"] == before_rolling + 1
    assert (await _dept_pulse(api, "ceo", wire))["open_issues"] == before_wire  # other departments unaffected
    assert (await api.ok("ceo", "GET", f"/pulse/plant/{plant_id}"))["active_alerts"] == before_plant + 1

    await api.ok("maint_equipment", "POST", f"/maintenance/issues/{issue['id']}/assign")
    assert (await _dept_pulse(api, "ceo", rolling))["open_issues"] == before_rolling


async def test_no_invented_oee_when_nothing_ran(api):
    depts = await api.ok("admin", "GET", "/departments")
    util = next(d for d in depts if d["code"] == "UTIL")  # utilities has no log sheets
    await api.ok("admin", "POST", "/pulse/refresh")
    pulse = await _dept_pulse(api, "ceo", util["id"])
    assert pulse["oee"] is None
