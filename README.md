# MOI Platform — Manufacturing Operations Intelligence

A full-stack platform for **steel plant operations**: digital logbooks, shift/heat/daily process runs, workflows, observations, maintenance issues, workforce management, and executive dashboards. The demo is configured for **Chandan Steel** (`CS`) with SMS melting, rolling mill, wire, bright bar, and forge shop processes.

---

## What this app does

Plant staff replace paper log sheets with structured, role-scoped digital forms tied to assets and workflows. A supervisor starts a **process run** (heat, shift, cast, daily register); workers fill sections on tablet-friendly screens; the system tracks state transitions, delays, coil traceability, maintenance escalations, and attendance.

| Module | Purpose |
|--------|---------|
| **Production logbooks** | IAF, AOD, CCM, rolling mill, wire furnace/drawing, bright bar, forge grinding — each mapped to a published template and workflow |
| **Shift dashboard** | Supervisors and workers start runs only for their department/process |
| **Heat workspace** | Live run entry: tabbed sections, guided IAF workflow (actions on the correct tab), save per section |
| **Supervisor monitor** | Active runs, observations, maintenance issue raising (department-scoped) |
| **Reports** | Read-only run reports with maintenance history |
| **Maintenance (reactive)** | Category-based issue queue (quality, safety, equipment, etc.) with assign/close audit |
| **Maintenance (PM)** | PM programs, triggers (calendar / heat count / manual), work orders, dashboard KPIs |
| **Plant Foundation** | Assets, masters, observations, corrective actions, documents, analytics |
| **Finance** | Cost masters, template mappings, per-run cost sheets, department/process/asset drill-down |
| **Workforce (HR)** | Employees, attendance, shift planning, leave, skills, training, payroll, payslips |
| **Import engine** | Bulk employee import (Excel) from Workforce |
| **Messages** | In-app mail with `@all`, `@DEPT_CODE`, and name search; HR ↔ org messaging |
| **Executive / HoD** | Org-wide or department dashboards, KPIs, run visibility |
| **Admin** | Organisations, plants, departments, log sheet templates, users |

**How to use everything (connections + demo flows):** [docs/PLATFORM_USER_GUIDE.md](docs/PLATFORM_USER_GUIDE.md)  
**Detailed logins, URLs, and permissions:** [LOGINS.md](LOGINS.md)  
**Department / process / template matrix:** [docs/MANUFACTURING_HIERARCHY.md](docs/MANUFACTURING_HIERARCHY.md)

---

## Architecture

```mermaid
flowchart LR
  subgraph client [Frontend React/Vite]
    UI[Role-based UI]
    WS[WebSocket client]
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
  end
  subgraph data [PostgreSQL]
    DB[(moi_platform)]
  end
  UI --> Auth
  UI --> Runs
  UI --> WFm
  WS --> api
  api --> DB
```

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, SQLAlchemy 2.0 (async), PostgreSQL 16, asyncpg, Pydantic v2 |
| Frontend | React 18, TypeScript, Vite, TailwindCSS, React Router |
| Auth | JWT bearer tokens |
| Real-time | WebSocket streams for plant/run events |
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

Roles are enforced in `backend/app/services/access_scope.py` and mirrored in `frontend/src/utils/roles.ts`.

| Role | Focus |
|------|--------|
| **Super Admin** | Platform setup: orgs, departments, templates, users |
| **CEO** | Executive overview, org-wide visibility, broadcast messages |
| **HR** | Workforce: employees, shift assignments, attendance, contractors, org messaging |
| **HoD** | Department overview, employees (dept), view handover; no shift dashboard |
| **Supervisor** | One process (or dept), shift dashboard, handover notes, maintenance raising, finance view |
| **Worker** | Shift dashboard, own runs, my attendance, my leave, my payslips |
| **Maintenance** | Issue queue by category (department-scoped visibility) |
| **Maintenance manager / CEO** | PM programs, work orders, maintenance dashboard |

Department-scoped rules apply to runs, maintenance issues, workforce data, and process lists.

---

## Demo plant: Chandan Steels

Single plant with departments: **SMS**, **ROLLING**, **WIRE**, **BBD**, **FORGE**, plus **QUAL**, **MAINT**, **UTIL** for workforce grouping.

Seeded production processes include:

| Dept | Processes | Doc reference |
|------|-----------|---------------|
| SMS | IAF, AOD, CCM | F/PRD/02–04 |
| Rolling | RMILL | F/PRD/05 (delay codes, hourly production) |
| Wire | WFURN, WDRAW | F/PRD/06–07 (coil traceability) |
| Bright Bar | BBAR | F51 PR 39/005/01-13 (daily register) |
| Forge | GRIND | F/PRD/08 (daily grinding register) |

On backend startup, seeds load templates, workflows, demo users, shift assignments, PM sample program, salary structures, and workforce data (idempotent). PM triggers are evaluated on startup; use **Run PM evaluate** in the UI to generate work orders.

---

## Quick start (Windows)

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 16 (Docker via `postgres.bat` / `docker compose`, or local install)

### One-command start

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

# 3. Backend
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
.\venv\Scripts\uvicorn app.main:app --reload --port 8000

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

Full user list (rolling, wire, BBD, forge, maintenance crews): **[LOGINS.md](LOGINS.md)**

---

## Frontend routes (by area)

| Path | Who | What |
|------|-----|------|
| `/admin/*` | Super Admin | Platform administration |
| `/executive` | CEO | Plant overview, open maintenance |
| `/hod` | HoD | Department dashboard |
| `/supervisor` | Supervisor+ | Active runs, observations |
| `/shift` | Supervisor, Worker | Start runs (dept-scoped) |
| `/heat/:runId` | Run participants | Live log sheet workspace (IAF: guided tab workflow) |
| `/reports/:runId` | Readers | Read-only report |
| `/my-runs` | Supervisor, Worker | Own active/historical runs |
| `/maintenance` | Maintenance crew | Reactive issue queue |
| `/maintenance/dashboard` | PM viewers | PM KPIs, **Run PM evaluate** |
| `/maintenance/programs` | Maintenance manager, CEO | PM program wizard (triggers, tasks, asset) |
| `/maintenance/work-orders` | PM viewers | Work order queue (Draft → Assign → execute) |
| `/foundation/*` | HoD, supervisors, CEO | Assets, masters, observations, corrective actions |
| `/finance/*` | CEO, HoD, supervisor | Cost dashboard, masters, mappings, run cost sheets |
| `/workforce/*` | HR, HoD, CEO (varies) | Dashboard, employees, attendance, leave, payroll, etc. |
| `/workforce/salary-structures` | HR | Pay component setup before payroll runs |
| `/workforce/payroll` | HR | Monthly payroll process |
| `/workforce/my-payslips` | Workers | View payslips after HR processes payroll |
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
| Rolling / Wire / Bright Bar | `/rolling-mill/*`, `/wire/*`, `/bright-bar/*` (domain helpers) |
| Maintenance (issues) | `/maintenance/issues`, assign, close |
| Maintenance (PM) | `/maintenance/pm/programs`, `/maintenance/pm/evaluate`, `/maintenance/pm/work-orders` |
| Finance | `/finance/masters/*`, `/finance/mappings`, `/finance/runs/{id}/cost-sheet`, compute |
| Foundation | `/foundation/assets`, `/foundation/observations`, `/foundation/corrective-actions` |
| Workforce | `/workforce/employees`, `/shift-assignments`, `/attendance`, `/workforce/payroll/*` |
| Imports | `/imports/*` (employee bulk upload) |
| Workforce ops | `/workforce/ops/leave`, `/workforce/ops/payroll`, shift roster, skills, training |
| Messages | `/messages`, `/notifications` |
| Analytics | `/dashboard`, KPI definitions |
| WebSocket | `/ws/plants/{id}/runs`, `/ws/process-runs/{id}` |

Interactive docs: **http://localhost:8000/docs**

---

## Project structure

```
Log_Project/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # REST routers (auth, platform, process_runs, workforce, …)
│   │   ├── db/              # SQLAlchemy models, session, custom types
│   │   ├── services/        # Business logic (runs, workflow, cost engine, PM, payroll, …)
│   │   ├── schemas/         # Pydantic request/response models
│   │   └── utils/           # Seeds + schema patches (IAF, finance, phase4 PM/HR, …)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/           # Route pages (operations, workforce, admin, …)
│       ├── components/      # Log sheet cells, layout, UI primitives
│       ├── api/             # Typed API clients
│       └── utils/           # roles.ts, formulas, message recipients
├── docs/
│   ├── PLATFORM_USER_GUIDE.md   # End-to-end usage, module connections, demo scripts
│   └── MANUFACTURING_HIERARCHY.md
├── scripts/                 # start.ps1, setup.ps1, common.ps1
├── LOGINS.md                # All demo users, URLs, permission matrix
├── start.bat / stop.bat
└── docker-compose.yml       # PostgreSQL service
```

---

## Typical user flows

### Start a heat (SMS worker/supervisor)

1. Log in → **Shift Dashboard** (`/shift`)
2. Select process (only your department’s processes appear)
3. Pick furnace instance, shift, grade → **Start Heat**
4. **Heat workspace** opens — fill each tab and **Save**; IAF shows workflow actions on the relevant tab only (Start Heat → Power On → Sample → … → Close)

### Run preventive maintenance (CEO / maintenance manager)

1. **Maintenance → PM Programs** — create or edit a program (triggers, tasks, linked asset)
2. Ensure status is **Active** (draft programs do not evaluate)
3. **Run PM evaluate** or **Force evaluate (demo)** on Programs or Dashboard
4. **Maintenance → Work Orders** — filter **Draft** → **Assign** → execute checklist tasks

### HR payroll (monthly demo)

1. Log in as `hr@chandansteel.com`
2. **Workforce → Attendance** — mark employees present for the month
3. **Workforce → Salary Structures** — verify or add pay components per employee
4. **Workforce → Payroll** → **Create payroll run** → **Process**
5. Workers see payslips under **My Payslips**

### Finance cost from a completed heat

1. Complete IAF heat (save Charge Mix / Ferro Alloys, tap → approve → close)
2. **Finance → Cost Dashboard** or run cost sheet for that `run_id`
3. Raw material lines use material catalog codes; power from `power_total` field

### HR marks attendance

1. Log in as `hr@chandansteel.com`
2. **Workforce → Attendance** — pick date, department, shift
3. Mark employee status; contractor section shows only vendors linked to that department

### Raise maintenance (supervisor)

1. **Supervisor** monitor → **Raise maintenance issue**
2. Issue routes to maintenance crew by category; visible only within the raising department’s scope

### Compose message with groups

1. **Messages → Compose**
2. Type recipient name, or `@all`, or `@SMS` / `@ROLLING` for department groups
3. HR and CEO can broadcast to the entire organisation

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

Tables are created and patched on startup (`init_db` + `schema_patches.py`). Seeds are idempotent — safe to restart the backend.

---

## Development

```powershell
# Frontend production build
cd frontend && npm run build

# Backend tests / DB check
cd backend && .\venv\Scripts\python scripts\test_db.py
```

**Environment variables** (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL async connection string |
| `JWT_SECRET_KEY` | Token signing (change in production) |
| `CORS_ORIGINS` | Allowed frontend origins |
| `SEED_ADMIN_*` | Override default super-admin seed |
| `VITE_API_URL` | Frontend API base (default `http://localhost:8000/api/v1`) |

---

## Further reading

- [docs/PLATFORM_USER_GUIDE.md](docs/PLATFORM_USER_GUIDE.md) — what connects to what, IAF workflow, PM, finance, HR, end-to-end demo day
- [LOGINS.md](LOGINS.md) — every demo account, route URLs, workforce permission matrix, coil/delay notes
- [docs/MANUFACTURING_HIERARCHY.md](docs/MANUFACTURING_HIERARCHY.md) — department/process/template catalogue and run-type rules
- [ARCHITECTURE.md](ARCHITECTURE.md) — deeper technical architecture

---

## License / status

Internal demo / development project for Chandan Steel manufacturing operations. **Do not use seeded passwords in production.**
