# BUILD CHUNK P6-DEVICE-QA — Physical device matrix

Part of [`MOBILE_APP_MASTER_PLAN.md`](./MOBILE_APP_MASTER_PLAN.md).  
Credentials: [`LOGINS.md`](../LOGINS.md) (dev seed only).

**Status:** Checklist **ready** — automated API login matrix + route inventory **PASS**.  
Physical Expo Go rows are for on-device sign-off before production release.

**Device under test (fill on phone):**

| Field | Value |
|-------|-------|
| Device / OS | Android · Expo Go SDK 54 |
| API URL | `EXPO_PUBLIC_API_URL` = `http://<LAN-IP>:8000/api/v1` |
| Tester | |
| Date | |

**How to run automated preflight**

```powershell
cd mobile
.\scripts\p6-device-qa.ps1
# or: node --experimental-strip-types .\scripts\test-device-qa.ts
#      npm run test:logins   # ALL_DEMO_LOGINS → POST /auth/login
```

---

## A. Login matrix (`LOGINS.md`)

**Automated:** `scripts/test-demo-logins.ts` (all seed emails).  
**On device:** sign in with each account (or `__DEV__` demo chips for the short list) → land on role home → drawer opens.

| # | Role | Email | API login | Phone Pass | Notes |
|---|------|-------|-----------|------------|-------|
| 1 | Super Admin | `admin@logbook.app` | ☐ | ☐ | Home `/admin` |
| 2 | CEO | `ceo@chandansteel.com` | ☐ | ☐ | Home `/pulse/plant` |
| 3 | HR | `hr@chandansteel.com` | ☐ | ☐ | Home `/workforce` |
| 4 | HoD SMS | `hod@chandansteel.com` | ☐ | ☐ | Home `/pulse/department` |
| 5 | Sup IAF | `iaf.supervisor@chandansteel.com` | ☐ | ☐ | Home `/supervisor` |
| 6 | Sup AOD | `aod.supervisor@chandansteel.com` | ☐ | ☐ | |
| 7 | Sup CCM | `ccm.supervisor@chandansteel.com` | ☐ | ☐ | |
| 8 | Sup legacy | `supervisor@chandansteel.com` | ☐ | ☐ | |
| 9 | Worker melter | `melter@chandansteel.com` | ☐ | ☐ | Home `/shift` |
| 10 | Maint quality | `maint.quality@chandansteel.com` | ☐ | ☐ | Home `/maintenance` |
| 11 | Maint safety | `maint.safety@chandansteel.com` | ☐ | ☐ | |
| 12 | Maint energy | `maint.energy@chandansteel.com` | ☐ | ☐ | |
| 13 | Maint equipment | `maint.equipment@chandansteel.com` | ☐ | ☐ | |
| 14 | Maint process | `maint.process@chandansteel.com` | ☐ | ☐ | |
| 15 | HoD Rolling | `hod.rolling@chandansteel.com` | ☐ | ☐ | |
| 16 | Sup Rolling | `supervisor.rolling@chandansteel.com` | ☐ | ☐ | |
| 17 | Worker Rolling | `worker.rolling@chandansteel.com` | ☐ | ☐ | |
| 18 | HoD Wire | `hod.wire@chandansteel.com` | ☐ | ☐ | |
| 19 | Sup Wire | `supervisor.wire@chandansteel.com` | ☐ | ☐ | |
| 20 | Worker Wire | `worker.wire@chandansteel.com` | ☐ | ☐ | |
| 21 | HoD BBD | `hod.bbd@chandansteel.com` | ☐ | ☐ | |
| 22 | Sup BBD | `supervisor.bbd@chandansteel.com` | ☐ | ☐ | |
| 23 | Worker BBD | `worker.bbd@chandansteel.com` | ☐ | ☐ | |
| 24 | HoD Forge | `hod.forge@chandansteel.com` | ☐ | ☐ | |
| 25 | Sup Forge | `supervisor.forge@chandansteel.com` | ☐ | ☐ | |
| 26 | Worker Forge | `worker.forge@chandansteel.com` | ☐ | ☐ | |

Mark **API login** from `p6-device-qa.ps1` / `test-demo-logins` output. Mark **Phone Pass** only after Expo Go sign-in.

---

## B. Happy paths (one per Plan 2–5 module)

Tick **Phone** after completing the steps on a mid-range Android. Suggested accounts are minimum privilege that can open the flow.

### Plan 2 — Log sheets & reports

| Module | Suggested login | Steps (happy path) | Route(s) | Phone |
|--------|-----------------|--------------------|----------|-------|
| IAF | `iaf.supervisor@…` / `melter@…` | Shift → start IAF heat → open run → Save on a card → workflow CTA if available | `/shift`, `/heat/[runId]` | ☐ |
| AOD | `aod.supervisor@…` | Start AOD → open blow/sample card → Save | `/heat/[runId]` | ☐ |
| CCM | `ccm.supervisor@…` | Start CCM → casting / mould card → Save | `/heat/[runId]` | ☐ |
| RMILL | `supervisor.rolling@…` | Start RMILL shift → delay or batch card → Save | `/heat/[runId]` | ☐ |
| WFURN | `supervisor.wire@…` | Start WFURN → coil pick / furnace → Save | `/heat/[runId]` | ☐ |
| WDRAW | `supervisor.wire@…` | Start WDRAW → inlet coil → Save | `/heat/[runId]` | ☐ |
| BBAR | `supervisor.bbd@…` | Start BBAR daily → register row → Save | `/heat/[runId]` | ☐ |
| PEEL | any BBD | Open PEEL → blocked empty state (no crash) | `/peel` | ☐ |
| GRIND | `supervisor.forge@…` | Start GRIND daily → header save | `/heat/[runId]` | ☐ |
| Reports | worker with a run | My Runs → Report → HTML readable / share | `/my-runs`, `/reports/[runId]` | ☐ |

### Plan 3 — Floor ops

| Module | Suggested login | Steps | Route(s) | Phone |
|--------|-----------------|-------|----------|-------|
| Shift | `melter@…` | Open Shift Dashboard; see launcher + active runs | `/shift` | ☐ |
| My Runs | `melter@…` | List scrolls; Edit / Report | `/my-runs` | ☐ |
| Supervisor | `iaf.supervisor@…` | Ops Activity list; open Workspace or Report | `/supervisor` | ☐ |
| HOD | `hod@…` | Department overview loads | `/hod` | ☐ |
| Safety scan | maint / hod | Scan or search → asset workspace | `/safety/scan`, `/assets/[id]/workspace` | ☐ |
| Safety dash/lists | `hod@…` | Dashboard + one list (incidents/inspections/SOPs) | `/safety` | ☐ |
| Maint queue | `maint.equipment@…` | Open queue; assign or close if items exist | `/maintenance` | ☐ |
| Maint dash | `maint.equipment@…` | Dashboard KPIs load | `/maintenance/dashboard` | ☐ |
| WO list + exec | `maint.equipment@…` | Open WO → checklist / transition | `/maintenance/work-orders` | ☐ |
| PM list + wizard | `maint.equipment@…` | Programs list; open new/edit wizard steps | `/maintenance/programs` | ☐ |
| Messages | any | Inbox → Alerts → Compose (send if recipients) | `/messages`, `/messages/alerts`, `/messages/compose` | ☐ |

### Plan 4 — Workforce

| Module | Suggested login | Steps | Route(s) | Phone |
|--------|-----------------|-------|----------|-------|
| WF dashboard | `hr@…` | Dashboard loads | `/workforce` | ☐ |
| Employees | `hr@…` | List virtualized; open Add/Edit | `/workforce/employees` | ☐ |
| Contractors / assign | `hr@…` | Open contractors + shift assignments | `/workforce/contractors`, `…/shift-assignments` | ☐ |
| Shift planning | `hr@…` | Grid loads; publish if draft exists | `/workforce/shift-planning` | ☐ |
| Attendance bulk | `hr@…` | Attendance screen usable | `/workforce/attendance` | ☐ |
| Handover | supervisor | Handover notes list / create | `/workforce/handover` | ☐ |
| Leave / skills / train | `hr@…` | Open each list | `/workforce/leave`, `…/skills`, `…/training` | ☐ |
| Payroll / salary | `hr@…` | Payroll + salary structures | `/workforce/payroll`, `…/salary-structures` | ☐ |
| My att / leave / pay | `melter@…` | Self-service three screens | `/workforce/my-*` | ☐ |

### Plan 5 — Pulse → Exec

| Module | Suggested login | Steps | Route(s) | Phone |
|--------|-----------------|-------|----------|-------|
| Plant pulse | `ceo@…` | KPIs + refresh | `/pulse/plant` | ☐ |
| Dept / asset pulse | `hod@…` | Dept pulse → asset pulse | `/pulse/department`, `/assets/[id]/pulse` | ☐ |
| Asset workspace | any with asset | Tabs load | `/assets/[id]/workspace` | ☐ |
| Energy | `ceo@…` / maint energy | Plant metrics | `/energy` | ☐ |
| Inventory | `ceo@…` | List + adjust if permitted | `/inventory-pulse` | ☐ |
| Foundation | `admin@…` / hod | Assets, masters, obs, CA, docs, analytics | `/foundation/*` | ☐ |
| Finance | finance-capable / ceo | Dash → cost sheet / masters / map / calc / analytics | `/finance/*` | ☐ |
| Admin | `admin@…` | Home, orgs, depts, sheets, activity, users list | `/admin/*` | ☐ |
| Executive | `ceo@…` | Overview + Employees CRUD | `/executive`, `/executive/employees` | ☐ |

---

## C. Spot-checks (Plan 6 hardening)

| Item | Steps | Phone |
|------|-------|-------|
| Offline banner | Toggle airplane mid-save on a heat → draft queued + Retry | ☐ |
| List scroll | My Runs / WO / Employees with many rows — no freeze | ☐ |
| Alerts (no OS push) | Open Alerts; badge updates after ~30s / pull refresh | ☐ |
| Session | Kill Expo Go → reopen still signed in | ☐ |

---

## D. Automated evidence (preflight)

Filled by `mobile/scripts/p6-device-qa.ps1` / `test-device-qa.ts`:

| Check | Result |
|-------|--------|
| `docs/MOBILE_P6_DEVICE_QA.md` present | **PASS** (this file) |
| `ALL_DEMO_LOGINS` = 26 accounts matching `LOGINS.md` | **PASS** (smoke) |
| Happy-path routes exist under `mobile/app/(app)/` | **PASS** (smoke) |
| `POST /auth/login` all seed accounts | Run `test-demo-logins` — **PASS** when API up; skip if down |
| Role homes map | `test-role-homes.ts` |

---

## E. Sign-off

| Layer | Status | Date | Signer |
|-------|--------|------|--------|
| Checklist created (P6-DEVICE-QA) | **PASS** | 2026-07-28 | build agent |
| Automated login + route inventory | **PASS** when `p6-device-qa.ps1` green | | |
| Plan exit gates F.2–F.6 | **CLOSED** (chunk + smoke evidence) | 2026-07-28 | build agent |
| Physical Expo Go matrix (sections A–C) | **PENDING** (optional plant QA) | | |

**Production release:** do not treat the app as device-certified until Phone columns in A–C are ticked and this table’s physical row is signed.

---

## Next

```text
Implement BUILD CHUNK P6-SEC from docs/MOBILE_APP_MASTER_PLAN.md
```
