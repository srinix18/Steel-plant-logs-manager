# Logbook — Login & Access Reference

Development seed credentials for the Chandan Steel SMS demo environment. **Do not use these passwords in production.**

## Application URLs

| Service | URL |
|---------|-----|
| Frontend (login) | http://localhost:5173/login |
| Shift dashboard | http://localhost:5173/shift |
| Heat workspace | http://localhost:5173/heat/:runId |
| Run report (read-only) | http://localhost:5173/reports/:runId |
| Admin portal | http://localhost:5173/admin |
| Operations activity (supervisor) | http://localhost:5173/supervisor |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |

Start the app with `start.bat` (or `scripts/start.ps1`).

## Seed users

| Role | Full name | Email | Password | Organisation / scope |
|------|-----------|-------|----------|----------------------|
| Super Admin | System Admin | `admin@logbook.app` | `admin123` | Chandan Steel Ltd. — all orgs, plants, departments |
| Supervisor | SMS Supervisor | `supervisor@chandansteel.com` | `supervisor123` | Chandan Steel SMS department (plant-scoped activity) |
| Worker | Plant Melter | `melter@chandansteel.com` | `worker123` | Chandan Steel SMS department |

### Login API

```http
POST http://localhost:8000/api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@logbook.app",
  "password": "admin123"
}
```

## What each role sees

| Role | Default landing | Sidebar highlights |
|------|-----------------|-------------------|
| **Super Admin** | `/admin` | Administration (orgs, departments, activity, users). No Shift Dashboard. Operations Activity for scoped monitoring. Activity runs open **read-only reports** at `/reports/:runId`. |
| **Supervisor** | `/supervisor` | Operations Activity (runs in their plant/dept only), Shift Dashboard, run reports with **Open workspace** for approvals/edits. |
| **Worker** | `/shift` | Shift Dashboard → start/open heats on IAF #1–#3, fill log sheets in Heat Workspace. |

## Admin account overrides

The super admin email and password can be changed before first seed via environment variables (see `.env.example`):

| Variable | Default |
|----------|---------|
| `SEED_ADMIN_EMAIL` | `admin@logbook.app` |
| `SEED_ADMIN_PASSWORD` | `admin123` |
| `SEED_ADMIN_NAME` | `System Admin` |

Supervisor and worker credentials are fixed in `backend/app/utils/seed_moi.py` unless you change the seed or create users in **Admin → Users**.

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
