# MOI Mobile (Expo SDK 54)

Full-parity phone app for Manufacturing Operations Intelligence (Chandan Steel).  
**Source of truth:** [`docs/MOBILE_APP_MASTER_PLAN.md`](../docs/MOBILE_APP_MASTER_PLAN.md)  
**Plan 1 exit gate:** [`docs/MOBILE_P1_08_EXIT_GATE.md`](../docs/MOBILE_P1_08_EXIT_GATE.md) · Prerequisites: [`docs/MOBILE_P1_00_PREREQUISITES.md`](../docs/MOBILE_P1_00_PREREQUISITES.md)

## Status

| Chunk | Status |
|-------|--------|
| P1-00 Prerequisites | Done |
| P1-01 Scaffold (SDK 54) | Done |
| P1-02 API + session storage | Done |
| P1-03 Login UI | Done |
| P1-04 Role homes | Done |
| P1-05 Role drawer | Done |
| P1-06 Design system | Done |
| P1-07 Profile | Done |
| **P1-08 Exit gate** | **Done — Plan 1 complete** |
| **P2-ENGINE-01 Run host** | **Done** |
| **P2-ENGINE-02 buildCardSteps** | **Done** |
| **P2-ENGINE-03 Section adapters** | **Done** |
| **P2-ENGINE-04 Shift launcher** | **Done** |
| **P2-SMS-IAF** | **Done** |
| **P2-SMS-AOD** | **Done** |
| **P2-SMS-CCM** | **Done** |

**Next chunk:** `Implement BUILD CHUNK P2-ROLLING-RMILL from docs/MOBILE_APP_MASTER_PLAN.md`

## Requirements

- Node **22 LTS** (or 20.19+) via nvm-windows
- Backend on `0.0.0.0:8000` (see P1-00)
- **Expo Go from Play Store** (SDK **54**). Do not use SDK 57 templates until store Expo Go catches up.

## Node (nvm-windows)

```powershell
nvm use 22.14.0
node -v
```

If `nvm` / `node` is missing in a terminal:

```powershell
$env:NVM_HOME = "$env:LOCALAPPDATA\nvm"
$env:NVM_SYMLINK = "C:\nvm4w\nodejs"
$env:Path = "$env:NVM_HOME;$env:NVM_SYMLINK;$env:Path"
nvm use 22.14.0
```

## Setup

```powershell
cd mobile
copy .env.example .env
# Edit EXPO_PUBLIC_API_URL to your Wi-Fi IPv4 (scripts/print-lan-ip.ps1)
npm install
.\start.ps1
```

When Expo asks to log in → **Proceed anonymously**. Scan QR with Expo Go.

### Environment

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | API base, e.g. `http://192.168.0.168:8000/api/v1` |

- Physical phone: **LAN IP**, never `localhost`
- Android emulator: `http://10.0.2.2:8000/api/v1`
- Re-check IP after Wi‑Fi changes: `powershell -File ../scripts/print-lan-ip.ps1`

## Scripts

| Command | Purpose |
|---------|---------|
| `.\start.ps1` | Start Metro / Expo Go (PATH-safe) |
| `.\scripts\smoke.ps1` | Unit + API smoke + `tsc` + Metro export |
| `.\scripts\p1-exit-gate.ps1` | Plan 1 exit checklist + smoke |
| `npm run test:roles` | Role → home map |
| `npm run test:drawer` | Admin vs worker drawer |
| `npm run test:logins` | All `LOGINS.md` accounts (API) |
| `npm run test:profile` | GET/PATCH `/auth/me` (API) |
| `npm run test:run-host` | Run load + field PATCH round-trip (API) |
| `npm run test:card-steps` | `buildCardSteps` IAF empty chemistry |
| `npm run test:adapters` | Section adapters + C.1 editors fixtures |
| `npm run test:process-options` | IAF / BBAR / RMILL launcher payloads |
| `npm run test:shift-launcher` | Create IAF + BBAR + RMILL runs (API) |
| `npm run test:formula` | Calculated field diffs (process_time / power) |
| `npm run test:workflow-ui` | IAF stepper / owning-tab helpers |
| `npm run test:iaf-lifecycle` | Melter create → power-on → waiting_for_sample |
| `npm run test:aod-gas` | Blow → gas rollup + blow step labels |
| `npm run test:aod-lifecycle` | AOD 13 sections + blow cols + sample temp |
| `npm run test:ccm-cells` | CCM empty row shapes + casting card steps |
| `npm run test:ccm-lifecycle` | Cast create → mould/time_range/zone round-trip |

## App structure

```text
mobile/
  app/
    _layout.tsx              # AuthProvider + root Stack
    index.tsx                # Session restore → role home or login
    login.tsx                # Sign in (TextField + Button.lg)
    (app)/
      _layout.tsx            # Custom role drawer + Sign out
      home.tsx               # Redirect to role home
      heat/[runId].tsx       # P2-ENGINE-01 run host
      shift/                 # P2-ENGINE-04 shift launcher
      my-runs/               # Thin run list → heat host
      profile/index.tsx      # GET/PATCH /auth/me
      messages/              # List placeholder (P3-MSG-*)
      admin|pulse|workforce|…  # Role homes + module placeholders
  src/
    api/                     # fetch client, auth, processRuns, storage
    auth/                    # AuthContext, roleHome, roles, demoAccounts
    features/run-host/       # RunHostScreen, buildCardSteps, field body
    nav/                     # buildDrawerNav, AppDrawerContent
    components/ui/           # A.5 primitives (+ ProgressBar)
    theme/tokens.ts
  scripts/smoke.ps1
  scripts/p1-exit-gate.ps1
```

## Auth & session

| Key | Storage |
|-----|---------|
| `moi_access_token` | SecureStore when available, else AsyncStorage |
| `moi_user` | JSON user snapshot |

- Kill app → reopen → still signed in until logout or 401
- Drawer / Profile → **Sign out** / **Log out** clears storage
- Demo accounts: [`LOGINS.md`](../LOGINS.md) (e.g. `admin@logbook.app` / `admin123`)

## Plan 1 acceptance (P1-08)

- [x] Physical phone (Expo Go)
- [x] Session restore
- [x] Role homes
- [x] Drawer correctness (worker ≠ admin)
- [x] Env-based API URL
- [x] This README

Details: [`docs/MOBILE_P1_08_EXIT_GATE.md`](../docs/MOBILE_P1_08_EXIT_GATE.md)

## EAS

Project id `371731a7-c9e4-4569-bc23-6161696bd8f1` in `app.json`. Skip `eas build` until a custom dev client is needed.
