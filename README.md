# MOI Platform — Manufacturing Operations Intelligence

A full-stack platform for **steel plant operations**: digital logbooks, shift/heat/daily process runs, workflows, observations, maintenance, workforce, finance, plant pulse, and safety. The demo is configured for **Chandan Steel** (`CS`) with SMS melting, rolling mill, wire, bright bar, and forge shop processes.

| Client | Stack | Role |
|--------|-------|------|
| **Web** (`frontend/`) | React 18 + Vite + Tailwind | Desktop / tablet density — **full product today** |
| **Mobile** (`mobile/`) | Expo SDK 54 + React Native | Phone-native full parity — **in progress** (Plan 2) |
| **API** (`backend/`) | FastAPI `/api/v1` + PostgreSQL | Shared backend for both clients |

**How to use everything:** [docs/PLATFORM_USER_GUIDE.md](docs/PLATFORM_USER_GUIDE.md) · **Logins:** [LOGINS.md](LOGINS.md) · **Hierarchy:** [docs/MANUFACTURING_HIERARCHY.md](docs/MANUFACTURING_HIERARCHY.md) · **Mobile plan:** [docs/MOBILE_APP_MASTER_PLAN.md](docs/MOBILE_APP_MASTER_PLAN.md)

---

## What the website can do (full capability)

Plant staff replace paper log sheets with structured, role-scoped digital forms tied to assets and workflows. A supervisor starts a **process run** (heat, shift, cast, daily register); workers fill sections; the system tracks state transitions, delays, coil traceability, maintenance escalations, attendance, and cost.

### Production & shop floor

| Capability | What you get |
|------------|--------------|
| **Digital logbooks** | Seeded templates for **IAF, AOD, CCM, RMILL, WFURN, WDRAW, BBAR, GRIND** — fields, tables, chemistry, blow matrix, production/delay registers, formulas, signatures |
| **Shift dashboard** | Start runs only for your department/process; instance + shift + grade where required |
| **Heat / run workspace** | Tabbed live entry; **IAF guided workflow** (actions only on the owning tab); save per section; remarks threads |
| **My Runs** | Active and historical runs for the signed-in user |
| **Run reports** | Read-only report view with maintenance history linkage |
| **Supervisor monitor** | Active runs, observations, raise maintenance (department-scoped) |
| **HoD / executive** | Department or org-wide dashboards and run visibility |

### Plant pulse, safety & energy

| Capability | What you get |
|------------|--------------|
| **Plant / department pulse** | Live operational snapshot for CEO / HoD tiers |
| **Asset workspace & pulse** | Per-asset workspace, QR/pulse views |
| **Safety** | Scan, dashboard, inspections, SOPs, incidents |
| **Energy dashboard** | Energy KPIs by plant/assets (CEO tier) |
| **Inventory pulse** | Inventory pulse view (CEO tier) |

### Maintenance

| Capability | What you get |
|------------|--------------|
| **Reactive issues** | Category queue (quality, safety, equipment, …) with assign/close audit; department scope |
| **Preventive (PM)** | Programs, triggers (calendar / heat count / manual), work orders, checklist execution, dashboard KPIs, **Run PM evaluate** |

### Workforce (HR)

| Capability | What you get |
|------------|--------------|
| Employees & contractors | Org/dept scoped employee records |
| Shift assignments & planning | Roster and planning screens |
| Attendance | Daily entry by department/shift; contractor sections |
| Leave, skills, training | Request/approve leave; skill matrix; training |
| Payroll & salary structures | Monthly payroll process; payslip views for workers |
| Handover notes | Shift handover (write roles) |
| **Import engine** | Bulk employee import (Excel) |

### Finance, foundation & admin

| Capability | What you get |
|------------|--------------|
| **Finance** | Cost masters, template mappings, per-run cost sheets, department/process/asset drill-down |
| **Foundation** | Assets, masters, observations, corrective actions, documents, analytics |
| **Messages** | In-app mail with `@all`, `@DEPT_CODE`, name search; HR ↔ org messaging |
| **Admin** | Organisations, plants, departments, log sheet templates, users, activity |

### Demo plant: Chandan Steels

| Dept | Processes | Doc reference |
|------|-----------|---------------|
| SMS | IAF, AOD, CCM | F/PRD/02–04 |
| Rolling | RMILL | F/PRD/05 (delay codes, hourly production) |
| Wire | WFURN, WDRAW | F/PRD/06–07 (coil traceability) |
| Bright Bar | BBAR | F51 PR 39/005/01-13 (daily register) |
| Forge | GRIND | F/PRD/08 (daily grinding register) |

Also seeded: **QUAL**, **MAINT**, **UTIL** for workforce grouping. Backend startup seeds templates, workflows, demo users, PM samples, and workforce data (idempotent).

---

## Mobile app — current progress

**Goal:** Same JWT API and **full feature parity** with the web app on Android phones (Expo Go now; EAS APK later). Source of truth: [`docs/MOBILE_APP_MASTER_PLAN.md`](docs/MOBILE_APP_MASTER_PLAN.md) · How to run: [`mobile/README.md`](mobile/README.md)

### Status snapshot (July 2026)

| Plan | Scope | Status |
|------|--------|--------|
| **Plan 1** | Expo foundation — login, SecureStore session, role homes, drawer, design system, profile | **Complete** |
| **Plan 2** | Shared run engine + every seeded log sheet + reports | **In progress** |
| **Plan 3** | Ops / safety / maintenance / messages | Not started |
| **Plan 4** | Full workforce parity | Not started |
| **Plan 5** | Pulse, foundation, finance, admin, executive | Not started |
| **Plan 6** | Hardening — EAS APK, offline drafts, device QA | Not started |

### Plan 2 detail

| Chunk | Status | What it delivers |
|-------|--------|------------------|
| `P2-ENGINE-01` Run host | **Done** | `/(app)/heat/[runId]` — load/save fields & sections, workflow, remarks, wake lock |
| `P2-ENGINE-02` Card steps | **Done** | Chronological cards (list + item) for chemistry, blows, samples, production rows |
| `P2-ENGINE-03` Section adapters | **Done** | All section types + complex cell editors (parity map) |
| `P2-ENGINE-04` Shift launcher | **Done** | `/(app)/shift` — start IAF/AOD/CCM/RMILL/… → navigate to run host |
| `P2-SMS-IAF` | **Done** | Full IAF heat lifecycle; grade/user/asset pickers; formulas; workflow stepper |
| `P2-SMS-AOD` | **Done** | All 13 AOD sections; blow cards (16 cols); sample temperature; gas auto from blow |
| `P2-SMS-CCM` | **Done** | Casting entries with mould_tube / time_range / zone_strand; datetime strand pairs |
| `P2-ROLLING-RMILL` | **Done** | Delay codes + heat lookup; batches; all 12 hourly cards |
| `P2-WIRE-WFURN` | **Done** | Input coils upsert; furnace `coil_ref` picker from `/coils` |
| `P2-WIRE-WDRAW` | **Done** | Dual `inlet_coil_ref`; condition/lubricant seed options |
| `P2-BBD-BBAR` | **Done** | Customer picker; `total_weight_kg` = weight×count |
| `P2-BBD-PEEL` | **Done** | Blocked stub: “Peeling not digitized yet.” |
| `P2-FORGE-GRIND` | **Done** | Header work_centre + date; engine-ready for future jobs |
| `P2-DEPT-SHELLS` | **Done** | QUAL/MAINT/UTIL browse; no fake log hosts |
| `P2-REPORTS` | **Done** | Read-only report + Share HTML; My Runs deep link |
| `P3-*` … `P6-*` | Specced (v2.1) | Full Acceptance in master plan Parts E–F |

**On phone today:** login → Shift → start **IAF / AOD / CCM / RMILL / WFURN / WDRAW / BBAR / GRIND** → fill cards → Save / workflow. Peeling shows blocked stub. Other modules appear in the drawer as placeholders until Plans 3–5.

**Phone smoke accounts:** melter `melter@chandansteel.com` / `worker123` · AOD `aod.supervisor@chandansteel.com` / `aod123` · CCM `ccm.supervisor@chandansteel.com` / `ccm123` · Rolling `worker.rolling@chandansteel.com` / `rolling123` · Wire `worker.wire@chandansteel.com` / `wire123` · Bright Bar `worker.bbd@chandansteel.com` / `bbd123` · Forge `worker.forge@chandansteel.com` / `forge123`

```powershell
cd mobile
copy .env.example .env   # set EXPO_PUBLIC_API_URL to LAN IP (not localhost)
.\start.ps1              # Expo Go SDK 54
```

LAN helper: `powershell -File scripts/print-lan-ip.ps1`

---

## Architecture

```mermaid
flowchart LR
  subgraph clients [Clients]
    Web[Web React/Vite]
    Mob[Mobile Expo SDK 54]
  end
  subgraph api [Backend FastAPI]
    Auth[JWT Auth]
    Runs[Process Runs]
    WF[Workflows]
    WFm[Workforce]
    Fin[Finance]
    PM[Maintenance PM]
    Msg[Messages]
    Maint[Maintenance Issues]
    Pulse[Pulse Safety Energy]
  end
  subgraph data [PostgreSQL]
    DB[(moi_platform)]
  end
  Web --> Auth
  Mob --> Auth
  Web --> Runs
  Mob --> Runs
  api --> DB
```

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, SQLAlchemy 2.0 (async), PostgreSQL 16, asyncpg, Pydantic v2 |
| Web | React 18, TypeScript, Vite, TailwindCSS, React Router |
| Mobile | Expo SDK **54**, Expo Router, SecureStore (`moi_access_token` / `moi_user`) |
| Auth | JWT bearer tokens (same for web and mobile) |
| Real-time | WebSocket streams for plant/run events (web) |
| API prefix | `/api/v1` — Swagger at http://localhost:8000/docs |

---

## Core concepts

### Organisational hierarchy

```
Organisation → Plant → Department → Process → Process Instance (asset/line) → Process Run
```

- **Process** — e.g. `IAF`, `RMILL`, `BBAR`, `GRIND` (department-scoped).
- **Process instance** — a specific furnace, mill line, or work centre (`IAF #1`, `Mill Line`, etc.).
- **Template / TemplateVersion** — the log sheet definition (sections, fields, tables, formulas). Published versions are immutable.
- **Workflow** — states and transitions (`created` → `in_progress` → `completed` → …) with role-gated actions.
- **Process run** — one execution of a log sheet on an instance (a heat, shift report, or daily register). Identified by `run_number` (e.g. `H-20260624-0001`).

### Run types

| Run type | Typical use | Shift required? |
|----------|-------------|-----------------|
| `heat` | IAF furnace heat | Yes |
| `ladle_metallurgy` | AOD vessel run | Yes |
| `cast` | Concast shift log | Yes |
| `shift` | Rolling mill, wire production | Yes |
| `daily` | Bright bar register, forge grinding | No (date-based) |

Users may only **start runs** for processes in their department (enforced on API and shift dashboard). CEO/platform admin are org-wide exceptions.

### Access control

Roles are enforced in `backend/app/services/access_scope.py` and mirrored in `frontend/src/utils/roles.ts` / `mobile/src/auth/`.

| Role | Focus |
|------|--------|
| **Super Admin** | Platform setup: orgs, departments, templates, users |
| **CEO** | Executive overview, pulse, org-wide visibility, broadcast messages |
| **HR** | Workforce: employees, shift assignments, attendance, contractors, org messaging |
| **HoD** | Department overview / pulse, employees (dept), view handover |
| **Supervisor** | One process (or dept), shift dashboard, handover notes, maintenance raising, finance view |
| **Worker** | Shift dashboard, own runs, my attendance, my leave, my payslips |
| **Maintenance** | Issue queue by category (department-scoped visibility) |
| **Maintenance manager / CEO** | PM programs, work orders, maintenance dashboard |

---

## Quick start (Windows)

### Prerequisites

- Python 3.11+
- Node.js 18+ (web); Node **22 LTS** recommended for mobile (`nvm use 22.14.0`)
- PostgreSQL 16 (Docker via `postgres.bat` / `docker compose`, or local install)

### One-command start (web + API)

```bat
start.bat
```

This script (via `scripts/start.ps1`):

1. Runs first-time setup if needed (`scripts/setup.ps1`)
2. Ensures PostgreSQL is running (skips if port already open)
3. **Restarts the backend** on port 8000
4. Starts or reuses the frontend on port 5173

Stop everything with `stop.bat`. Start only Postgres with `postgres.bat`.

### Manual setup

```powershell
# 1. Environment
copy .env.example .env
copy backend\.env.example backend\.env
# Edit DATABASE_URL if not using port 5433

# 2. Postgres (Docker)
docker compose up postgres -d

# 3. Backend (bind 0.0.0.0 for phone testing)
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
.\venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 4. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173/login**

### Default credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@logbook.app` | `admin123` |
| CEO | `ceo@chandansteel.com` | `ceo123` |
| HR | `hr@chandansteel.com` | `hr123` |
| SMS HoD | `hod@chandansteel.com` | `hod123` |
| IAF Supervisor | `iaf.supervisor@chandansteel.com` | `iaf123` |
| Melter (worker) | `melter@chandansteel.com` | `worker123` |
| AOD Supervisor | `aod.supervisor@chandansteel.com` | `aod123` |

Full user list (rolling, wire, BBD, forge, maintenance crews): **[LOGINS.md](LOGINS.md)**

---

## Frontend routes (by area)

| Path | Who | What |
|------|-----|------|
| `/admin/*` | Super Admin | Platform administration |
| `/executive` | CEO | Plant overview, open maintenance |
| `/pulse/plant` | CEO tier | Plant pulse |
| `/pulse/department` | HoD tier | Department pulse |
| `/energy` | CEO tier | Energy dashboard |
| `/inventory-pulse` | CEO tier | Inventory pulse |
| `/assets/:id/workspace` | Ops roles | Asset workspace |
| `/safety/*` | Floor / maintenance | Scan, dashboard, inspections, SOPs, incidents |
| `/hod` | HoD | Department dashboard |
| `/supervisor` | Supervisor+ | Active runs, observations |
| `/shift` | Supervisor, Worker | Start runs (dept-scoped) |
| `/heat/:runId` | Run participants | Live log sheet workspace (IAF: guided tab workflow) |
| `/reports/:runId` | Readers | Read-only report |
| `/my-runs` | Supervisor, Worker | Own active/historical runs |
| `/maintenance` | Maintenance crew | Reactive issue queue |
| `/maintenance/dashboard` | PM viewers | PM KPIs, **Run PM evaluate** |
| `/maintenance/programs` | Maintenance manager, CEO | PM program wizard |
| `/maintenance/work-orders` | PM viewers | Work order queue |
| `/foundation/*` | HoD, supervisors, CEO | Assets, masters, observations, corrective actions |
| `/finance/*` | CEO, HoD, supervisor | Cost dashboard, masters, mappings, run cost sheets |
| `/workforce/*` | HR, HoD, CEO (varies) | Dashboard, employees, attendance, leave, payroll, etc. |
| `/messages` | All authenticated | In-app mail and system alerts |
| `/profile` | All | User profile |

---

## API overview

Base URL: `http://localhost:8000/api/v1`

| Area | Examples |
|------|----------|
| Auth | `POST /auth/login`, `GET /auth/me` |
| Platform | `/plants`, `/departments`, `/processes`, `/process-instances`, `/assets`, `/shifts` |
| Templates | `/templates/{id}`, `/templates/versions/{id}` |
| Process runs | `POST /process-instances/{id}/runs`, `GET /process-runs/{id}`, transitions, field values |
| Operations | `/observations`, `/corrective-actions`, `/delay-events`, `/delay-codes` |
| Rolling / Wire / Bright Bar | `/rolling-mill/*`, `/wire/*`, `/bright-bar/*` |
| Maintenance (issues) | `/maintenance/issues`, assign, close |
| Maintenance (PM) | `/maintenance/pm/programs`, `/maintenance/pm/evaluate`, `/maintenance/pm/work-orders` |
| Finance | `/finance/masters/*`, `/finance/mappings`, `/finance/runs/{id}/cost-sheet` |
| Foundation | `/foundation/assets`, `/foundation/observations`, `/foundation/corrective-actions` |
| Workforce | `/workforce/employees`, `/shift-assignments`, `/attendance`, `/workforce/payroll/*` |
| Imports | `/imports/*` (employee bulk upload) |
| Messages | `/messages`, `/notifications` |
| Pulse / Safety / Energy | `/pulse/*`, `/safety/*`, `/energy/*`, `/assets/{id}/workspace` |
| Analytics | `/dashboard`, KPI definitions |
| WebSocket | `/ws/plants/{id}/runs`, `/ws/process-runs/{id}` |

Interactive docs: **http://localhost:8000/docs**

---

## Project structure

```
Log_Project/
├── backend/                 # FastAPI + seeds + SQLAlchemy models
├── frontend/                # Web app (full capability)
├── mobile/                  # Expo phone app (parity in progress)
│   ├── app/                 # Expo Router screens
│   ├── src/                 # api, auth, features/run-host, shift, ui
│   ├── scripts/smoke.ps1
│   └── README.md
├── docs/
│   ├── PLATFORM_USER_GUIDE.md
│   ├── MANUFACTURING_HIERARCHY.md
│   ├── MOBILE_APP_MASTER_PLAN.md   # Chunk-by-chunk mobile build
│   └── MOBILE_P1_*.md
├── scripts/                 # start.ps1, setup.ps1, print-lan-ip.ps1
├── LOGINS.md
├── start.bat / stop.bat
└── docker-compose.yml
```

---

## Typical user flows (web)

### Start a heat (SMS worker/supervisor)

1. Log in → **Shift Dashboard** (`/shift`)
2. Select process (only your department’s processes appear)
3. Pick furnace instance, shift, grade → **Start Heat**
4. **Heat workspace** opens — fill each tab and **Save**; IAF shows workflow actions on the relevant tab only

### Run preventive maintenance (CEO / maintenance manager)

1. **Maintenance → PM Programs** — create or edit a program (triggers, tasks, linked asset)
2. Ensure status is **Active**
3. **Run PM evaluate** or **Force evaluate (demo)**
4. **Work Orders** — filter **Draft** → **Assign** → execute checklist

### HR payroll (monthly demo)

1. Log in as `hr@chandansteel.com`
2. **Attendance** — mark present for the month
3. **Salary Structures** — verify pay components
4. **Payroll** → **Create payroll run** → **Process**
5. Workers see **My Payslips**

### Finance cost from a completed heat

1. Complete IAF heat (Charge Mix / Ferro Alloys, tap → approve → close)
2. **Finance → Cost Dashboard** or run cost sheet for that `run_id`

### Raise maintenance (supervisor)

1. **Supervisor** monitor → **Raise maintenance issue**
2. Issue routes by category; visible within department scope

### Compose message with groups

1. **Messages → Compose**
2. Recipient name, or `@all`, or `@SMS` / `@ROLLING`

---

## Database

| Setting | Default (Docker) |
|---------|------------------|
| Host | `localhost` |
| Port | `5433` |
| Database | `moi_platform` |
| User / password | `postgres` / `postgres` |

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/moi_platform
```

Tables are created and patched on startup. Seeds are idempotent — safe to restart the backend.

---

## Development

```powershell
# Frontend production build
cd frontend && npm run build

# Mobile smoke (unit + API if backend up + tsc + Metro export)
cd mobile && .\scripts\smoke.ps1

# Backend DB check
cd backend && .\venv\Scripts\python scripts\test_db.py
```

**Environment variables** (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL async connection string |
| `JWT_SECRET_KEY` | Token signing (change in production) |
| `CORS_ORIGINS` | Allowed frontend / Expo origins |
| `SEED_ADMIN_*` | Override default super-admin seed |
| `VITE_API_URL` | Web API base (default `http://localhost:8000/api/v1`) |
| `EXPO_PUBLIC_API_URL` | Mobile API base — use **LAN IP** on a physical phone |

---

## Further reading

- [docs/PLATFORM_USER_GUIDE.md](docs/PLATFORM_USER_GUIDE.md) — module connections and demo day scripts
- [LOGINS.md](LOGINS.md) — every demo account and permission matrix
- [docs/MANUFACTURING_HIERARCHY.md](docs/MANUFACTURING_HIERARCHY.md) — department/process/template catalogue
- [docs/MOBILE_APP_MASTER_PLAN.md](docs/MOBILE_APP_MASTER_PLAN.md) — mobile chunk plan (Plans 1–6)
- [mobile/README.md](mobile/README.md) — Expo setup, smoke scripts, chunk status
- [ARCHITECTURE.md](ARCHITECTURE.md) — historical / deeper notes (prefer this README for current stack)

---

## License / status

Internal demo / development project for Chandan Steel manufacturing operations.

- **Web:** production-shaped demo — use as the reference for full capability.
- **Mobile:** Plan 1–2 complete; Plan 3 through **P3-MSG-COMPOSE**; Plan 4 complete; Plan 5 foundation complete; finance through **P5-FIN-MAP**; next chunk **P5-FIN-CALC**. Master plan **v2.2**.
- **Do not use seeded passwords in production.**
