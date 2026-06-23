# Logbook — Login & Access Reference

Development seed credentials for the Chandan Steel SMS demo environment. **Do not use these passwords in production.**

## Application URLs

| Service | URL |
|---------|-----|
| Frontend (login) | http://localhost:5173/login |
| Shift dashboard | http://localhost:5173/shift |
| Heat workspace | http://localhost:5173/heat/:runId |
| Run report (read-only) | http://localhost:5173/reports/:runId |
| Admin portal (super admin) | http://localhost:5173/admin |
| Executive overview (CEO) | http://localhost:5173/executive |
| Employees (CEO) | http://localhost:5173/executive/employees |
| Department overview (HoD) | http://localhost:5173/hod |
| Operations activity (supervisor) | http://localhost:5173/supervisor |
| Maintenance queue | http://localhost:5173/maintenance |
| Messages & alerts | http://localhost:5173/messages |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |

Start the app with `start.bat` (or `scripts/start.ps1`).

## Organisation structure (Chandan Steel)

**Plant:** Chandan Steels (`CS`)

| Dept code | Department | Notes |
|-----------|------------|-------|
| `SMS` | Steel Melting Shop | IAF, AOD, CCM log sheets (seeded) |
| `ROLLING` | Rolling Mill | **F/PRD/05** shift production report |
| `WIRE` | Wire Division | **F/PRD/06** furnace, **F/PRD/07** wire drawing |
| `BBD` | Bright Bar Division | **F51 PR 39/005/01-13** production register (daily); peeling planned |
| `FORGE` | Forge Shop | **F/PRD/08** grinding material details (daily, planned) |

All five departments sit under the single Chandan Steels plant. Demo users below are scoped to SMS unless noted.

See [docs/MANUFACTURING_HIERARCHY.md](docs/MANUFACTURING_HIERARCHY.md) for the full process and template matrix.

## Seed users

| Role | Full name | Email | Password | Scope |
|------|-----------|-------|----------|-------|
| Super Admin | System Admin | `admin@logbook.app` | `admin123` | Platform-wide |
| CEO | Chandan CEO | `ceo@chandansteel.com` | `ceo123` | Chandan Steel — all departments |
| HoD | SMS Head of Department | `hod@chandansteel.com` | `hod123` | SMS department (all processes) |
| Supervisor (IAF) | IAF Shift Incharge | `iaf.supervisor@chandansteel.com` | `iaf123` | SMS — IAF log sheet only |
| Supervisor (AOD) | AOD Shift Incharge | `aod.supervisor@chandansteel.com` | `aod123` | SMS — AOD log sheet only |
| Supervisor (CCM) | CCM Shift Incharge | `ccm.supervisor@chandansteel.com` | `ccm123` | SMS — CCM log sheet only |
| Supervisor (legacy) | SMS Supervisor | `supervisor@chandansteel.com` | `supervisor123` | SMS — IAF (migrated) |
| Worker | Plant Melter | `melter@chandansteel.com` | `worker123` | SMS department — own runs |
| Maintenance (Quality) | Quality Maintenance | `maint.quality@chandansteel.com` | `maint123` | Quality issues |
| Maintenance (Safety) | Safety Maintenance | `maint.safety@chandansteel.com` | `maint123` | Safety issues |
| Maintenance (Energy) | Energy Maintenance | `maint.energy@chandansteel.com` | `maint123` | Energy issues |
| Maintenance (Equipment) | Equipment Maintenance | `maint.equipment@chandansteel.com` | `maint123` | Equipment issues |
| Maintenance (Process) | Process Maintenance | `maint.process@chandansteel.com` | `maint123` | Process issues |
| HoD (Rolling Mill) | Rolling Mill HoD | `hod.rolling@chandansteel.com` | `hod123` | Rolling Mill department |
| Supervisor (Rolling Mill) | Rolling Mill Shift Incharge | `supervisor.rolling@chandansteel.com` | `rolling123` | RMILL shift report |
| Worker (Rolling Mill) | Rolling Mill Operator | `worker.rolling@chandansteel.com` | `rolling123` | RMILL shift entry |
| HoD (Wire Division) | Wire Division HoD | `hod.wire@chandansteel.com` | `hod123` | Wire Division department |
| Supervisor (Wire) | Wire Division Shift Incharge | `supervisor.wire@chandansteel.com` | `wire123` | WFURN / WDRAW shift reports |
| Worker (Wire) | Wire Division Operator | `worker.wire@chandansteel.com` | `wire123` | WFURN / WDRAW shift entry |
| HoD (Bright Bar) | Bright Bar Division HoD | `hod.bbd@chandansteel.com` | `hod123` | Bright Bar Division department |
| Supervisor (Bright Bar) | Bright Bar Shift Incharge | `supervisor.bbd@chandansteel.com` | `bbd123` | BBAR daily register |
| Worker (Bright Bar) | Bright Bar Production Clerk | `worker.bbd@chandansteel.com` | `bbd123` | BBAR daily entry |
| HoD (Forge Shop) | Forge Shop HoD | `hod.forge@chandansteel.com` | `hod123` | Forge Shop department (planned) |
| Supervisor (Forge) | Forge Shop Shift Incharge | `supervisor.forge@chandansteel.com` | `forge123` | GRIND daily register (planned) |
| Worker (Forge) | Grinding Operator | `worker.forge@chandansteel.com` | `forge123` | GRIND daily entry (planned) |

### Rolling Mill delay codes (F/PRD/05)

Configurable per plant via `GET /api/v1/delay-codes`. Default codes: EL, MC, HP, OP, OT, SC, AG, SS, QC, RS, GS, RM, PC. Delay register rows sync to **Delay Event** records and can spawn observations / corrective actions when assigned.

### Wire Furnace coil traceability (F/PRD/06)

Process **WFURN** under Wire Division. Input coil rows upsert into the `coils` master on save (`GET /api/v1/coils?plant_id=&run_id=` for picker). Furnace output rows link to input coils via `coil_ref`; saving output marks the coil **completed**.

### Wire Drawing coil lifecycle (F/PRD/07)

Process **WDRAW** (dry machine `WD-01`, wet machine `WD-02`). Drawing inlet picker uses `GET /api/v1/coils?purpose=drawing` (coils with status **completed** after annealing). Saving **output material** marks the inlet coil **consumed** and registers a new finish coil with `parent_coil_id` for full traceability back to heat.

### Bright Bar production register (F51 PR 39/005/01-13)

Process **BBAR** under Bright Bar Division. **Daily** run type (no shift binding). Finished-goods output register: grade, heat, sizes, coil count/weight, auto-calculated total weight, and customer picker (`GET /api/v1/customers`). Register **No** uses the process run number. **Peeling** is planned under BBD; grinding is **not** part of Bright Bar.

### Forge Shop grinding register (F/PRD/08, planned)

Process **GRIND** under Forge Shop. **Grinding Material Details (Work Centre Wise)** — daily register for work-centre grinding jobs on forged products (product, dimensions, grade, heat, quantities, manpower, contractor). Header: work centre + date. Not a shift workflow. Stakeholders confirmed this sheet belongs to Forge Shop, not Bright Bar Division.

### Login API

```http
POST http://localhost:8000/api/v1/auth/login
Content-Type: application/json

{
  "email": "ceo@chandansteel.com",
  "password": "ceo123"
}
```

## What each role sees

| Role | Default landing | Highlights |
|------|-----------------|------------|
| **Super Admin** | `/admin` | Full platform administration. Unchanged from before. |
| **CEO** | `/executive` | Org-wide overview, employee management (assign HoD / supervisor / worker / maintenance), broadcast messages. |
| **HoD** | `/hod` | All processes in their department — runs, observations, reports. |
| **Supervisor** | `/supervisor` | Single process/log sheet scope (IAF, AOD, or CCM). |
| **Worker** | `/shift` | Shift dashboard, My Runs, own heats only. |
| **Maintenance** | `/maintenance` | Category-scoped issue queue (assign, close with audit). |

All roles have **Messages & Alerts** in the sidebar (including maintenance issue notifications).

## Admin account overrides

The super admin email and password can be changed before first seed via environment variables (see `.env.example`):

| Variable | Default |
|----------|---------|
| `SEED_ADMIN_EMAIL` | `admin@logbook.app` |
| `SEED_ADMIN_PASSWORD` | `admin123` |
| `SEED_ADMIN_NAME` | `System Admin` |

CEO and org-role users are created by `seed_org_roles.py` on startup (idempotent). The CEO can also manage employees at **Executive → Employees**.

## Database (local dev)

| Setting | Default |
|---------|---------|
| Host | `localhost` |
| Port | `5433` (WSL Docker) or `5432` (local install) |
| Database | `moi_platform` |
| User | `postgres` |
| Password | `postgres` |

Connection string example:

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/moi_platform
```
