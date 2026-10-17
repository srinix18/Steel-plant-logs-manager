"""The demo-activity seed: must finish cleanly on a fresh server and be safe to run twice.

Named ``test_zz`` so it runs last: it fills the shared test database with demo history.
"""

import re

from app.utils.seed_demo_activity import PROCESS_PLAN, RUN_PLAN, demo_seed_finished, run_demo_seed

RUN_NUMBER = re.compile(r"^(H|AOD|CC|RM|WF|WD|BB|GR)-\d{8}-\d{4}$")


async def test_demo_seed_completes_and_is_repeatable(client, api):
    failures = await run_demo_seed(client)
    assert failures == 0, "every API call the seed makes should succeed"
    assert await demo_seed_finished()

    # Running again does nothing.
    assert await run_demo_seed(client) is None

    runs = await api.ok("ceo", "GET", "/process-runs", params={"limit": 500})
    demo = [r for r in runs if RUN_NUMBER.match(r["run_number"])]
    assert len(demo) >= len(RUN_PLAN) - 2  # a couple may share a number prefix with older runs, never fewer than this
    processes = {p["id"]: p["code"] for p in await api.ok("ceo", "GET", "/processes")}
    covered = {processes[r["process_id"]] for r in demo if r["process_id"] in processes}
    assert set(PROCESS_PLAN) <= covered, f"missing sheets: {set(PROCESS_PLAN) - covered}"
    states = {r["current_state"] for r in demo}
    # Finished sheets in every post-work state; nothing is left open "today" (it would drag the demo OEE to a few percent).
    assert {"closed", "approved", "completed", "aborted"} <= states
    assert not any(r["current_state"] in ("in_progress", "refining") for r in demo)

    # History exists beyond the sheets: leave in every status, payroll, issues, observations.
    leave = await api.ok("hr", "GET", "/workforce/leave/requests")
    assert {"pending", "approved", "rejected"} <= {x["status"] for x in leave}
    assert await api.ok("hr", "GET", "/workforce/payroll/runs")
    issues = await api.ok("ceo", "GET", "/maintenance/issues", params={"limit": 200})
    assert {"open", "in_progress", "closed"} <= {i["status"] for i in issues}

    # Around 250 people across every department, with payslips for last month.
    staff = await api.ok("hr", "GET", "/workforce/employees")
    assert 240 <= len(staff) <= 270
    roles = {str(e["role"]).lower() for e in staff}
    assert {"worker", "supervisor", "hod", "maintenance", "hr"} <= roles

    # Finance covers every production department, and stock has been drawn down by the finished heats.
    plant = api.user("ceo")["plant_id"]
    summary = await api.ok("ceo", "GET", "/finance/dashboard/plant-summary", params={"plant_id": plant})
    cost = {d["department_code"]: d["total_cost"] for d in summary["by_department"]}
    for code in ("SMS", "ROLLING", "WIRE", "BBD", "FORGE"):
        assert cost.get(code, 0) > 0, f"{code} has no cost"
    drivers = {d["category"] for d in await api.ok("ceo", "GET", "/finance/analytics/top-drivers", params={"plant_id": plant})}
    assert {"raw_material", "labour", "power"} <= drivers
    stock = {i["material_code"]: i for i in await api.ok("ceo", "GET", f"/inventory-pulse/{plant}")}
    assert stock["304_SCRAP"]["avg_daily_consumption"]  # drawn down by the heats
    assert all(i["quantity"] >= 0 for i in stock.values())

    # Today: every process has activity (finished and live), so the "today" tiles and live boards are never empty.
    from datetime import datetime, timedelta, timezone

    from app.utils.seed_demo_activity import run_today_top_up

    now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    if not (now.hour == 0 and now.minute < 40):
        assert await run_today_top_up(client) == 0
        assert await run_today_top_up(client) is None  # once a day
        await api.ok("admin", "POST", "/pulse/refresh")
        runs = await api.ok("ceo", "GET", "/process-runs", params={"limit": 500})
        stamp = now.strftime("%Y%m%d")
        today_runs = [r for r in runs if f"-{stamp}-" in r["run_number"]]
        codes = {processes[r["process_id"]] for r in today_runs if r["process_id"] in processes}
        assert set(PROCESS_PLAN) <= codes, f"no run today for {set(PROCESS_PLAN) - codes}"
        assert any(r["current_state"] in ("in_progress", "refining", "waiting_for_sample") for r in today_runs)
        pulse = await api.ok("ceo", "GET", f"/pulse/plant/{plant}")
        by_dept = {d["department_code"]: d for d in pulse["departments"]}
        for code in ("SMS", "ROLLING", "WIRE", "BBD", "FORGE"):
            assert by_dept[code]["production"] and by_dept[code]["production"] > 0, f"{code} produced nothing today"
        assert pulse["attendance_pct"] is not None and pulse["today_cost"] and pulse["today_cost"] > 0
        kpis = {k["code"]: k for k in await api.ok("ceo", "GET", "/foundation/kpi-values")}
        assert all(kpis[c]["value"] is not None for c in ("tap_to_tap_p95", "kwh_per_ton", "shift_throughput", "oos_rate"))
        assert 300 < kpis["kwh_per_ton"]["value"] < 1200  # a believable melting figure
        stock = {i["material_code"]: i["status"] for i in await api.ok("ceo", "GET", f"/inventory-pulse/{plant}")}
        assert "critical" in stock.values()
    # Every maintenance crew has work and history, and the safety library is stocked.
    for crew in ("maint_quality", "maint_safety", "maint_energy", "maint_equipment", "maint_process"):
        assert await api.ok(crew, "GET", "/maintenance/issues", params={"limit": 200}), f"{crew} has no issues"
    assert len(await api.ok("ceo", "GET", f"/safety/sops/{plant}")) >= 6
    inbox = await api.ok("hod_sms", "GET", "/messages/inbox")
    assert any(m["subject"].startswith("Re:") for m in inbox)
