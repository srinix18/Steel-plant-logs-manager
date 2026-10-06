"""Realistic demo activity: two weeks of shop-floor and workforce history.

Why: a fresh server has users, templates and masters but no *activity*, so every
dashboard is empty. This fills the plant with believable history (log sheets in every
state, approvals, maintenance issues, leave, attendance, payroll, ...) so the app can be
shown as if it had been in use for a while.

How: it drives the app's own HTTP API in-process (as the demo accounts), so every business
rule, workflow transition, cost calculation and notification runs exactly as for a real
user. Afterwards it backdates timestamps so the history spans the last ~14 days.

Safety: runs once (marker = runs whose metadata has ``demo: true``), in the background after
startup, never blocks or breaks startup, and is disabled with ``SEED_DEMO_ACTIVITY=false``.
"""

from __future__ import annotations

import logging
import random
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import select

from app.db.models import (
    CorrectiveAction,
    CostCalculation,
    DemoSeedState,
    MaintenanceIssue,
    Message,
    Observation,
    OperationalEvent,
    ProcessRun,
    RunRemark,
    WorkflowTransitionLog,
)
from app.db.session import async_session_factory

log = logging.getLogger("demo_seed")
if not log.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(levelname)s:     %(message)s"))
    log.addHandler(_h)
    log.setLevel(logging.INFO)
    log.propagate = False

IST = timezone(timedelta(hours=5, minutes=30))

ACCOUNTS: dict[str, tuple[str, str]] = {
    "admin": ("admin@logbook.app", "admin123"),
    "ceo": ("ceo@chandansteel.com", "ceo123"),
    "hr": ("hr@chandansteel.com", "hr123"),
    "hod_sms": ("hod@chandansteel.com", "hod123"),
    "sup_iaf": ("iaf.supervisor@chandansteel.com", "iaf123"),
    "sup_aod": ("aod.supervisor@chandansteel.com", "aod123"),
    "legacy_sup": ("supervisor@chandansteel.com", "supervisor123"),
    "sup_ccm": ("ccm.supervisor@chandansteel.com", "ccm123"),
    "worker_sms": ("melter@chandansteel.com", "worker123"),
    "hod_rolling": ("hod.rolling@chandansteel.com", "hod123"),
    "sup_rolling": ("supervisor.rolling@chandansteel.com", "rolling123"),
    "worker_rolling": ("worker.rolling@chandansteel.com", "rolling123"),
    "hod_wire": ("hod.wire@chandansteel.com", "hod123"),
    "sup_wire": ("supervisor.wire@chandansteel.com", "wire123"),
    "worker_wire": ("worker.wire@chandansteel.com", "wire123"),
    "hod_bbd": ("hod.bbd@chandansteel.com", "hod123"),
    "sup_bbd": ("supervisor.bbd@chandansteel.com", "bbd123"),
    "worker_bbd": ("worker.bbd@chandansteel.com", "bbd123"),
    "hod_forge": ("hod.forge@chandansteel.com", "hod123"),
    "sup_forge": ("supervisor.forge@chandansteel.com", "forge123"),
    "worker_forge": ("worker.forge@chandansteel.com", "forge123"),
    "maint_quality": ("maint.quality@chandansteel.com", "maint123"),
    "maint_safety": ("maint.safety@chandansteel.com", "maint123"),
    "maint_energy": ("maint.energy@chandansteel.com", "maint123"),
    "maint_equipment": ("maint.equipment@chandansteel.com", "maint123"),
    "maint_process": ("maint.process@chandansteel.com", "maint123"),
}

# process code -> (run type, worker, supervisor who approves/closes, run-number prefix)
PROCESS_PLAN: dict[str, tuple[str, str, str, str]] = {
    "IAF": ("heat", "worker_sms", "sup_iaf", "H"),
    "AOD": ("ladle_metallurgy", "worker_sms", "sup_aod", "AOD"),
    "CCM": ("cast", "worker_sms", "sup_ccm", "CC"),
    "RMILL": ("shift", "worker_rolling", "sup_rolling", "RM"),
    "WFURN": ("shift", "worker_wire", "sup_wire", "WF"),
    "WDRAW": ("shift", "worker_wire", "sup_wire", "WD"),
    "BBAR": ("daily", "worker_bbd", "sup_bbd", "BB"),
    "GRIND": ("daily", "worker_forge", "sup_forge", "GR"),
}

SHIFT_START_HOUR = {"A": 6, "B": 14, "C": 22}

# (process, days ago, shift, final state). Nothing is left in progress for "today": the plant pulse
# judges output against today's unfinished runs, so an open heat would drag the demo OEE to a few percent.
RUN_PLAN: list[tuple[str, int, str, str]] = [
    # Induction furnace heats: two per shift pattern over the last week
    ("IAF", 8, "A", "closed"), ("IAF", 7, "B", "closed"), ("IAF", 7, "C", "closed"),
    ("IAF", 5, "A", "closed"), ("IAF", 5, "B", "closed"), ("IAF", 4, "A", "closed"),
    ("IAF", 3, "C", "closed"), ("IAF", 2, "A", "closed"), ("IAF", 2, "B", "aborted"),
    ("IAF", 1, "A", "approved"), ("IAF", 1, "B", "completed"), ("IAF", 1, "C", "completed"),
    ("AOD", 7, "B", "closed"), ("AOD", 5, "B", "closed"), ("AOD", 4, "A", "closed"),
    ("AOD", 2, "A", "closed"), ("AOD", 1, "A", "approved"), ("AOD", 1, "B", "completed"),
    ("CCM", 7, "B", "closed"), ("CCM", 5, "B", "closed"), ("CCM", 3, "C", "closed"),
    ("CCM", 2, "A", "closed"), ("CCM", 1, "B", "completed"),
    ("RMILL", 6, "A", "closed"), ("RMILL", 5, "B", "closed"), ("RMILL", 3, "A", "closed"),
    ("RMILL", 2, "B", "closed"), ("RMILL", 1, "A", "approved"),
    ("RMILL", 1, "B", "completed"),
    ("WFURN", 6, "A", "closed"), ("WFURN", 4, "B", "closed"), ("WFURN", 2, "A", "closed"),
    ("WFURN", 1, "B", "completed"),
    ("WDRAW", 5, "B", "closed"), ("WDRAW", 3, "A", "closed"), ("WDRAW", 1, "A", "approved"),
    ("BBAR", 6, "A", "closed"), ("BBAR", 5, "A", "closed"), ("BBAR", 3, "A", "closed"),
    ("BBAR", 2, "A", "closed"), ("BBAR", 1, "A", "completed"),
    ("GRIND", 4, "A", "closed"), ("GRIND", 3, "A", "closed"), ("GRIND", 2, "A", "closed"),
    ("GRIND", 1, "A", "completed"),
]

IAF_PATH = ["in_progress", "waiting_for_sample", "refining", "ready_to_tap", "completed", "approved", "closed"]
PLAIN_PATH = ["in_progress", "completed", "approved", "closed"]
GRIND_PATH = ["in_progress", "completed", "closed"]

OPERATORS_NOTES = [
    "Furnace lining checked before charging; no issues.",
    "Slightly high tap temperature, adjusted next heat.",
    "Power trip for 4 minutes during melting, resumed normally.",
    "Good yield. Slag cleared on time.",
    "Sample re-taken once for carbon; within spec after refining.",
]

HOURLY_REMARKS = ["", "", "", "Roll change", "", "Billet size change", "", ""]


def _simple_pdf(title: str, body: str) -> bytes:
    """A one-page PDF with a title and a paragraph, enough to open in any viewer."""
    esc = lambda s: s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream = f"BT /F1 20 Tf 72 740 Td ({esc(title)}) Tj ET\nBT /F1 12 Tf 72 700 Td ({esc(body)}) Tj ET\nBT /F1 10 Tf 72 660 Td (Chandan Steel - controlled document, version 1.0) Tj ET"
    objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = "%PDF-1.4\n"
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{o}\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n" + "".join(f"{off:010d} 00000 n \n" for off in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
    return out.encode("latin-1", "replace")


def _weekdays_back(count: int, end: date) -> list[date]:
    out: list[date] = []
    d = end
    while len(out) < count:
        if d.weekday() < 6:  # Mon-Sat working week
            out.append(d)
        d -= timedelta(days=1)
    return out


class Demo:
    def __init__(self, client: httpx.AsyncClient, seed: int = 2026) -> None:
        self.client = client
        self.rng = random.Random(seed)
        self.tokens: dict[str, str] = {}
        self.me: dict[str, dict] = {}
        self.today = datetime.now(IST).date()
        self.counters: dict[str, int] = {}
        self.run_ids: dict[str, list[dict]] = {}  # process code -> [{id, heat_no, state, dt, grade}]
        self.failures = 0
        self.existing_numbers: set[str] = set()
        self.msg_ids: list[str] = []
        self.obs_ids: list[str] = []
        self.ca_ids: list[str] = []

    # ------------------------------------------------------------------ plumbing
    async def login(self, who: str) -> None:
        if who in self.tokens:
            return
        email, password = ACCOUNTS[who]
        r = await self.client.post("/auth/login", json={"email": email, "password": password})
        r.raise_for_status()
        body = r.json()
        self.tokens[who] = body["access_token"]
        self.me[who] = body.get("user") or {}

    async def call(self, who: str, method: str, path: str, **kw: Any) -> tuple[int, Any]:
        await self.login(who)
        r = await self.client.request(method, path, headers={"Authorization": f"Bearer {self.tokens[who]}"}, **kw)
        try:
            body = r.json()
        except Exception:
            body = r.text
        if r.status_code >= 400:
            self.failures += 1
            log.warning("demo seed: %s %s as %s -> %s %s", method, path, who, r.status_code, str(body)[:160])
        return r.status_code, body

    async def ok(self, who: str, method: str, path: str, **kw: Any) -> Any | None:
        status, body = await self.call(who, method, path, **kw)
        return body if status < 400 else None

    # ------------------------------------------------------------- reference data
    async def load_reference(self) -> None:
        await self.login("admin")
        for who in ACCOUNTS:
            await self.login(who)
        m = self.me["worker_sms"]
        self.plant_id = m["plant_id"]
        self.org_id = m["organisation_id"]
        procs = await self.ok("worker_sms", "GET", "/processes") or []
        procs += await self.ok("worker_rolling", "GET", "/processes") or []
        procs += await self.ok("worker_wire", "GET", "/processes") or []
        procs += await self.ok("worker_bbd", "GET", "/processes") or []
        procs += await self.ok("worker_forge", "GET", "/processes") or []
        self.process_by_code = {p["code"]: p for p in procs}
        self.instances: dict[str, list[dict]] = {}
        for code in PROCESS_PLAN:
            who = PROCESS_PLAN[code][1]
            p = self.process_by_code.get(code)
            if p:
                self.instances[code] = await self.ok(who, "GET", "/process-instances", params={"process_id": p["id"]}) or []
        self.shifts = {s["code"]: s for s in (await self.ok("worker_sms", "GET", "/shifts") or [])}
        grades = await self.ok("worker_sms", "GET", "/steel-grades") or []
        self.grades = {g["code"]: g for g in grades}
        self.grade_elements: dict[str, list[dict]] = {}
        for code, g in self.grades.items():
            self.grade_elements[code] = await self.ok("worker_sms", "GET", f"/steel-grades/{g['id']}/elements") or []
        mats = await self.ok("worker_sms", "GET", "/materials") or []
        self.materials = {x["code"]: x for x in mats}
        groups = await self.ok("worker_sms", "GET", "/asset-groups", params={"plant_id": self.plant_id}) or []
        group_code_by_id = {g["id"]: g["code"] for g in groups}
        assets = await self.ok("worker_sms", "GET", "/assets", params={"plant_id": self.plant_id}) or []
        self.assets_by_group: dict[str, list[dict]] = {}
        for a in assets:
            self.assets_by_group.setdefault(group_code_by_id.get(a["group_id"], ""), []).append(a)
        self.customers = await self.ok("worker_bbd", "GET", "/customers", params={"plant_id": self.plant_id}) or []
        self.delay_codes = await self.ok("worker_rolling", "GET", "/delay-codes", params={"plant_id": self.plant_id}) or []

    # ------------------------------------------------------------------ run data
    def _dt(self, d: date, hour: int, minute: int = 0) -> datetime:
        base = datetime(d.year, d.month, d.day, tzinfo=IST)
        return base + timedelta(hours=hour, minutes=minute)

    def _iso(self, dt: datetime) -> str:
        return dt.astimezone(IST).strftime("%Y-%m-%dT%H:%M:%S")

    def _user_id(self, who: str) -> str:
        return self.me[who]["id"]

    def _num(self, name: str, ctx: dict) -> float | int | None:
        r = self.rng
        table = {
            "final_voltage": lambda: round(r.uniform(615, 665), 1),
            "final_frequency": lambda: round(r.uniform(49.6, 50.3), 1),
            "power_initial": lambda: ctx.setdefault("p0", r.randint(180000, 900000)),
            "power_final": lambda: ctx.setdefault("p0", r.randint(180000, 900000)) + r.randint(5200, 6600),
            "transfer_ladle_weight": lambda: r.randint(6400, 7300),
            "final_weight": lambda: ctx.setdefault("w", r.randint(5800, 6600)),
            "final_weight_summary": lambda: ctx.setdefault("w", r.randint(5800, 6600)),
            "ladle_purging_temp": lambda: r.randint(1570, 1615),
            "tundish_temp": lambda: r.randint(1528, 1562),
            "o2_nm3": lambda: r.randint(250, 340),
            "n2_nm3": lambda: r.randint(170, 260),
            "ar_nm3": lambda: r.randint(210, 300),
            "air_nm3": lambda: r.randint(40, 85),
            "oil_consumption": lambda: r.randint(880, 1320),
            "power_consumption": lambda: r.randint(6100, 9200),
            "billets_charged": lambda: ctx.setdefault("charged", r.randint(290, 340)),
            "discharges": lambda: ctx.get("charged", 300) - r.randint(0, 3),
            "cobble_summary": lambda: ctx.setdefault("cobble", r.randint(0, 3)),
            "hot_out_summary": lambda: ctx.setdefault("hotout", r.randint(0, 4)),
        }
        if name == "rolled_summary":
            return ctx.get("charged", 300) - ctx.get("cobble", 0) - ctx.get("hotout", 0)
        fn = table.get(name)
        return fn() if fn else None

    def _field_value(self, f: dict, ctx: dict) -> Any:
        t, n, cfg = f["field_type"], f["name"], (f.get("config") or {})
        r = self.rng
        if t == "calculated":
            return None
        if t == "date":
            return ctx["date"].isoformat()
        if n == "heat_no":
            return ctx["heat_no"]
        if t == "grade_ref":
            return ctx["grade_id"]
        if t == "dropdown":
            if n == "shift":
                return ctx["shift"]
            opts = cfg.get("options") or []
            if n == "condition":
                return r.choices(opts, weights=[8, 2, 1][: len(opts)])[0] if opts else None
            return r.choice(opts) if opts else None
        if t == "user_ref":
            return ctx["people"].get(n) or ctx["people"]["default"]
        if t == "asset_ref":
            pool = self.assets_by_group.get(cfg.get("asset_group", ""), [])
            return r.choice(pool)["id"] if pool else None
        if t == "signature":
            return ctx["signer"]
        if t == "datetime":
            return self._iso(ctx["times"].get(n, ctx["times"]["start"]))
        if t == "number":
            return self._num(n, ctx)
        if t == "textarea":
            if n == "condition_notes":
                return "" if r.random() < 0.7 else "Minor refractory wear near spout; monitor next heat."
            return r.choice(OPERATORS_NOTES) if r.random() < 0.6 else ""
        if t == "text":
            if n == "billet_size":
                return "130 x 130"
            if n == "group_no":
                return f"G-{r.randint(1, 4)}"
            return None
        return None

    def _times(self, d: date, shift: str, slot: int) -> dict[str, datetime]:
        h = SHIFT_START_HOUR[shift]
        start = self._dt(d, h, 12 + slot * 5)
        if shift == "C":
            start = start  # night shift starts the evening of ``d``
        tap = start + timedelta(minutes=self.rng.randint(78, 98))
        return {
            "start": start,
            "power_on_time": start,
            "tapping_time": tap,
            "previous_heat_tapping_time": start - timedelta(minutes=self.rng.randint(12, 26)),
            "if_tapping_time": start,
            "lm_pouring_time": start + timedelta(minutes=96),
            "ladle_prepare_time": start - timedelta(minutes=20),
            "heat_tapping_time": start + timedelta(minutes=62),
            "ladle_purging_time": start + timedelta(minutes=71),
            "ladle_lifting_time": start + timedelta(minutes=88),
        }

    def _grade_for(self, process: str, idx: int) -> dict:
        order = ["304", "304", "316", "304", "410", "430", "304", "2205", "316", "304"]
        code = order[idx % len(order)]
        return self.grades.get(code) or next(iter(self.grades.values()))

    # chemistry ------------------------------------------------------------
    def _in_spec(self, el: dict, bad: bool = False) -> float:
        lo, hi = el.get("min_value") or 0.0, el.get("max_value") or 0.0
        if hi <= 0:
            return 0.0
        if bad:
            return round(hi * self.rng.uniform(1.05, 1.25), 3)
        return round(self.rng.uniform(lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.85), 3)

    def _chemistry_rows(self, grade_code: str) -> list[dict]:
        rows = []
        for el in self.grade_elements.get(grade_code, []):
            first_bad = self.rng.random() < 0.18 and (el.get("max_value") or 0) > 0
            samples = [self._in_spec(el, bad=first_bad), self._in_spec(el)]
            rows.append({"element": el["element"], "min": el.get("min_value"), "max": el.get("max_value"), "samples": samples})
        return rows

    def _charge(self, grade_code: str) -> tuple[list[dict], list[dict]]:
        r = self.rng
        scrap = {"304": ["304_SCRAP", "CRCA"], "316": ["316_SCRAP", "304_SCRAP"], "410": ["410_SCRAP", "CRCA"],
                 "430": ["410_SCRAP", "CRCA"], "2205": ["2205_SCRAP", "316_SCRAP"]}.get(grade_code, ["304_SCRAP"])
        charge = [{"material": c, "quantity_kg": r.randint(900, 1900)} for c in scrap if c in self.materials]
        alloys = [a for a in ["FE_CR", "FE_NI", "FE_MN", "FE_MO", "HC_FE_CR"] if a in self.materials]
        ferro = [{"material": a, "quantity_kg": r.randint(25, 140)} for a in r.sample(alloys, k=min(3, len(alloys)))]
        return charge, ferro

    def _section_data(self, process: str, section: dict, ctx: dict) -> Any | None:
        key, stype, cfg = section["key"], section["section_type"], (section.get("config") or {})
        r = self.rng
        if stype == "table" and key == "chemistry":
            return {"rows": self._chemistry_rows(ctx["grade_code"])}
        if stype == "repeatable_group":
            charge, ferro = ctx["charge"]
            return {"rows": ferro if key == "ferro_alloys" else charge}
        if stype == "static_material_table":
            codes = [m["code"] for m in cfg.get("materials", [])]
            keep = r.sample(codes, k=min(len(codes), r.randint(2, 4)))
            amount = (lambda c: r.randint(20, 90)) if key == "alloy_additions" else (lambda c: r.randint(60, 420))
            return {"rows": [{"material": c, "quantity_kg": amount(c)} for c in keep]}
        if stype == "matrix_table":
            cols = cfg.get("columns", [])
            rows = []
            t0 = ctx["times"]["start"]
            for i, label in enumerate(cfg.get("rows", [])):
                vals: dict[str, Any] = {}
                for c in cols:
                    if c["type"] == "datetime":
                        vals[c["key"]] = self._iso(t0 + timedelta(minutes=i * 6 + (0 if c["key"] == "time_from" else 5)))
                    elif c["type"] == "number":
                        vals[c["key"]] = round(r.uniform(2, 40), 1)
                rows.append({"blow_no": label, "values": vals})
            return {"rows": rows}
        if stype == "target_chemistry":
            targets: dict[str, float | None] = {}
            for el in self.grade_elements.get(ctx["grade_code"], []):
                hi = el.get("max_value") or 0
                targets[el["element"]] = round(((el.get("min_value") or 0) + hi) / 2, 3) if hi else None
            return {"targets": targets}
        if stype == "sample_chemistry_matrix":
            rows = []
            used = r.randint(5, 8)
            for label in (cfg.get("sample_rows") or [])[:used]:
                elements = {el["element"]: self._in_spec(el) for el in self.grade_elements.get(ctx["grade_code"], [])}
                rows.append({"sample": label, "temperature": r.randint(1540, 1650), "elements": elements})
            return {"rows": rows}
        if stype == "production_log_table":
            return {"rows": self._log_rows(process, section, ctx)}
        if stype == "production_register_table":
            return {"rows": self._register_rows(process, section, ctx)}
        if stype == "delay_register_table":
            return {"rows": self._delay_rows(ctx)}
        if stype == "hourly_production_matrix":
            hours = {}
            for h in cfg.get("hours", []):
                rolled = r.randint(18, 30)
                hours[h] = {"delay_minutes": r.choice([0, 0, 0, 5, 10, 15]), "cobble": r.choice([0, 0, 0, 1]), "hot_out": r.choice([0, 0, 1]),
                            "rolled": rolled, "remarks": r.choice(HOURLY_REMARKS)}
            return {"hours": hours}
        return None

    def _heat_ref(self, ctx: dict) -> dict | None:
        heats = [h for h in self.run_ids.get("IAF", []) if h["state"] in ("closed", "approved", "completed")]
        if not heats:
            return None
        h = self.rng.choice(heats)
        return {"run_id": h["id"], "heat_no": h["heat_no"]}

    def _log_rows(self, process: str, section: dict, ctx: dict) -> list[dict]:
        r = self.rng
        cols = (section.get("config") or {}).get("columns", [])
        count = 3 if process == "CCM" else 4
        rows = []
        t0 = ctx["times"]["start"]
        for i in range(count):
            vals: dict[str, Any] = {}
            ts = t0 + timedelta(minutes=i * 75)
            strand = lambda a, b: {"strand_1": a, "strand_2": b}
            for c in cols:
                k, ty = c["key"], c["type"]
                if k == "heat_no":
                    ref = self._heat_ref(ctx)
                    vals[k] = ref if ty == "heat_ref" and ref else (ref["heat_no"] if ref else f"H{r.randint(1000, 9999)}")
                elif ty == "grade_ref":
                    vals[k] = ctx["grade_id"]
                elif ty == "datetime":
                    vals[k] = self._iso(ts + timedelta(minutes=r.randint(0, 20)))
                elif ty == "furnace_zones":
                    vals[k] = {"heat_zone_1": r.randint(1180, 1230), "heat_zone_2": r.randint(1210, 1260), "soak_zone_1": r.randint(1190, 1240), "soak_zone_2": r.randint(1180, 1230)}
                elif ty == "strand_pair":
                    vals[k] = strand(round(r.uniform(1.0, 1.6), 2), round(r.uniform(1.0, 1.6), 2))
                elif ty == "zone_strand":
                    vals[k] = {"zone_1": strand(r.randint(40, 60), r.randint(40, 60)), "zone_2": strand(r.randint(30, 50), r.randint(30, 50))}
                elif ty == "mould_tube":
                    vals[k] = {"strand_1": {"no": f"MT-{r.randint(10, 40)}", "life": r.randint(20, 300)}, "strand_2": {"no": f"MT-{r.randint(10, 40)}", "life": r.randint(20, 300)}}
                elif ty == "time_range":
                    mins = r.randint(8, 16)
                    vals[k] = {"start": self._iso(ts), "end": self._iso(ts + timedelta(minutes=mins)), "total_minutes": mins}
                elif ty == "object":
                    vals[k] = {"before_purging": r.randint(1585, 1625), "after_purging": r.randint(1560, 1595)}
                elif ty == "dropdown":
                    opts = c.get("options") or []
                    vals[k] = r.choice(opts) if opts else None
                elif ty in ("integer",):
                    vals[k] = {"billets_count": r.randint(36, 46), "charged": r.randint(70, 110), "rolled": r.randint(66, 105), "hot_out": r.randint(0, 3), "cobble": r.randint(0, 2)}.get(k, r.randint(1, 50))
                elif ty == "number":
                    vals[k] = {"liquidus_temp": r.randint(1448, 1462), "tundish_temp": r.randint(1528, 1562), "billet_size": r.choice([100, 110, 125, 130, 150])}.get(k, round(r.uniform(1, 100), 1))
                elif ty == "text":
                    vals[k] = {"section": "130 x 130", "casting_powder": f"CP-{r.randint(10, 25)}", "tundish_no": f"T-{r.randint(1, 4)}", "party": r.choice(["Tata Motors", "Ashok Leyland", "ABC Engineering", "Local trade"]), "supervisor": ctx["signer"]}.get(k, "")
            rows.append({"values": vals})
        return rows

    def _delay_rows(self, ctx: dict) -> list[dict]:
        if not self.delay_codes:
            return []
        r = self.rng
        t0 = ctx["times"]["start"]
        reasons = [("Roll change", "Rolls replaced, line restarted"), ("Furnace pusher jam", "Cleared and re-aligned"), ("Power dip", "Waited for supply to stabilise")]
        rows = []
        for i in range(r.randint(1, 3)):
            reason, action = reasons[i % len(reasons)]
            start = t0 + timedelta(minutes=45 + i * 120)
            mins = r.randint(10, 35)
            rows.append({
                "id": f"demo-{ctx['seq']}-{i}",
                "time_from": start.strftime("%H:%M"),
                "time_to": (start + timedelta(minutes=mins)).strftime("%H:%M"),
                "time_lost_minutes": mins,
                "delay_code_id": r.choice(self.delay_codes)["id"],
                "reason": reason,
                "action_taken": action,
                "assigned_to": ctx["supervisor_id"] if i == 0 else "",
                "status": "closed" if i else "open",
            })
        return rows

    def _register_rows(self, process: str, section: dict, ctx: dict) -> list[dict]:
        r = self.rng
        key = section["key"]
        rows: list[dict] = []
        if process == "WFURN" and key == "input_coils":
            for i in range(r.randint(4, 6)):
                ref = self._heat_ref(ctx)
                coil_no = f"WC-{ctx['date']:%m%d}-{ctx['seq']}{i + 1}"
                ctx.setdefault("coils", []).append(coil_no)
                rows.append({"values": {"work_order_no": f"WO-{r.randint(2600, 2699)}", "grade_id": ctx["grade_id"], "heat_no": ref or f"H{r.randint(1000, 9999)}",
                                        "size_mm": r.choice([5.5, 6.5, 8.0]), "coil_no": coil_no}})
        elif process == "WFURN" and key == "furnace_output":
            for coil in ctx.get("coil_refs", []):
                rows.append({"values": {"coil_ref": coil, "tube_head_no": f"T{r.randint(1, 9)}", "speed_m_min": r.randint(8, 14),
                                        "weight_kg": r.randint(780, 1250), "remark": ""}})
        elif process == "WDRAW" and key == "input_material":
            for coil in ctx.get("inlet_refs", []):
                ref = self._heat_ref(ctx)
                rows.append({"values": {"work_order_no": f"WO-{r.randint(2600, 2699)}", "grade_id": ctx["grade_id"], "heat_no": ref or f"H{r.randint(1000, 9999)}",
                                        "inlet_size_mm": r.choice([5.5, 6.5]), "inlet_coil_ref": coil, "condition": "Annealed"}})
        elif process == "WDRAW" and key == "output_material":
            for i, coil in enumerate(ctx.get("inlet_refs", [])):
                rows.append({"values": {"inlet_coil_ref": coil, "outlet_size_mm": r.choice([2.0, 2.5, 3.2, 4.0]), "lubricant": "Soap powder",
                                        "finish_coil_no": f"FC-{ctx['date']:%m%d}-{ctx['seq']}{i + 1}", "weight_kg": r.randint(700, 1200), "remark": ""}})
        elif process == "BBAR":
            for i in range(r.randint(4, 8)):
                ref = self._heat_ref(ctx)
                weight = r.randint(40, 85)
                count = r.randint(4, 14)
                rows.append({"values": {"r_size_mm": r.choice([12, 16, 20, 25, 32]), "grade_id": ctx["grade_id"], "final_size_mm": r.choice([11.8, 15.7, 19.6, 24.5, 31.5]),
                                        "heat_no": ref or f"H{r.randint(1000, 9999)}", "coil_weight_kg": weight, "coil_count": count,
                                        "total_weight_kg": weight * count,
                                        "customer_id": r.choice(self.customers)["id"] if self.customers else None}})
        return rows

    # -------------------------------------------------------------- run lifecycle
    async def _make_run(self, process: str, days_ago: int, shift: str, final: str, seq: int) -> None:
        run_type, worker_key, sup_key, prefix = PROCESS_PLAN[process]
        # Sheets left at "completed" were started by the shift in-charge, so each supervisor's My Runs has something in it.
        operator_key = worker_key
        if final == "completed":
            worker_key = "legacy_sup" if (process == "IAF" and shift == "C") else sup_key
        instances = self.instances.get(process) or []
        if not instances or shift not in self.shifts:
            return
        d = self.today - timedelta(days=days_ago)
        inst = instances[seq % len(instances)]
        grade = self._grade_for(process, seq)
        idx = self.counters.get(process, 0) + 1
        self.counters[process] = idx
        heat_no = f"{d:%y%m%d}-{idx:02d}"
        run_number = f"{prefix}-{d:%Y%m%d}-{idx:04d}"
        if run_number in self.existing_numbers:
            return  # created by an earlier, interrupted start
        body: dict[str, Any] = {"run_type": run_type, "run_number": run_number, "metadata": {"demo": True}}
        if run_type != "daily":
            body["shift_id"] = self.shifts[shift]["id"]
        if process == "IAF":
            body["grade_id"] = grade["id"]
        run = await self.ok(worker_key, "POST", f"/process-instances/{inst['id']}/runs", json=body)
        if not run:
            return
        rid = run["id"]
        detail = await self.ok(worker_key, "GET", f"/process-runs/{rid}")
        tv = await self.ok(worker_key, "GET", f"/templates/versions/{detail['template_version_id']}")
        if not tv:
            return
        times = self._times(d, shift, seq % 3)
        dept_people = self._people(process, operator_key, sup_key)
        ctx: dict[str, Any] = {
            "date": d, "shift": shift, "heat_no": heat_no, "grade_id": grade["id"], "grade_code": grade["code"],
            "people": dept_people, "signer": self.me[operator_key]["full_name"], "times": times, "seq": idx,
            "supervisor_id": self._user_id(sup_key), "charge": self._charge(grade["code"]),
        }
        # How much of the sheet exists depends on how far the run got.
        sections = tv["sections"]
        fill_all = final in ("completed", "approved", "closed")
        limit = len(sections) if fill_all else (3 if final == "in_progress" else 5)
        if process in ("WDRAW",):
            ctx["inlet_refs"] = await self._available_coils()
        field_values: list[dict] = []
        section_data: list[dict] = []
        for s in sections[:limit]:
            if s["section_type"] == "fields":
                for f in s.get("fields", []):
                    if f["name"] == "heat_no" and process != "IAF" and f["field_type"] != "text":
                        continue
                    v = self._field_value(f, ctx)
                    if v is not None and v != "":
                        field_values.append({"field_key": f["name"], "value": v})
            else:
                if process == "WFURN" and s["key"] == "furnace_output":
                    continue  # built below, once the input coils exist
                data = self._section_data(process, s, ctx)
                if data is not None:
                    section_data.append({"section_key": s["key"], "data": data})
        # IAF energy meters must make sense: final reading = initial + units.
        await self.ok(worker_key, "POST", f"/process-runs/{rid}/transitions", json={"to_state": "in_progress"})
        # The wire furnace registers input coils first so the output rows can point at them.
        if process == "WFURN":
            first = [x for x in section_data if x["section_key"] == "input_coils"]
            others = [x for x in section_data if x["section_key"] != "input_coils"]
            await self.call(worker_key, "PATCH", f"/process-runs/{rid}", json={"field_values": field_values, "section_data": first})
            ctx["coil_refs"] = await self._coil_refs(ctx.get("coils", []), worker_key)
            out_sec = next((s for s in sections if s["key"] == "furnace_output"), None)
            if out_sec and fill_all:
                others.append({"section_key": "furnace_output", "data": {"rows": self._register_rows(process, out_sec, ctx)}})
            await self.call(worker_key, "PATCH", f"/process-runs/{rid}", json={"section_data": others})
        else:
            await self.call(worker_key, "PATCH", f"/process-runs/{rid}", json={"field_values": field_values, "section_data": section_data})

        if fill_all and process in ("IAF", "AOD", "CCM", "RMILL") and self.rng.random() < 0.4:
            rem = await self.ok(worker_key, "POST", f"/process-runs/{rid}/remarks", json={"body": self.rng.choice([
                "Re-sampled once for carbon, now within range.", "Short power dip during melting.", "Waiting for scrap trolley, 10 min delay."])})
            reply_to = rem["id"] if rem else None
        else:
            reply_to = None

        path = IAF_PATH if process == "IAF" else (GRIND_PATH if process == "GRIND" else PLAIN_PATH)
        target = "aborted" if final == "aborted" else final
        actors = {"approved": sup_key, "closed": sup_key, "aborted": sup_key}
        reached: list[str] = []
        if final == "aborted":
            path = ["in_progress"]
        for st in path:
            if st == "in_progress":
                reached.append(st)
                if final == "in_progress":
                    break
                continue
            if st in ("waiting_for_sample", "refining", "ready_to_tap") and final in ("in_progress",):
                break
            who = actors.get(st, worker_key)
            status, _ = await self.call(who, "POST", f"/process-runs/{rid}/transitions", json={"to_state": st})
            if status >= 400:
                break
            reached.append(st)
            if st == "completed" and reply_to and worker_key not in (sup_key, "legacy_sup"):
                await self.call(sup_key, "POST", f"/process-runs/{rid}/remarks/{reply_to}/reply", json={"body": self.rng.choice(["Noted.", "OK, keep me posted.", "Thanks, logged."])})
            if st == "completed" and final != "completed" and self.rng.random() < 0.3:
                await self.call(sup_key, "POST", f"/process-runs/{rid}/remarks", json={"body": self.rng.choice([
                    "Checked and OK to sign off.", "Please note the tap temperature on the next heat.", "Good heat. Yield above target."])})
            if st == target:
                break
        if final == "aborted":
            await self.call(sup_key, "POST", f"/process-runs/{rid}/transitions", json={"to_state": "aborted", "notes": "Abort: furnace lining breakout risk"})
        if final == "in_progress" and process == "IAF":
            # Today's heat is part-way: move it into refining so the pulse shows a live heat.
            for st in ("waiting_for_sample", "refining"):
                await self.call(worker_key, "POST", f"/process-runs/{rid}/transitions", json={"to_state": st})

        # Remember it for later cross-references (heat refs, coils) and for backdating.
        rec = {"id": rid, "heat_no": heat_no, "state": final, "start": times["start"], "grade": grade["code"], "process": process}
        self.run_ids.setdefault(process, []).append(rec)
        await self.backdate_run(rec)
        if process == "WFURN" and ctx.get("coil_refs"):
            self.run_ids.setdefault("_coils", []).extend(ctx["coil_refs"] if fill_all else [])

    def _people(self, process: str, worker_key: str, sup_key: str) -> dict[str, str]:
        w = self._user_id(worker_key)
        s = self._user_id(sup_key)
        return {"default": w, "melter": w, "operator": w, "aod_melter": w, "if_melter": w, "aod_shift_incharge": self._user_id("sup_aod"),
                "ccm_shift_incharge": self._user_id("sup_ccm"), "shift_incharge_production": s, "mechanical_incharge": s,
                "electrical_incharge": s, "main_pulpit_operator": w, "furnace_incharge": w, "mill_roller": w, "finishing_roller": w, "lab_chemist": s}

    async def _coil_refs(self, coil_nos: list[str], who: str) -> list[dict]:
        refs = []
        for no in coil_nos:
            found = await self.ok(who, "GET", "/coils/lookup", params={"plant_id": self.plant_id, "coil_no": no})
            if found:
                refs.append({"coil_id": found[0]["id"], "coil_no": found[0]["coil_no"]})
        return refs

    async def _available_coils(self) -> list[dict]:
        pool = self.run_ids.get("_coils", [])
        take = pool[:3]
        self.run_ids["_coils"] = pool[3:]
        return take

    async def make_runs(self) -> None:
        async with async_session_factory() as session:
            rows = await session.execute(select(ProcessRun.run_number).where(ProcessRun.metadata_["demo"].astext == "true"))
            self.existing_numbers = {r[0] for r in rows}
        seq = 0
        # Coils are produced by the wire furnace before drawing consumes them, so do furnaces first.
        order = ["IAF", "AOD", "CCM", "WFURN", "WDRAW", "RMILL", "BBAR", "GRIND"]
        for process in order:
            for p, days, shift, final in RUN_PLAN:
                if p != process:
                    continue
                seq += 1
                try:
                    await self._make_run(p, days, shift, final, seq)
                except Exception:  # one bad run must not stop the rest
                    log.exception("demo seed: run %s failed", p)
        log.info("demo seed: %s runs created", sum(len(v) for k, v in self.run_ids.items() if not k.startswith("_")))

    # ----------------------------------------------------------------- backdating
    async def backdate_run(self, rec: dict) -> None:
        """Move one finished run (and its log, events, remarks and cost calculation) to its real day."""
        process, start, state = rec["process"], rec["start"], rec["state"]
        async with async_session_factory() as session:
            run = await session.get(ProcessRun, uuid.UUID(rec["id"]))
            if not run:
                return
            duration = timedelta(hours=1, minutes=self.rng.randint(25, 50)) if process in ("IAF", "AOD") else timedelta(hours=7, minutes=self.rng.randint(20, 40))
            if state == "in_progress":
                start = datetime.now(IST) - timedelta(minutes=self.rng.randint(35, 80))
            run.created_at = start - timedelta(minutes=4)
            run.started_at = start
            done = start + duration
            if state in ("completed", "approved", "closed", "aborted"):
                run.completed_at = done
            if state in ("closed", "aborted"):
                run.closed_at = done + timedelta(minutes=self.rng.randint(40, 190))
            run.updated_at = run.closed_at or run.completed_at or start
            logs = (await session.execute(
                select(WorkflowTransitionLog).where(WorkflowTransitionLog.run_id == run.id).order_by(WorkflowTransitionLog.created_at)
            )).scalars().all()
            for i, lg in enumerate(logs):
                if lg.to_state in ("approved", "closed", "aborted"):
                    lg.created_at = (run.closed_at or done) - timedelta(minutes=(10 if lg.to_state == "closed" else 60))
                elif lg.to_state == "completed":
                    lg.created_at = done
                else:
                    lg.created_at = start + (duration * (i + 1)) / (len(logs) + 1)
            events = (await session.execute(select(OperationalEvent).where(OperationalEvent.run_id == run.id))).scalars().all()
            for ev in events:
                ev.occurred_at = start + timedelta(minutes=self.rng.randint(1, int(duration.total_seconds() // 60) or 1))
            remarks = (await session.execute(select(RunRemark).where(RunRemark.run_id == run.id).order_by(RunRemark.created_at))).scalars().all()
            for i, rm in enumerate(remarks):
                rm.created_at = start + (duration * (i + 1)) / (len(remarks) + 1)
            calcs = (await session.execute(select(CostCalculation).where(CostCalculation.process_run_id == run.id))).scalars().all()
            for c in calcs:
                c.calculated_at = run.closed_at or run.completed_at or start
            await session.commit()

    # ------------------------------------------------------------------- the rest
    async def make_workforce(self) -> None:
        r = self.rng
        # Everyone who works in a department gets a shift and a salary, so every login has attendance and a payslip.
        assignments = await self.ok("hr", "GET", "/workforce/shift-assignments") or []
        assigned = {a["user_id"] for a in assignments}
        structures = {s["user_id"] for s in (await self.ok("hr", "GET", "/workforce/payroll/salary-structures") or [])}
        pay = {"hod": (48000, 15000, 4000), "supervisor": (32000, 10000, 3000), "worker": (22000, 7000, 1500)}
        for who in ACCOUNTS:
            me = self.me.get(who) or {}
            uid, dept = me.get("id"), me.get("department_id")
            if not uid or not dept or me.get("role") not in pay:
                continue
            if uid not in assigned:
                shift = self.shifts["A" if me["role"] != "worker" else ["A", "B"][len(assigned) % 2]]["id"]
                await self.call("hr", "POST", "/workforce/shift-assignments", json={"user_id": uid, "department_id": dept, "shift_id": shift, "effective_date": (self.today - timedelta(days=45)).isoformat()})
                assigned.add(uid)
            if uid not in structures:
                basic, hra, allow = pay[me["role"]]
                await self.call("hr", "POST", "/workforce/payroll/salary-structures", json={"user_id": uid, "basic": basic, "hra": hra, "allowances": allow, "pf": round(basic * 0.12), "esi": 500, "other_deductions": 200, "effective_from": "2024-01-01"})
                structures.add(uid)
        assignments = await self.ok("hr", "GET", "/workforce/shift-assignments") or []
        groups: dict[tuple[str, str], list[str]] = {}
        for a in assignments:
            groups.setdefault((a["department_id"], a["shift_id"]), []).append(a["user_id"])
        days = _weekdays_back(12, self.today)  # includes today, so today's dashboard is not empty
        # last full calendar month, for payroll
        first_this = self.today.replace(day=1)
        last_prev = first_this - timedelta(days=1)
        month_days = [d for d in (last_prev.replace(day=i) for i in range(1, last_prev.day + 1)) if d.weekday() < 6]
        marks = {"present": 80, "absent": 3, "half_day": 5, "leave": 2}
        statuses = list(marks)
        weights = list(marks.values())

        async def mark(d: date) -> None:
            for (dept, shift), users in groups.items():
                entries = [{"user_id": u, "status": r.choices(statuses, weights)[0]} for u in users]
                await self.call("hr", "POST", "/workforce/attendance/bulk", json={"attendance_date": d.isoformat(), "department_id": dept, "shift_id": shift, "entries": entries})

        for d in sorted(set(days) | set(month_days)):
            await mark(d)
        workers = await self.ok("hr", "GET", "/workforce/contract-workers") or []
        pairs = sorted({(w["contractor_id"], w["department_id"]) for w in workers})
        shift_a = self.shifts["A"]["id"]
        for contractor_id, dept in pairs:
            for d in days:
                await self.call("hr", "POST", "/workforce/contractor-attendance", json={"attendance_date": d.isoformat(), "contractor_id": contractor_id, "department_id": dept, "shift_id": shift_a, "workers_present": r.randint(3, 6), "workers_absent": r.randint(0, 2)})
        log.info("demo seed: attendance recorded")

        # Shift rosters: this week (published) and next week (draft) for every department.
        monday = self.today - timedelta(days=self.today.weekday())
        by_dept: dict[str, list[tuple[str, str]]] = {}
        for (dept, shift), users in groups.items():
            by_dept.setdefault(dept, []).extend((u, shift) for u in users)
        for week, publish in ((monday, True), (monday + timedelta(days=7), False)):
            for dept, members in by_dept.items():
                entries = []
                for i, (uid, shift) in enumerate(members):
                    rotate = list(self.shifts)
                    # next week the shifts rotate by one, as a real roster would
                    code = next(c for c, s in self.shifts.items() if s["id"] == shift)
                    if not publish:
                        code = rotate[(rotate.index(code) + 1) % len(rotate)] if code in rotate else code
                    for day in range(6):
                        entries.append({"user_id": uid, "shift_id": self.shifts[code]["id"], "roster_date": (week + timedelta(days=day)).isoformat()})
                roster = await self.ok("hr", "POST", "/workforce/ops/rosters", json={"department_id": dept, "period_start": week.isoformat(), "period_end": (week + timedelta(days=5)).isoformat(), "period_type": "weekly", "entries": entries})
                if roster and publish:
                    await self.call("hr", "POST", f"/workforce/ops/rosters/{roster['id']}/publish")

        # Payroll for the previous month (uses the attendance just recorded)
        run = await self.ok("hr", "POST", "/workforce/payroll/runs", json={"plant_id": self.plant_id, "month": last_prev.month, "year": last_prev.year})
        if run:
            await self.call("hr", "POST", f"/workforce/payroll/runs/{run['id']}/process")

        # Leave requests
        types = await self.ok("worker_sms", "GET", "/workforce/leave/types") or []
        tid = {t["code"]: t["id"] for t in types}
        plan = [
            ("worker_sms", "CL", -9, 1, "approve", "Family function"),
            ("worker_sms", "SL", -3, 2, "approve", "Fever"),
            ("worker_sms", "CL", 4, 1, None, "Personal work"),
            ("worker_rolling", "EL", -6, 3, "approve", "Village visit"),
            ("worker_rolling", "CL", 5, 1, None, "Bank work"),
            ("worker_wire", "SL", -2, 1, "reject", "Not feeling well"),
            ("worker_wire", "CL", 8, 2, None, "Wedding"),
            ("worker_bbd", "CL", -5, 1, "approve", "Child's school meeting"),
            ("worker_forge", "EL", 6, 4, None, "Home repairs"),
        ]
        for who, code, off, span, decision, why in plan:
            if code not in tid:
                continue
            frm = self.today + timedelta(days=off)
            lr = await self.ok(who, "POST", "/workforce/leave/requests", json={"leave_type_id": tid[code], "from_date": frm.isoformat(), "to_date": (frm + timedelta(days=span - 1)).isoformat(), "remarks": why})
            if lr and decision:
                await self.call("hr", "POST", f"/workforce/leave/requests/{lr['id']}/{decision}", json={"remarks": "Approved" if decision == "approve" else "Needed at the plant that week"})

        # Shift handover notes
        notes = {
            "sup_iaf": ["IAF-2 crucible at 38 heats; plan a reline by Friday.", "Cooling water pressure low on IAF-1 at start of shift; maintenance informed.", "Scrap yard stocked with 304 for two days.", "Transformer oil temperature slightly high; monitor."],
            "sup_aod": ["Argon cylinder bank changed over at 3 pm.", "Lance cleaned; AOD-2 vessel at 90 heats."],
            "sup_ccm": ["Tundish T-2 preheated for the next cast.", "Mould tube MT-21 replaced."],
            "sup_rolling": ["Roll change planned for Saturday night shift.", "Furnace pusher aligned after the morning jam."],
            "sup_wire": ["Annealing furnace temperature profile verified.", "Drawing die set changed for 3.2 mm."],
            "sup_bbd": ["Peeling queue pending for two orders.", "Packing material for Tata dispatch ready."],
            "sup_forge": ["Grinding wheels replaced on work centre 1."],
        }
        for who, texts in notes.items():
            dept = self.me[who]["department_id"]
            for i, text in enumerate(texts):
                d = self.today - timedelta(days=i)
                shift = ["A", "B", "C"][i % 3]
                await self.call(who, "POST", "/workforce/handover-notes", json={"note_date": d.isoformat(), "department_id": dept, "shift_id": self.shifts[shift]["id"], "note": text})

        # Skills & training
        skill = await self.ok("hr", "POST", "/workforce/ops/skills", json={"code": "DEMO-IAF", "name": "Induction furnace operation"})
        skill2 = await self.ok("hr", "POST", "/workforce/ops/skills", json={"code": "DEMO-WELD", "name": "Hot work safety"})
        for who in ("worker_sms", "sup_iaf", "worker_rolling", "worker_wire"):
            uid = self._user_id(who)
            if skill:
                await self.call("hr", "POST", f"/workforce/ops/employees/{uid}/skills", json={"skill_id": skill["id"], "proficiency_level": r.choice(["intermediate", "advanced", "expert"])})
            if skill2:
                await self.call("hr", "POST", f"/workforce/ops/employees/{uid}/skills", json={"skill_id": skill2["id"], "proficiency_level": "intermediate"})
        for who, name, cert, days_valid in [("worker_sms", "Fire safety refresher", "FS-2026-114", 22), ("sup_iaf", "First aid", "FA-2025-081", 12), ("worker_rolling", "Crane operation", "CR-2025-230", 190), ("worker_wire", "Electrical safety", "ES-2026-045", 320), ("sup_rolling", "Confined space entry", "CS-2025-019", 40)]:
            await self.call("hr", "POST", "/workforce/ops/training", json={"user_id": self._user_id(who), "name": name, "certification": cert, "issue_date": (self.today - timedelta(days=330)).isoformat(), "expiry_date": (self.today + timedelta(days=days_valid)).isoformat()})
        log.info("demo seed: workforce data done")

    async def make_issues_and_safety(self) -> None:
        r = self.rng
        iaf_runs = [x for x in self.run_ids.get("IAF", []) if x["state"] in ("closed", "completed")]
        run_ref = lambda: (r.choice(iaf_runs)["id"] if iaf_runs else None)
        issues = [
            ("sup_iaf", "equipment", "high", "IAF-2 cooling water flow low", "Flow switch trips twice a shift on IAF-2.", "maint_equipment", "close", "Flow switch cleaned and recalibrated; running normal.", 6),
            ("sup_iaf", "equipment", "medium", "Crucible lining erosion near spout", "Lining thin at spout after 38 heats.", "maint_equipment", "close", "Spout patched with refractory; reline scheduled.", 4),
            ("sup_iaf", "energy", "low", "Power factor dipping in evening", "Capacitor bank step 3 not switching in.", "maint_energy", "take", None, 2),
            ("sup_aod", "process", "medium", "Argon flow meter reading unstable", "Reading fluctuates during blow.", "maint_process", "close", "Meter cleaned and re-zeroed.", 5),
            ("sup_aod", "safety", "high", "Gas hose clamp loose at lance", "Clamp found loose during inspection.", "maint_safety", "close", "Clamp replaced; hose pressure-tested.", 3),
            ("sup_ccm", "quality", "medium", "Billet surface cracks on strand 2", "Cracks seen on 3 billets in cast 14.", "maint_quality", "close", "Traced to casting powder; powder changed and casting speed reduced.", 2),
            ("sup_rolling", "equipment", "high", "Roll stand 4 bearing noise", "Noise and vibration increasing.", None, None, None, 1),
            ("sup_rolling", "equipment", "medium", "Pusher hydraulic leak", "Oil leak at cylinder gland.", "maint_equipment", "close", "Gland seal replaced and cylinder topped up.", 2),
            ("sup_wire", "energy", "low", "Annealing furnace burner flame uneven", "Flame pattern uneven on burner 3.", "maint_energy", "close", "Burner nozzle cleaned; flame pattern restored.", 3),
            ("sup_bbd", "quality", "low", "Straightener rollers marking bars", "Light marking on 16 mm bars.", "maint_quality", "close", "Rollers dressed and polished.", 3),
            ("worker_forge", "process", "medium", "Grinding wheel guard cracked", "Guard on work centre 1 has a crack.", "maint_process", "close", "Guard replaced before the next shift.", 1),
        ]
        created: list[tuple[str, str, int]] = []
        for who, cat, sev, title, desc, crew, action, notes, age in issues:
            body = {"title": title, "description": desc, "category": cat, "severity": sev}
            rid = run_ref() if who == "sup_iaf" else None
            if rid:
                body["run_id"] = rid
            issue = await self.ok(who, "POST", "/maintenance/issues", json=body)
            if not issue:
                continue
            if crew and action in ("take", "close"):
                await self.call(crew, "POST", f"/maintenance/issues/{issue['id']}/assign")
            if crew and action == "close":
                await self.call(crew, "POST", f"/maintenance/issues/{issue['id']}/close", json={"resolution_notes": notes})
            created.append((issue["id"], action or "", age))
        async with async_session_factory() as session:
            for iid, action, age in created:
                row = await session.get(MaintenanceIssue, uuid.UUID(iid))
                if not row:
                    continue
                raised = datetime.now(IST) - timedelta(days=age, hours=r.randint(1, 6))
                row.raised_at = raised
                row.created_at = raised
                if row.assigned_at:
                    row.assigned_at = raised + timedelta(hours=r.randint(1, 3))
                if row.closed_at:
                    row.closed_at = raised + timedelta(hours=r.randint(5, 30))
            await session.commit()

        # Observations & corrective actions
        plant = self.plant_id
        obs = [
            ("sup_iaf", "safety", "medium", "Housekeeping around IAF platform", "Loose scrap near the platform edge.", "sup_iaf"),
            ("sup_aod", "quality", "low", "Sample labels hard to read", "Ink fades on ladle sample tags.", "sup_aod"),
            ("hod_sms", "process", "medium", "Tap-to-tap time above target on night shift", "Average 112 min vs 100 target over the last week.", "sup_iaf"),
            ("sup_rolling", "equipment", "high", "Recurring pusher jams", "Three jams in a week; check alignment.", "sup_rolling"),
            ("hod_wire", "energy", "low", "Annealing furnace idle burn", "Furnace kept hot between coils.", "sup_wire"),
            ("hod_bbd", "quality", "medium", "Scratches on peeled 20 mm bars", "Light scratches seen after peeling on two lots.", "sup_bbd"),
            ("hod_forge", "safety", "medium", "Weak dust extraction at work centre 2", "Collector suction below normal during grinding.", "sup_forge"),
            ("hod_rolling", "process", "low", "Billet heating uneven at furnace exit", "Cold ends seen on three billets.", "sup_rolling"),
        ]
        for i, (who, cat, sev, title, desc, assignee) in enumerate(obs):
            dept = self.me[who]["department_id"]
            o = await self.ok(who, "POST", "/foundation/observations", json={"plant_id": plant, "title": title, "description": desc, "department_id": dept, "category": cat, "severity": sev})
            if not o:
                continue
            self.obs_ids.append(o["id"])
            ca = await self.ok(who, "POST", f"/foundation/observations/{o['id']}/corrective-actions", json={"title": f"Action: {title.split(' ')[0]} fix", "assigned_to": self._user_id(assignee), "due_date": (self.today + timedelta(days=5 + i * 3)).isoformat(), "priority": r.choice(["medium", "high"])})
            if ca:
                self.ca_ids.append(ca["id"])
            if ca and i in (0, 3):
                await self.call(who, "PATCH", f"/foundation/corrective-actions/{ca['id']}", json={"status": "closed", "closure_notes": "Completed and verified on the floor."})

        # Safety
        for who, title, sev, desc in [("worker_sms", "Minor spill near furnace bay", "low", "Coolant spill cleaned within 10 minutes."), ("sup_rolling", "Near miss: loose guard on roll stand", "medium", "Guard refitted; toolbox talk held."), ("maint_safety", "Fire extinguisher past inspection date", "low", "Extinguisher in the wire shop refilled.")]:
            await self.call(who, "POST", f"/safety/incidents/{plant}", json={"title": title, "description": desc, "severity": sev, "occurred_at": (datetime.now(timezone.utc) - timedelta(days=r.randint(1, 9))).isoformat()})
        for who, kind, finding, due in [("maint_safety", "Fire safety walk-through", "All extinguishers tagged; one refilled.", 28), ("sup_iaf", "Furnace platform inspection", "Handrails secure; cooling hoses in good condition.", 14), ("maint_safety", "Electrical panel inspection", "No hot spots on thermography.", 45), ("sup_rolling", "Crane sling inspection", "Two slings withdrawn from use.", 7)]:
            await self.call(who, "POST", f"/safety/inspections/{plant}", json={"inspection_type": kind, "findings": finding, "next_due_at": (datetime.now(timezone.utc) + timedelta(days=due)).isoformat()})
        log.info("demo seed: issues, observations and safety done")

    async def make_messages(self) -> None:
        msgs = [
            ("ceo", None, True, "Plant safety week", "Safety week starts Monday. Toolbox talks at the start of every shift please."),
            ("hr", None, True, "Attendance reminder", "Please make sure attendance is marked before the end of each shift."),
            ("hod_sms", ["sup_iaf", "sup_aod", "sup_ccm"], False, "Tap-to-tap review", "Let us review night shift tap-to-tap times on Thursday morning."),
            ("sup_iaf", ["hod_sms"], False, "Crucible reline request", "IAF-2 crucible is at 38 heats. Requesting a reline slot on Friday."),
            ("worker_sms", ["sup_iaf"], False, "Uniform request", "Need a new set of safety shoes, size 9."),
            ("hr", ["worker_rolling", "worker_wire", "worker_bbd"], False, "Payslips available", "Last month's payslips are now available under My Payslips."),
            ("legacy_sup", ["hod_sms"], False, "Scrap stock", "Scrap yard has two days of 304 left; please plan the next purchase."),
            ("admin", None, True, "Welcome to MOI", "Your plant's logbook is live. Use Messages for anything the whole team should see."),
            ("hod_rolling", ["sup_rolling", "worker_rolling"], False, "Roll change on Saturday", "Roll change is planned for the Saturday night shift. Please prepare the roll shop."),
            ("sup_rolling", ["hod_rolling"], False, "Pusher alignment", "Pusher aligned after the morning jam. Watching it for the next two shifts."),
            ("worker_rolling", ["sup_rolling"], False, "Gloves stock", "Gloves are running low at the mill pulpit."),
            ("hod_wire", ["sup_wire", "worker_wire"], False, "Die set change", "Die set for 3.2 mm arrives Tuesday. Plan the changeover."),
            ("sup_wire", ["worker_wire"], False, "Annealing profile", "Please follow the revised annealing profile from today's shift."),
            ("worker_wire", ["sup_wire"], False, "Lubricant stock", "Soap powder will finish by tomorrow evening."),
            ("hod_bbd", ["sup_bbd", "worker_bbd"], False, "Dispatch plan", "Tata dispatch is on Thursday. Keep the packing material ready."),
            ("sup_bbd", ["hod_bbd"], False, "Peeling queue", "Two orders are waiting for the peeling machine."),
            ("worker_bbd", ["sup_bbd"], False, "Straightener noise", "Straightener roller makes a rubbing sound at speed."),
            ("hod_forge", ["sup_forge", "worker_forge"], False, "Wheel change schedule", "Grinding wheels are changed every Monday. Please log it."),
            ("sup_forge", ["hod_forge"], False, "Dust collector", "Dust collector suction is weak at centre 2; maintenance informed."),
            ("worker_forge", ["sup_forge"], False, "Ear plugs", "Need a fresh box of ear plugs."),
            ("sup_aod", ["hod_sms"], False, "Argon bank", "Argon bank changeover done; 40 bar on the new bank."),
            ("sup_ccm", ["hod_sms"], False, "Tundish plan", "Tundish T-2 preheated for tomorrow's first cast."),
            ("maint_equipment", ["hr"], False, "IAF-2 flow switch replaced", "Flow switch replaced on IAF-2; the trip has not returned since."),
            ("maint_process", ["hr"], False, "Flow meter calibration", "Argon flow meter calibrated; certificate in documents."),
            ("maint_quality", ["hr"], False, "Casting powder", "New casting powder batch checked; use from the next cast."),
            ("maint_safety", ["hr"], False, "Fire audit", "Fire extinguisher audit is due this month. Please keep access clear."),
            ("maint_energy", ["hr"], False, "Power factor", "Capacitor bank step 3 repaired; power factor back above 0.95."),
        ]
        for who, to, broadcast, subject, body in msgs:
            payload: dict[str, Any] = {"subject": subject, "body": body, "recipient_ids": [self._user_id(t) for t in (to or [])], "is_broadcast": broadcast}
            sent = await self.ok(who, "POST", "/messages", json=payload)
            if sent:
                self.msg_ids.append(sent["id"])

    async def make_documents(self) -> None:
        """Two controlled documents per department, uploaded by that department's HoD."""
        catalog = {
            "hod_sms": [("sop", "Induction furnace operating SOP", "Charging, melting, sampling and tapping steps for the induction furnaces."),
                        ("safety_procedure", "Hot metal handling safety", "Protective equipment, ladle checks and spill response.")],
            "hod_rolling": [("work_instruction", "Roll change work instruction", "Steps and checks for a safe roll change."),
                            ("maintenance_manual", "Rolling mill lubrication chart", "Greasing points and intervals for every stand.")],
            "hod_wire": [("sop", "Wire drawing die change SOP", "Die set removal, fitting and first-coil checks."),
                         ("quality_document", "Annealing temperature profiles", "Approved profiles by grade and coil size.")],
            "hod_bbd": [("work_instruction", "Peeling and straightening instruction", "Setup, speeds and surface checks for bright bar."),
                        ("quality_document", "Bright bar inspection checklist", "Dimension, straightness and surface finish checks.")],
            "hod_forge": [("safety_procedure", "Grinding machine safety", "Wheel inspection, guards and dust extraction checks."),
                          ("training_material", "Forge shop induction", "Introduction for new joiners to the forge shop.")],
        }
        for who, docs in catalog.items():
            await self.login(who)
            dept = self.me[who]["department_id"]
            for category, title, body in docs:
                content = _simple_pdf(title, body)
                await self.call(who, "POST", "/foundation/documents", data={"plant_id": self.plant_id, "department_id": dept, "category": category, "title": title, "version": "1.0"},
                                files={"file": (title.lower().replace(" ", "_") + ".pdf", content, "application/pdf")})

    async def make_work_orders(self) -> None:
        sms = self.me["hod_sms"]["department_id"]
        rolling = self.me["hod_rolling"]["department_id"]
        catalog = [
            ("IAF cooling water system check", sms, "equipment", "high", 30, ["Check flow switch", "Inspect hoses and clamps", "Record pump pressure"]),
            ("AOD lance and gas train inspection", sms, "process", "medium", 14, ["Inspect lance tip", "Leak-test gas train", "Check flow meters"]),
            ("CCM mould tube inspection", sms, "equipment", "high", 21, ["Measure mould tube taper", "Check water channels"]),
            ("Rolling mill bearing lubrication", rolling, "equipment", "medium", 7, ["Grease roll-neck bearings", "Check oil level in gearbox", "Listen for abnormal noise"]),
            ("Transformer oil and temperature check", sms, "energy", "medium", 30, ["Record oil temperature", "Check breather silica gel"]),
            ("Fire extinguisher and hydrant audit", sms, "safety", "low", 90, ["Check pressure gauges", "Verify tags and dates"]),
        ]
        programs: list[dict] = []
        for name, dept, cat, prio, every, tasks in catalog:
            prog = await self.ok("ceo", "POST", "/maintenance/pm/programs", json={
                "plant_id": self.plant_id, "department_id": dept, "name": name, "category": cat, "priority": prio,
                "status": "active", "auto_generate_work_orders": True, "responsible_team": "Maintenance crew"})
            if not prog:
                continue
            await self.call("ceo", "POST", f"/maintenance/pm/programs/{prog['id']}/triggers", json={"trigger_type": "time", "interval_days": every})
            for i, t in enumerate(tasks):
                await self.call("ceo", "POST", f"/maintenance/pm/programs/{prog['id']}/tasks", json={
                    "name": t, "is_required": True, "sort_order": i + 1, "estimated_duration_min": 20, "checklist": ["Done", "No defects found"]})
            programs.append(prog)
        # Push work orders to different points of the lifecycle so every status is represented.
        stages = ["assigned", "accepted", "in_progress", "completed", "closed", "draft"]
        for prog, stage in zip(programs, stages):
            wo = await self.ok("ceo", "POST", f"/maintenance/pm/programs/{prog['id']}/generate-work-order")
            if not wo:
                continue
            wid = wo["id"]
            crew = "maint_process" if prog["category"] == "process" else "maint_equipment"
            steps = {"draft": [], "assigned": ["assigned"], "accepted": ["assigned", "accepted"], "in_progress": ["assigned", "accepted", "in_progress"],
                     "completed": ["assigned", "accepted", "in_progress", "completed"], "closed": ["assigned", "accepted", "in_progress", "completed", "verified", "closed"]}[stage]
            for st in steps:
                if st == "completed":
                    full = await self.ok("ceo", "GET", f"/maintenance/pm/work-orders/{wid}") or {}
                    for t in full.get("tasks", []):
                        await self.call(crew, "POST", f"/maintenance/pm/work-orders/{wid}/tasks/{t['id']}/execute", json={"status": "pass", "remarks": "Checked, no issues"})
                who = "hod_sms" if st == "assigned" else ("ceo" if st == "closed" else crew)
                await self.call(who, "POST", f"/maintenance/pm/work-orders/{wid}/transition", json={"to_state": st})

    async def backdate_misc(self) -> None:
        """Messages, observations and actions were created 'just now'; spread them over the past week.
        Only the records this seed created are touched."""
        r = self.rng
        now = datetime.now(IST)
        async with async_session_factory() as session:
            for i, mid in enumerate(self.msg_ids):
                m = await session.get(Message, uuid.UUID(mid))
                if m:
                    m.created_at = now - timedelta(days=(len(self.msg_ids) - i) // 3, hours=r.randint(0, 5))
            for i, oid in enumerate(self.obs_ids):
                o = await session.get(Observation, uuid.UUID(oid))
                if o:
                    age = timedelta(days=1 + (i * 2) % 9, hours=r.randint(0, 8))
                    o.observed_at = now - age
                    o.created_at = now - age
            for i, cid in enumerate(self.ca_ids):
                c = await session.get(CorrectiveAction, uuid.UUID(cid))
                if c:
                    c.created_at = now - timedelta(days=1 + (i * 2) % 8)
                    if c.closed_at:
                        c.closed_at = c.created_at + timedelta(days=2)
            await session.commit()

    async def _phase(self, name: str, fn: Any) -> None:
        """Run one phase unless an earlier start already finished it; record completion."""
        async with async_session_factory() as session:
            if await session.get(DemoSeedState, name):
                log.info("demo seed: phase %s already done", name)
                return
        await fn()
        async with async_session_factory() as session:
            session.add(DemoSeedState(name=name))
            await session.commit()

    async def _runs_phase(self) -> None:
        await self.make_runs()

    async def _finish_phase(self) -> None:
        await self.backdate_misc()
        # Make the dashboards pick everything up now instead of at the next 5-minute refresh.
        await self.call("admin", "POST", "/pulse/refresh")

    async def run(self) -> None:
        await self.load_reference()
        await self._phase("runs", self._runs_phase)
        await self._phase("workforce", self.make_workforce)
        await self._phase("issues_safety", self.make_issues_and_safety)
        await self._phase("messages", self.make_messages)
        await self._phase("work_orders", self.make_work_orders)
        await self._phase("documents", self.make_documents)
        await self._phase("finish", self._finish_phase)


async def demo_seed_finished() -> bool:
    async with async_session_factory() as session:
        return await session.get(DemoSeedState, "finish") is not None


async def run_demo_seed(client: httpx.AsyncClient) -> int | None:
    """Idempotent and resumable. Returns the number of failed API calls, or None if nothing was left to do."""
    if await demo_seed_finished():
        log.info("demo seed: already complete, skipping")
        return None
    started = datetime.now()
    demo = Demo(client)
    await demo.run()
    log.info("demo seed: finished in %.0fs (%s failed calls)", (datetime.now() - started).total_seconds(), demo.failures)
    return demo.failures


async def seed_demo_activity_in_background(app: Any) -> None:
    """Entry point used at startup: drive the app's own API in-process, then finish."""
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://demo-seed/api/v1", timeout=120) as client:
            await run_demo_seed(client)
    except Exception:
        log.exception("demo seed failed (the app keeps running)")
