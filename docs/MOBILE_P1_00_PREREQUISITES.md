# BUILD CHUNK P1-00 — Mobile prerequisites

Part of [`MOBILE_APP_MASTER_PLAN.md`](./MOBILE_APP_MASTER_PLAN.md).  
Guidelines: **Part A** (quality bar Q1–Q10, architecture, design tokens).

**Status: COMPLETE** (verified 2026-07-22)

**Goal:** Confirm the machine can run Expo and reach the MOI API before scaffolding `mobile/` (`P1-01`).

---

## Acceptance (all passed)

| # | Check | Result |
|---|--------|--------|
| 1 | Node **20+** | **PASS** — v20.15.1 |
| 2 | npm available | **PASS** — 10.9.0 |
| 3 | Backend Swagger reachable | **PASS** — `GET http://localhost:8000/docs` → **200** |
| 4 | Health endpoint | **PASS** — `{"status":"ok"}` |
| 5 | Demo logins known | **PASS** — [`LOGINS.md`](../LOGINS.md); admin login returns `super_admin` |
| 6 | Device path planned | **PASS** — Expo Go installed on phone |
| 7 | API URL for phone known | **PASS** — use Wi‑Fi LAN IP (see §4); API listens on `0.0.0.0:8000` |

---

## 1. Verified on this workspace

| Check | Result |
|-------|--------|
| Node | **v20.15.1** |
| npm | **10.9.0** |
| Docker / Postgres | **moi-postgres** healthy on `localhost:5433` |
| Backend | uvicorn `--host 0.0.0.0 --port 8000` — startup complete |
| `/docs` | **200** |
| `/health` | `{"status":"ok"}` |
| `POST /api/v1/auth/login` (admin) | **OK** — role `super_admin`, JWT issued |
| Expo Go | Installed on phone (user confirmed) |
| Suggested Wi‑Fi LAN IP | `10.119.123.130` → `EXPO_PUBLIC_API_URL=http://10.119.123.130:8000/api/v1` |

---

## 2. Expo account commands (for P1-01 — do not run blindly as-is)

Expo dashboard suggested:

```text
npx create-expo-app@latest chandan-steel-app
npx eas-cli@latest init --id 371731a7-c9e4-4569-bc23-6161696bd8f1
npx eas-cli@latest build --profile development
npx expo start
```

**How we will use them in this monorepo (Plan A quality / architecture):**

| Expo suggestion | MOI monorepo decision |
|-----------------|------------------------|
| Folder `chandan-steel-app` | Create as **`Log_Project/mobile/`** (master plan tree) — display name can still be “Chandan Steel” / MOI |
| `eas init --id 371731a7-…` | Link that EAS project **inside `mobile/`** after scaffold (`P1-01` / early Plan 6) |
| `eas build --profile development` | **Not required for P1-00 or early Plan 1** — Expo Go + `npx expo start` is enough until we need a custom dev client |
| `npx expo start` | Run from `mobile/` after `P1-01` |

**Do not** create a second app at Desktop root outside the repo. Keep everything under `Log_Project/mobile/`.

---

## 3. Keep the stack running

```powershell
# From repo root
docker compose up postgres -d

cd backend
.\venv\Scripts\uvicorn.exe app.main:app --reload --host 0.0.0.0 --port 8000
```

- Swagger: http://localhost:8000/docs  
- Health: http://localhost:8000/health  
- Phone API base: `http://10.119.123.130:8000/api/v1` (re-check IP with `scripts/print-lan-ip.ps1` if Wi‑Fi changes)

**Firewall:** allow inbound TCP **8000** (API) and **8081** (Metro) when testing on a physical phone.

---

## 4. LAN IP for Expo Go

```powershell
powershell -File scripts/print-lan-ip.ps1
```

Prefer the **Wi‑Fi** address (not `169.254.*` link-local, not WSL `vEthernet` unless you know the phone can reach it).

---

## 5. CORS

Expo Go **native** does not use browser CORS. CORS is still configured for web + Expo web ports in `.env` / `backend/.env` (8081, 19006). See master plan Part A / earlier P1-00 env updates.

---

## 6. Demo login smoke (already verified)

| Email | Password | Role returned |
|-------|----------|---------------|
| `admin@logbook.app` | `admin123` | `super_admin` |

More roles: [`LOGINS.md`](../LOGINS.md).

---

## 7. Exit → next chunk

**P1-00 is finished.** Next:

```text
Implement BUILD CHUNK P1-01 from docs/MOBILE_APP_MASTER_PLAN.md
```

That will scaffold **`mobile/`** (not a separate Desktop folder), then we can link EAS project `371731a7-c9e4-4569-bc23-6161696bd8f1` when needed.
