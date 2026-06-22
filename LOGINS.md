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
