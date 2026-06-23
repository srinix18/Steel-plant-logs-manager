# Dynamic Logbook Management System — Architecture

> **Current platform:** The live codebase is the **Manufacturing Operations Intelligence (MOI)** platform — FastAPI, SQLAlchemy 2.0, PostgreSQL, React. See [README.md](README.md) for stack and quick start. For Chandan Steel department/process/template mapping see [docs/MANUFACTURING_HIERARCHY.md](docs/MANUFACTURING_HIERARCHY.md).

The sections below describe an earlier MongoDB-based logbook MVP design kept for historical reference.

## Overview

A production-ready MVP for organizations to create customizable logbook templates, collect structured form data, and enforce role-based access control. The system uses a **normalized document model** in MongoDB (collections mirror relational tables with UUID foreign keys) to support future analytics, ML, and audit modules.

## Tech Stack

| Layer      | Technology                                      |
|-----------|--------------------------------------------------|
| Frontend  | React 18, TypeScript, TailwindCSS, React Router, Axios |
| Backend   | FastAPI, Pydantic v2, Beanie ODM (MongoDB), JWT  |
| Database  | MongoDB 7                                        |
| DevOps    | Docker Compose                                   |

> **Note:** SQLAlchemy targets SQL databases. For MongoDB we use **Beanie ODM** with the same repository/service layering and normalized schema the spec describes.

## Folder Structure

```
Log_Project/
├── ARCHITECTURE.md
├── README.md
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── core/
│       │   ├── config.py
│       │   ├── database.py
│       │   └── security.py
│       ├── models/
│       │   ├── user.py
│       │   ├── department.py
│       │   ├── template.py
│       │   ├── template_field.py
│       │   ├── record.py
│       │   └── record_value.py
│       ├── schemas/
│       │   ├── auth.py
│       │   ├── user.py
│       │   ├── department.py
│       │   ├── template.py
│       │   ├── record.py
│       │   └── dashboard.py
│       ├── repositories/
│       │   ├── base.py
│       │   ├── user_repository.py
│       │   ├── department_repository.py
│       │   ├── template_repository.py
│       │   ├── template_field_repository.py
│       │   └── record_repository.py
│       ├── services/
│       │   ├── auth_service.py
│       │   ├── user_service.py
│       │   ├── department_service.py
│       │   ├── template_service.py
│       │   └── record_service.py
│       ├── api/
│       │   ├── deps.py
│       │   └── v1/
│       │       ├── router.py
│       │       ├── auth.py
│       │       ├── users.py
│       │       ├── departments.py
│       │       ├── templates.py
│       │       ├── records.py
│       │       └── dashboard.py
│       └── utils/
│           └── seed.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── api/
        │   ├── client.ts
        │   ├── auth.ts
        │   ├── users.ts
        │   ├── departments.ts
        │   ├── templates.ts
        │   ├── records.ts
        │   └── dashboard.ts
        ├── types/
        │   └── index.ts
        ├── contexts/
        │   └── AuthContext.tsx
        ├── components/
        │   ├── layout/
        │   │   ├── AppLayout.tsx
        │   │   ├── Sidebar.tsx
        │   │   └── ProtectedRoute.tsx
        │   ├── ui/
        │   │   ├── Button.tsx
        │   │   ├── Input.tsx
        │   │   ├── Modal.tsx
        │   │   ├── Table.tsx
        │   │   ├── Card.tsx
        │   │   └── Badge.tsx
        │   └── forms/
        │       ├── DynamicFormRenderer.tsx
        │       └── FieldEditor.tsx
        └── pages/
            ├── LoginPage.tsx
            ├── admin/
            │   ├── AdminDashboard.tsx
            │   ├── UserManagement.tsx
            │   ├── DepartmentManagement.tsx
            │   └── TemplateManagement.tsx
            ├── department/
            │   └── DepartmentDashboard.tsx
            ├── member/
            │   └── MemberDashboard.tsx
            ├── records/
            │   ├── RecordListPage.tsx
            │   └── CreateRecordPage.tsx
            └── NotFoundPage.tsx
```

## Database Schema (MongoDB Collections)

All documents use `UUID` primary keys (`_id` stored as string) and `created_at` / `updated_at` timestamps.

### `users`

| Field           | Type     | Constraints                    |
|----------------|----------|--------------------------------|
| _id            | UUID     | PK                             |
| email          | string   | unique, indexed                |
| hashed_password| string   | required                       |
| full_name      | string   | required                       |
| role           | enum     | admin \| department \| member  |
| department_id  | UUID     | nullable, FK → departments     |
| is_active      | boolean  | default true                   |
| created_at     | datetime | auto                           |
| updated_at     | datetime | auto                           |

### `departments`

| Field       | Type     | Constraints        |
|------------|----------|----------------------|
| _id        | UUID     | PK                   |
| name       | string   | unique, required       |
| description| string   | optional             |
| created_at | datetime | auto                 |
| updated_at | datetime | auto                 |

### `templates`

| Field          | Type     | Constraints              |
|---------------|----------|--------------------------|
| _id           | UUID     | PK                       |
| name          | string   | required                 |
| description   | string   | optional                 |
| department_id | UUID     | FK → departments         |
| is_active     | boolean  | default true             |
| allow_member_create | boolean | default true        |
| created_at    | datetime | auto                     |
| updated_at    | datetime | auto                     |

### `template_fields`

| Field         | Type     | Constraints                              |
|--------------|----------|------------------------------------------|
| _id          | UUID     | PK                                       |
| template_id  | UUID     | FK → templates, indexed                  |
| name         | string   | slug key for record_values               |
| label        | string   | display label                            |
| field_type   | enum     | text, number, email, date, boolean, dropdown, textarea |
| required     | boolean  | default false                            |
| placeholder  | string   | optional                                 |
| default_value| any      | optional                                 |
| validation   | object   | min, max, pattern, options (dropdown)    |
| sort_order   | int      | display order                            |
| created_at   | datetime | auto                                     |
| updated_at   | datetime | auto                                     |

### `records`

| Field         | Type     | Constraints              |
|--------------|----------|--------------------------|
| _id          | UUID     | PK                       |
| template_id  | UUID     | FK → templates           |
| department_id| UUID     | FK → departments         |
| submitted_by | UUID     | FK → users               |
| status       | enum     | draft \| submitted       |
| created_at   | datetime | auto                     |
| updated_at   | datetime | auto                     |

### `record_values`

| Field      | Type     | Constraints                    |
|-----------|----------|--------------------------------|
| _id       | UUID     | PK                             |
| record_id | UUID     | FK → records, indexed          |
| field_id  | UUID     | FK → template_fields           |
| field_name| string   | denormalized for ML/export     |
| value     | any      | typed per field_type           |
| created_at| datetime | auto                           |
| updated_at| datetime | auto                           |

### Indexes

- `users.email` (unique)
- `departments.name` (unique)
- `template_fields.template_id`
- `records.template_id`, `records.department_id`, `records.submitted_by`
- `record_values.record_id`

## Role-Based Access Control

| Action                    | Admin | Department | Member |
|--------------------------|-------|------------|--------|
| Manage departments       | ✓     | ✗          | ✗      |
| Manage users             | ✓     | ✗          | ✗      |
| Manage templates/fields  | ✓     | ✗          | ✗      |
| View all records         | ✓     | dept only  | own*   |
| Create records           | ✓     | if allowed | ✓      |
| Export data              | ✓     | dept only  | ✗      |
| Dashboard metrics        | ✓     | dept scope | limited|

*Member can view own submissions when `view_own_only` policy applies.

## API Contracts

Base URL: `/api/v1`  
Auth: `Authorization: Bearer <access_token>`

### Authentication

| Method | Endpoint        | Description        | Auth |
|--------|----------------|--------------------|------|
| POST   | /auth/login    | Login, returns JWT | No   |
| GET    | /auth/me       | Current user       | Yes  |

**POST /auth/login**
```json
// Request
{ "email": "admin@logbook.app", "password": "admin123" }

// Response 200
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "user": { "id": "uuid", "email": "...", "full_name": "...", "role": "admin", "department_id": null }
}
```

### Users (Admin only)

| Method | Endpoint           | Description   |
|--------|-------------------|---------------|
| GET    | /users            | List users    |
| POST   | /users            | Create user   |
| GET    | /users/{id}       | Get user      |
| PUT    | /users/{id}       | Update user   |
| DELETE | /users/{id}       | Delete user   |

### Departments

| Method | Endpoint                | Description      | Role   |
|--------|------------------------|------------------|--------|
| GET    | /departments           | List             | Admin  |
| POST   | /departments           | Create           | Admin  |
| GET    | /departments/{id}      | Get              | Admin  |
| PUT    | /departments/{id}      | Update           | Admin  |
| DELETE | /departments/{id}      | Delete           | Admin  |

### Templates

| Method | Endpoint                              | Description        | Role        |
|--------|--------------------------------------|--------------------|-------------|
| GET    | /templates                           | List (scoped)      | All         |
| POST   | /templates                           | Create             | Admin       |
| GET    | /templates/{id}                      | Get with fields    | Scoped      |
| PUT    | /templates/{id}                      | Update             | Admin       |
| DELETE | /templates/{id}                      | Delete             | Admin       |
| GET    | /templates/{id}/fields               | List fields        | Scoped      |
| POST   | /templates/{id}/fields               | Add field          | Admin       |
| PUT    | /templates/{id}/fields/{field_id}    | Update field       | Admin       |
| DELETE | /templates/{id}/fields/{field_id}    | Delete field       | Admin       |

### Records

| Method | Endpoint           | Description              | Role   |
|--------|-------------------|--------------------------|--------|
| GET    | /records          | List (scoped)            | All    |
| POST   | /records          | Create with values       | All*   |
| GET    | /records/{id}     | Get with values          | Scoped |
| PUT    | /records/{id}     | Update values            | Scoped |
| DELETE | /records/{id}     | Delete                   | Admin/Dept |
| GET    | /records/export   | CSV export               | Admin/Dept |

**POST /records**
```json
{
  "template_id": "uuid",
  "values": [
    { "field_id": "uuid", "value": "John Doe" },
    { "field_id": "uuid", "value": 95 }
  ]
}
```

### Dashboard

| Method | Endpoint     | Description                    | Role  |
|--------|-------------|--------------------------------|-------|
| GET    | /dashboard  | Metrics (scoped by role)       | All   |

**Response**
```json
{
  "total_users": 10,
  "total_departments": 3,
  "total_templates": 5,
  "total_records": 120
}
```

## Future Extension Points

| Module        | Integration Point                                      |
|--------------|--------------------------------------------------------|
| Analytics    | `record_values` collection + aggregation pipelines     |
| Reporting    | `records` + `record_values` with department filters    |
| CSV Import   | Bulk insert via `record_service`                       |
| ML Engine    | Feature extraction from `record_values.field_name`     |
| Audit Logs   | Middleware + `audit_logs` collection                   |
| Notifications| Event hooks in `record_service` on submit              |

## Security

- Passwords hashed with bcrypt
- JWT access tokens (configurable expiry)
- Role guards on all protected endpoints
- Department scoping enforced in service layer
- Input validation via Pydantic schemas and field-level rules
