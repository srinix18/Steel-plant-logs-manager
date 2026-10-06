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
