# Dynamic Logbook Management System

A production-quality MVP for creating customizable logbook templates, collecting structured form data, and enforcing role-based access control.

## Features

- **Dynamic forms** — Admin-defined templates with configurable field types (text, number, email, date, boolean, dropdown, textarea)
- **Role-based access** — Admin, Department, and Member roles with scoped permissions
- **Normalized data model** — MongoDB collections mirroring relational tables for future ML/analytics
- **JWT authentication** — Secure login with protected API routes
- **Dashboard metrics** — Users, departments, templates, and records counts
- **CSV export** — Admin and department users can export records

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full design documentation including database schema, API contracts, and folder structure.

## Quick Start (Windows — no Docker)

Docker is **optional**. Use these scripts on Windows instead:

### 1. One-time setup

```powershell
.\scripts\setup.ps1
```

Or double-click **`setup.bat`**

This installs Python/Node dependencies and creates `.env` files.

### 2. Install MongoDB (one-time, if not installed)

```powershell
.\scripts\install-mongodb.ps1
```

Or manually:

```powershell
winget install MongoDB.Server
net start MongoDB
```

### 3. Start the app

```powershell
.\scripts\start.ps1
```

Or double-click **`start.bat`**

This opens two terminal windows (backend + frontend).

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:5173        |
| Backend   | http://localhost:8000        |
| API Docs  | http://localhost:8000/docs   |

**Default admin:** `admin@logbook.app` / `admin123`

### Prerequisites

| Tool     | Install                                      |
|----------|----------------------------------------------|
| Python 3.12+ | https://www.python.org/downloads/          |
| Node.js 20+  | https://nodejs.org/                        |
| MongoDB 7+   | `.\scripts\install-mongodb.ps1` or winget |

## Quick Start (Docker — optional)

Only if you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed:

```bash
cp .env.example .env
docker compose up --build
```

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:3000        |
| Backend   | http://localhost:8000        |

## Manual Local Development

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy ..\.env.example .env
.\venv\Scripts\uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
echo VITE_API_URL=http://localhost:8000/api/v1 > .env
npm run dev
```

Open http://localhost:5173

## User Roles

| Role       | Capabilities                                              |
|-----------|-----------------------------------------------------------|
| Admin     | Full system management, all records, export, dashboard    |
| Department| Department-scoped records, reports, export                |
| Member    | View assigned templates, create/submit records, own view  |

## API Overview

Base URL: `http://localhost:8000/api/v1`

| Group        | Endpoints                                      |
|-------------|------------------------------------------------|
| Auth        | `POST /auth/login`, `GET /auth/me`             |
| Users       | `GET/POST /users`, `GET/PUT/DELETE /users/{id}`|
| Departments | `GET/POST /departments`, ...                   |
| Templates   | `GET/POST /templates`, field CRUD              |
| Records     | `GET/POST /records`, `GET /records/export`     |
| Dashboard   | `GET /dashboard`                               |

Interactive docs: http://localhost:8000/docs

## Project Structure

```
Log_Project/
├── ARCHITECTURE.md
├── start.bat              # Double-click to start (Windows)
├── setup.bat              # Double-click to set up (Windows)
├── scripts/
│   ├── setup.ps1          # Install dependencies
│   ├── start.ps1          # Start backend + frontend
│   └── install-mongodb.ps1
├── docker-compose.yml     # Optional (requires Docker Desktop)
├── backend/
└── frontend/
```

## Environment Variables

| Variable              | Description                    | Default                    |
|----------------------|--------------------------------|----------------------------|
| MONGODB_URL          | MongoDB connection string      | mongodb://localhost:27017  |
| MONGODB_DB_NAME      | Database name                  | logbook_db                 |
| JWT_SECRET_KEY       | JWT signing secret             | (change in production)     |
| CORS_ORIGINS         | Allowed frontend origins       | localhost:5173,3000        |
| VITE_API_URL         | Backend API URL (frontend)     | http://localhost:8000/api/v1|
| SEED_ADMIN_EMAIL     | Initial admin email            | admin@logbook.app        |
| SEED_ADMIN_PASSWORD  | Initial admin password         | admin123                   |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `docker is not recognized` | Use `.\scripts\start.ps1` instead — Docker is not required |
| `MongoDB is not running` | Run `.\scripts\install-mongodb.ps1` then `net start MongoDB` |
| Backend won't start | Ensure MongoDB is on port 27017, then restart `.\scripts\start.ps1` |
| Frontend can't reach API | Check `frontend/.env` has `VITE_API_URL=http://localhost:8000/api/v1` |

## Future Extensions

The architecture supports adding:

- Analytics dashboards
- Advanced reporting
- CSV import
- ML prediction engine (via `record_values.field_name`)
- Audit logs
- Notifications

## License

MIT
