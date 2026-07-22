# MOI Mobile (Expo)

Full-parity phone app for the Manufacturing Operations Intelligence platform (Chandan Steel).  
Build plan: [`docs/MOBILE_APP_MASTER_PLAN.md`](../docs/MOBILE_APP_MASTER_PLAN.md) · Prerequisites: [`docs/MOBILE_P1_00_PREREQUISITES.md`](../docs/MOBILE_P1_00_PREREQUISITES.md)

## Status

| Chunk | Status |
|-------|--------|
| P1-00 Prerequisites | Done |
| P1-01 Scaffold | Done — Expo SDK 54 |
| **P1-02 API + SecureStore** | **Done** |
| **P1-03 Login form polish** | **Done** |
| **P1-04 Role home** | **Done** |
| **P1-05 Drawer** | **Done** |
| **P1-06 Design system** | **Done** |
| **P1-07 Profile** | **Done** |
| P1-08 Plan 1 exit gate | Next |

## Requirements

- Node **20.19+** or **22 LTS** (use nvm — see below)
- Backend API on `0.0.0.0:8000` (see P1-00)
- **Expo Go from Play Store** (supports SDK 54). SDK 57 is not on the store yet — do not use it for phone testing.

## Node (nvm-windows)

```powershell
nvm use 22.14.0
node -v   # expect v22.14.0
```

If `nvm` is missing in a new terminal, open a fresh PowerShell after install, or:

```powershell
$env:NVM_HOME = "$env:LOCALAPPDATA\nvm"
$env:NVM_SYMLINK = "C:\nvm4w\nodejs"
$env:Path = "$env:NVM_HOME;$env:NVM_SYMLINK;$env:Path"
nvm use 22.14.0
```

## Setup

```powershell
cd mobile
copy .env.example .env   # then edit LAN IP
npm install
.\start.ps1
```

Or, after opening a **new** terminal (so PATH picks up nvm):

```powershell
nvm use 22.14.0
cd mobile
npx expo start
```

If you see `node.exe is not recognized`, the terminal is using a stale PATH. Either open a new terminal, or run:

```powershell
$env:Path = "C:\Users\srini\AppData\Local\nvm;C:\nvm4w\nodejs;" + $env:Path
node -v
.\start.ps1
```

When Expo asks to log in: choose **Proceed anonymously**.

Scan the QR code with **Expo Go**.

### Environment

```text
EXPO_PUBLIC_API_URL=http://10.119.123.130:8000/api/v1
```

Use your Wi‑Fi IPv4 from `scripts/print-lan-ip.ps1` — **not** `localhost` on a physical phone.

## App structure

```text
mobile/
  app/
    _layout.tsx          # AuthProvider + Stack
    index.tsx            # Session restore → home or login
    login.tsx            # Sign in (P1-03 polishes UI)
    (app)/
      _layout.tsx        # Auth-guarded drawer
      home.tsx
      profile.tsx        # Logout clears SecureStore
  src/
    api/client.ts        # axios + Bearer + 401 + 30s timeout
    api/auth.ts          # POST /auth/login, GET /auth/me
    api/storage.ts       # SecureStore moi_access_token / moi_user
    auth/AuthContext.tsx
    types/user.ts
    theme/tokens.ts
```

## Auth (P1-02)

- Token: SecureStore `moi_access_token`
- User JSON: SecureStore `moi_user`
- Kill app → reopen → still signed in (until logout or 401)
- Profile → **Log out** clears SecureStore

Demo login: see `LOGINS.md` (e.g. `admin@logbook.app` / `admin123`). API must be reachable at `EXPO_PUBLIC_API_URL`.

## Smoke tests

After code changes:

```powershell
.\scripts\smoke.ps1
```

Runs unit error-mapping checks, `tsc --noEmit`, and a Metro web export (proves the app bundles).

## EAS

Project id: `371731a7-c9e4-4569-bc23-6161696bd8f1` in `app.json`. Skip `eas build` for Plan 1.
