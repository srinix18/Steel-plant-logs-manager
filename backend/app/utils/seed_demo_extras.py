"""Demo completeness: everything a screen can show has something behind it.

``enrich``  runs once: fills gaps in the first demo seed (grinding output, run outcomes, asset links, stock
            variety, SOPs, message replies, overdue items), then the cost phase prices everything.
``make_today`` runs once per day: today's attendance, runs in every department (some finished, some live),
            handovers and a maintenance issue, so the "today" tiles and live boards are never empty.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from sqlalchemy import select

from app.db.models import (
    Asset,
    FactProcessRun,
    MaintenanceIssue,
    Process,
    ProcessRun,
    RunSectionData,
    User,
)
from app.db.session import async_session_factory

if TYPE_CHECKING:  # pragma: no cover
    from app.utils.seed_demo_activity import Demo

log = logging.getLogger("demo_seed")
IST = timezone(timedelta(hours=5, minutes=30))
FINISHED = ("completed", "approved", "closed")


async def enrich(demo: "Demo") -> None:
    r = demo.rng

    # 1. Grinding runs finished before the sheet had a register: give them their output.
    async with async_session_factory() as session:
        grind = (await session.execute(
            select(ProcessRun).join(Process, ProcessRun.process_id == Process.id)
            .where(Process.code == "GRIND", ProcessRun.current_state.in_(FINISHED))
        )).scalars().all()
        for run in grind:
            have = (await session.execute(select(RunSectionData).where(RunSectionData.run_id == run.id, RunSectionData.section_key == "grinding_register"))).scalar_one_or_none()
            if have is None:
                rows = demo._register_rows("GRIND", {"key": "grinding_register"}, {})
                session.add(RunSectionData(run_id=run.id, section_key="grinding_register", data={"rows": rows}))
        await session.commit()

    # 2. Verdicts on finished runs, so quality and the off-spec KPI have something to measure.
    async with async_session_factory() as session:
        runs = (await session.execute(select(ProcessRun).where(ProcessRun.current_state.in_(FINISHED)).order_by(ProcessRun.created_at))).scalars().all()
        from app.models.enums import ProcessRunOutcome

        for i, run in enumerate(runs):
            if run.outcome is None:
                run.outcome = ProcessRunOutcome.REJECTED if i % 19 == 7 else ProcessRunOutcome.REWORK if i % 8 == 3 else ProcessRunOutcome.ACCEPTED
        await session.commit()
        ids = [x.id for x in runs]

    # 2b. Induction furnace energy was generated far too high (about 2,000 kWh per tonne); real melting is about 650.
    from app.db.models import KPIDefinition, RunFieldValue

    async with async_session_factory() as session:
        iaf_runs = (await session.execute(
            select(ProcessRun).join(Process, ProcessRun.process_id == Process.id).where(Process.code == "IAF")
        )).scalars().all()
        for run in iaf_runs:
            fields = {f.field_key: f for f in (await session.execute(select(RunFieldValue).where(RunFieldValue.run_id == run.id))).scalars()}
            charge = (await session.execute(select(FactProcessRun.charge_kg).where(FactProcessRun.run_id == run.id))).scalar() or 2800
            kwh = int(float(charge) * r.uniform(0.60, 0.74))
            if "power_initial" in fields and "power_final" in fields:
                try:
                    fields["power_final"].value = int(float(fields["power_initial"].value)) + kwh
                except (TypeError, ValueError):
                    pass
            if "power_total" in fields:
                fields["power_total"].value = str(kwh)
        # targets, so each KPI can say whether it is on or off target
        for code, target in (("tap_to_tap_p95", 110.0), ("kwh_per_ton", 720.0), ("shift_throughput", 8.0), ("oos_rate", 10.0)):
            kpi = (await session.execute(select(KPIDefinition).where(KPIDefinition.code == code))).scalar_one_or_none()
            if kpi is not None and kpi.target_value is None:
                kpi.target_value = target
        await session.commit()

    # 3. Re-derive every finished run's analytics (output, energy, tap-to-tap, outcome).
    from app.api.v1.process_runs import run_service

    async with async_session_factory() as session:
        for rid in ids:
            await run_service.compute_analytics_facts(session, rid)
        await session.commit()

    # 4. Link maintenance issues to the assets they are about, so asset health differs between assets.
    async with async_session_factory() as session:
        issues = (await session.execute(select(MaintenanceIssue).where(MaintenanceIssue.asset_id.is_(None)))).scalars().all()
        assets = (await session.execute(select(Asset).where(Asset.department_id.isnot(None)))).scalars().all()
        by_dept: dict = {}
        for a in assets:
            by_dept.setdefault(a.department_id, []).append(a)
        for issue in issues:
            raiser = await session.get(User, issue.raised_by)
            pool = by_dept.get(raiser.department_id) if raiser else None
            if pool:
                issue.asset_id = r.choice(pool[:4]).id
        await session.commit()

    # 4b. Asset condition that differs by asset: age, furnace-lining life used, overdue work orders.
    from datetime import date as _date

    from app.db.models import MaintenanceWorkOrder

    async with async_session_factory() as session:
        def asset_named(name):
            return select(Asset).where(Asset.name.ilike(name)).limit(1)

        for name, built, counters, expected in (
            ("IAF #1", 2016, {"heat_count": 41}, {"heats": 45}),   # lining nearly due for relining
            ("IAF #2", 2009, {"heat_count": 33}, {"heats": 45}),
            ("AOD #1", 2011, {"heat_count": 92}, {"heats": 100}),
            ("Rolling Mill Line", 2004, {}, {}),                    # old line with overdue work: the one to worry about
        ):
            asset = (await session.execute(asset_named(name))).scalar_one_or_none()
            if asset is not None:
                asset.installation_date = _date(built, 6, 1)
                if counters:
                    asset.life_counters, asset.expected_life = counters, expected
        open_wos = (await session.execute(
            select(MaintenanceWorkOrder).where(MaintenanceWorkOrder.status.notin_(["completed", "verified", "closed"])).order_by(MaintenanceWorkOrder.created_at)
        )).scalars().all()
        rolling = (await session.execute(asset_named("Rolling Mill Line"))).scalar_one_or_none()
        iaf2 = (await session.execute(asset_named("IAF #2"))).scalar_one_or_none()
        for wo, asset, days in zip(open_wos, [rolling, rolling, iaf2, iaf2], [3, 6, 2, 9]):
            if asset is not None:
                wo.asset_id, wo.due_at = asset.id, datetime.now(timezone.utc) - timedelta(days=days)
        await session.commit()

    plant = demo.plant_id
    today = datetime.now(timezone.utc)

    # 5. More maintenance work: history for every crew, and live items (one open, one in progress per area).
    issues_plan = [
        ("sup_wire", "equipment", "medium", "Drawing block bearing running hot", "maint_equipment", "close", 9),
        ("sup_bbd", "equipment", "low", "Peeling head chatter", "maint_equipment", "close", 6),
        ("sup_forge", "energy", "medium", "Grinder motor drawing high current", "maint_energy", "close", 5),
        ("sup_rolling", "energy", "high", "Mill drive overload trips", "maint_energy", "take", 2),
        ("sup_aod", "quality", "medium", "Sample probe reading drifts", "maint_quality", "take", 3),
        ("sup_wire", "quality", "low", "Wire gauge calibration due", "maint_quality", "close", 8),
        ("sup_iaf", "safety", "high", "Guard rail loose on furnace platform", "maint_safety", "take", 1),
        ("sup_bbd", "safety", "medium", "Missing fire extinguisher tag, packing area", "maint_safety", "close", 4),
        ("sup_ccm", "process", "medium", "Casting speed controller hunting", "maint_process", "take", 2),
        ("sup_forge", "process", "low", "Coolant concentration low", "maint_process", "close", 7),
        ("sup_wire", "process", "medium", "Annealing furnace temperature overshoot", None, None, 0),
        ("sup_bbd", "energy", "low", "Compressor cycling too often", None, None, 0),
    ]
    made = []
    for who, cat, sev, title, crew, action, age in issues_plan:
        issue = await demo.ok(who, "POST", "/maintenance/issues", json={"title": title, "description": title + ".", "category": cat, "severity": sev})
        if not issue:
            continue
        if crew:
            await demo.call(crew, "POST", f"/maintenance/issues/{issue['id']}/assign")
            if action == "close":
                await demo.call(crew, "POST", f"/maintenance/issues/{issue['id']}/close", json={"resolution_notes": "Checked and fixed; running normally."})
        made.append((issue["id"], age))
    async with async_session_factory() as session:
        for iid, age in made:
            row = await session.get(MaintenanceIssue, uuid.UUID(iid))
            if row and age:
                row.raised_at = row.created_at = today - timedelta(days=age, hours=r.randint(1, 6))
                if row.assigned_at:
                    row.assigned_at = row.raised_at + timedelta(hours=2)
                if row.closed_at:
                    row.closed_at = row.raised_at + timedelta(hours=r.randint(5, 30))
        await session.commit()

    # 6. Stock with a mix of healthy, low and critical items, and goods received.
    for code, qty in (("FE_NI", 0.8), ("TI", 0.15), ("ARGON", 1800), ("FURNACE_OIL", 7200)):
        await demo.call("ceo", "POST", f"/inventory-pulse/{plant}/adjust", json={"material_code": code, "quantity": qty})
    for code, qty, supplier in (("HC_FE_CR", 10, "Ferro Alloys Ltd"), ("LIME", 20, "Raj Lime Co"), ("304_SCRAP", 40, "Local Supplier"), ("OXYGEN", 8000, "Linde")):
        await demo.call("ceo", "POST", f"/inventory-pulse/{plant}/receive", json={"material_code": code, "quantity": qty, "supplier": supplier})

    # 7. Safety library, and an overdue inspection and an overdue action so the "attention" counters show.
    from app.db.models import SopDocument

    async with async_session_factory() as session:
        have = {t for (t,) in await session.execute(select(SopDocument.title).where(SopDocument.plant_id == uuid.UUID(plant)))}
        for title, category, version in (("Hot metal tapping procedure", "sop", "1.3"), ("Working at height", "sop", "1.0"), ("Gas cylinder handling", "sop", "1.1"),
                                         ("Emergency evacuation plan", "emergency", "2.0"), ("Lockout and tagout", "sop", "1.2"), ("Fire response drill", "emergency", "1.0")):
            if title not in have:
                session.add(SopDocument(plant_id=uuid.UUID(plant), title=title, category=category, version=version))
        await session.commit()
    await demo.call("maint_safety", "POST", f"/safety/inspections/{plant}", json={
        "inspection_type": "Crane and sling inspection", "findings": "Two slings due for replacement.",
        "next_due_at": (today - timedelta(days=2)).isoformat()})
    obs = await demo.ok("hod_rolling", "POST", "/foundation/observations", json={
        "plant_id": plant, "title": "Roll shop housekeeping", "description": "Spare rolls stacked without chocks.",
        "department_id": demo.me["hod_rolling"]["department_id"], "category": "safety", "severity": "medium"})
    if obs:
        await demo.call("hod_rolling", "POST", f"/foundation/observations/{obs['id']}/corrective-actions", json={
            "title": "Fit chocks and mark storage bays", "assigned_to": demo._user_id("sup_rolling"),
            "due_date": (demo.today - timedelta(days=1)).isoformat(), "priority": "high"})

    # 8. Conversations: people answer what they were sent.
    replies = (
        ("sup_iaf", "Tap-to-tap review", "Thursday morning works. I will bring the last week of night shift times."),
        ("hod_sms", "Crucible reline request", "Approved. Friday 2 pm slot is yours; plan the charge accordingly."),
        ("sup_iaf", "Uniform request", "Noted. I will raise it with stores today."),
        ("worker_rolling", "Payslips available", "Received, thank you."),
        ("hod_rolling", "Pusher alignment", "Good. Keep me posted if it jams again."),
    )
    for who, subject, body in replies:
        inbox = await demo.ok(who, "GET", "/messages/inbox") or []
        original = next((m for m in inbox if m.get("subject") == subject), None)
        if original:
            await demo.call(who, "POST", f"/messages/{original['id']}/reply", json={"body": body})
    log.info("demo seed: enrichment done")


async def mark_attendance(demo: "Demo", day) -> None:
    """Attendance for everyone with a shift on one day (skipped for people already marked)."""
    r = demo.rng
    assignments = await demo.ok("hr", "GET", "/workforce/shift-assignments") or []
    groups: dict = {}
    for a in assignments:
        groups.setdefault((a["department_id"], a["shift_id"]), []).append(a["user_id"])
    statuses, weights = ["present", "absent", "half_day", "leave"], [87, 5, 5, 3]
    for (dept, shift), users in groups.items():
        entries = [{"user_id": u, "status": r.choices(statuses, weights)[0]} for u in users]
        await demo.call("hr", "POST", "/workforce/attendance/bulk", json={"attendance_date": day.isoformat(), "department_id": dept, "shift_id": shift, "entries": entries})


async def make_today(demo: "Demo") -> None:
    """Today's activity in every department. Safe to run once per day (the caller records a marker)."""
    now = datetime.now(IST)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    r = demo.rng
    await mark_attendance(demo, demo.today)

    # Which shift is on now (for the labels); runs are timed backwards from the current moment.
    shift = "A" if 6 <= now.hour < 14 else "B" if 14 <= now.hour < 22 else "C"
    plan = [
        ("IAF", "approved"), ("IAF", "completed"), ("IAF", "in_progress"),
        ("AOD", "completed"), ("AOD", "in_progress"),
        ("CCM", "completed"),
        ("RMILL", "approved"), ("RMILL", "in_progress"),
        ("WFURN", "completed"), ("WFURN", "in_progress"),
        ("WDRAW", "approved"),
        ("BBAR", "completed"), ("BBAR", "in_progress"),
        ("GRIND", "completed"), ("GRIND", "in_progress"),
    ]
    async with async_session_factory() as session:
        from app.db.models import ProcessRun as PR

        rows = await session.execute(select(PR.run_number).where(PR.metadata_["demo"].astext == "true"))
        demo.existing_numbers = {x[0] for x in rows}
    demo.counters = {}
    for i, (process, final) in enumerate(plan):
        # finished runs started 1-5 hours ago but never before midnight; live ones are timed by the backdating step
        earliest = midnight + timedelta(minutes=10 + 12 * i)
        start = max(earliest, now - timedelta(hours=r.randint(2, 5)))
        if start >= now - timedelta(minutes=30):
            start = max(midnight + timedelta(minutes=5), now - timedelta(minutes=45))
        try:
            await demo._make_run(process, 0, shift, final, 500 + i, start_at=start)
        except Exception:  # one bad run must not stop the rest
            log.exception("demo seed: today run %s failed", process)

    # Handover notes for the day, and one fresh maintenance issue so the queue is live.
    shifts = demo.shifts
    for who, text in (("sup_iaf", "IAF-1 running normally; cooling water pressure checked."), ("sup_rolling", "Roll change planned for tonight."),
                      ("sup_wire", "Die set changed, first coil within tolerance."), ("sup_bbd", "Peeling queue cleared for the day."),
                      ("sup_forge", "Grinding wheel on centre 2 replaced.")):
        await demo.call(who, "POST", "/workforce/handover-notes", json={
            "note_date": demo.today.isoformat(), "department_id": demo.me[who]["department_id"], "shift_id": shifts[shift]["id"], "note": text})
    log.info("demo seed: today's activity created")
