# Manufacturing Operations Intelligence Platform

Production-grade platform for steel plant operations — digitizing logbooks, process runs, workflows, events, and corrective actions.

## Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, SQLAlchemy 2.0, PostgreSQL 16, asyncpg |
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| Real-time | WebSocket event streams |

## Hierarchy

```
Organisation → Plant → Department → Process → Process Instance → Template → TemplateVersion → Process Run
```

## Quick Start

### 1. PostgreSQL

```powershell
docker compose up postgres -d
```

Or install PostgreSQL locally and create database `moi_platform`.

### 2. Environment

```powershell
copy .env.example .env
```

Set `DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/moi_platform`

### 3. Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
.\venv\Scripts\uvicorn app.main:app --reload --port 8000
```

On first start, tables are created and **Chandan Steel SMS** seed data is loaded:
- EAF Process with **EAF #1, #2, #3**
- Furnace Log Sheet **F/PRD/02 Rev 02** (published) + Rev 03 (draft)
- SMS Heat workflow, materials, grades, telemetry bindings, KPI definitions
- Additional processes: LF, CCM, Rolling Mill, QC, Maintenance

### 4. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Seed Users

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@logbook.app | admin123 |
| Supervisor | supervisor@chandansteel.com | supervisor123 |
| Worker | melter@chandansteel.com | worker123 |

## Key API Endpoints

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/login`, `GET /auth/me` |
| Platform | `/plants`, `/processes`, `/process-instances`, `/assets` |
| Templates | `/templates/{id}`, `/templates/versions/{id}` |
| Process Runs | `POST /process-instances/{id}/runs`, `/process-runs/{id}/transitions` |
| Operations | `/observations`, `/corrective-actions`, `/integrations/events` |
| Analytics | `/dashboard`, `/kpis/definitions`, `/assets/{id}/health` |
| WebSocket | `/ws/plants/{id}/runs`, `/ws/process-runs/{id}` |

API docs: http://localhost:8000/docs

## Worker UX

- **Shift Dashboard** (`/shift`) — start heats on EAF #1–#3
- **Heat Workspace** (`/heat/:id`) — tablet-first section tabs, workflow actions, event stream
- **Supervisor Monitor** (`/supervisor`) — active heats, observations, corrective actions
