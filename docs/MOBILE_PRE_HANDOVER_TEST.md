# Mobile pre-handover test (before manager UAT)

**Who:** You (dev) — run this once on **Expo Go** before giving the phone / APK to your manager.  
**Credentials:** [`LOGINS.md`](../LOGINS.md) (seed only — not production).  
**Start app:** `cd mobile` → `.\start-lan.ps1` → scan QR (same Wi‑Fi as PC). API must be up (`0.0.0.0:8000`).

**Pass rule:** For each row, tick **OK** only if: login works, home screen loads, no freeze/crash, and the listed steps complete without a red error banner you cannot dismiss.

---

## 0. Smoke before any role (~5 min)

| # | Check | OK |
|---|--------|----|
| 1 | Expo Go opens MOI (not blue Retry loop) | ☐ |
| 2 | Login screen shows; wrong password shows error (does **not** kick you out oddly) | ☐ |
| 3 | Drawer opens; **Sign out** returns to login; reopen stays logged out | ☐ |
| 4 | After good login, kill Expo Go → reopen → still signed in | ☐ |

---

## 1. Must-do logins (do these first — ~45–60 min)

These cover every major area. If all pass, you can hand over for manager UAT.

### A. Worker — floor heat

| | |
|--|--|
| **Login** | `melter@chandansteel.com` / `worker123` |
| **Expect home** | Shift Dashboard |

| # | Test | OK |
|---|------|----|
| 1 | Drawer: Shift, My Runs, Messages (worker items only — no Admin) | ☐ |
| 2 | **Shift** → start an **IAF** heat → opens run host | ☐ |
| 3 | Fill/save at least one card → **Save** succeeds | ☐ |
| 4 | Tap a workflow button if shown (e.g. power on / next state) or skip if none | ☐ |
| 5 | **My Runs** → see the run → **Report** opens HTML | ☐ |
| 6 | **My Attendance** (or My Leave) opens without crash | ☐ |
| 7 | **Messages** → open Alerts (list or empty is fine) | ☐ |

### B. IAF Supervisor — ops + report

| | |
|--|--|
| **Login** | `iaf.supervisor@chandansteel.com` / `iaf123` |
| **Expect home** | Operations Activity (`/supervisor`) |

| # | Test | OK |
|---|------|----|
| 1 | Production runs list loads; open **Workspace** or **Report** on one run | ☐ |
| 2 | **Shift** → can start IAF (same as worker path) | ☐ |
| 3 | Optional: Raise maintenance issue (modal) — submit or Cancel | ☐ |

### C. Maintenance — queue + WO

| | |
|--|--|
| **Login** | `maint.equipment@chandansteel.com` / `maint123` |
| **Expect home** | Maintenance |

| # | Test | OK |
|---|------|----|
| 1 | Issue **queue** loads; Assign / Close if any open item exists | ☐ |
| 2 | **Work Orders** list → open one → checklist / Start / Save if possible | ☐ |
| 3 | **Programs** list opens (wizard open/cancel is enough if no time) | ☐ |
| 4 | Drawer does **not** show Admin / Executive | ☐ |

### D. HR — workforce

| | |
|--|--|
| **Login** | `hr@chandansteel.com` / `hr123` |
| **Expect home** | Workforce |

| # | Test | OK |
|---|------|----|
| 1 | Dashboard loads | ☐ |
| 2 | **Employees** list scrolls; open Add or Edit (Cancel OK if you don’t want to save) | ☐ |
| 3 | **Attendance** screen opens | ☐ |
| 4 | **Leave** list opens | ☐ |
| 5 | **Shift planning** opens (publish only if a draft exists) | ☐ |

### E. HoD SMS — department view

| | |
|--|--|
| **Login** | `hod@chandansteel.com` / `hod123` |
| **Expect home** | Dept pulse / HOD |

| # | Test | OK |
|---|------|----|
| 1 | Home / HOD overview loads | ☐ |
| 2 | Open **Safety** dashboard or scan (search is enough if no camera) | ☐ |
| 3 | **Messages** compose opens | ☐ |

### F. CEO — exec + pulse

| | |
|--|--|
| **Login** | `ceo@chandansteel.com` / `ceo123` |
| **Expect home** | Plant pulse / executive area |

| # | Test | OK |
|---|------|----|
| 1 | Plant pulse KPIs load (or empty with no crash) | ☐ |
| 2 | **Executive** overview loads | ☐ |
| 3 | **Executive → Employees** list; open Add form then Cancel | ☐ |
| 4 | **Energy** or **Inventory** opens | ☐ |

### G. Super Admin — browse only

| | |
|--|--|
| **Login** | `admin@logbook.app` / `admin123` |
| **Expect home** | Admin |

| # | Test | OK |
|---|------|----|
| 1 | Admin home KPIs / shortcuts load | ☐ |
| 2 | Orgs / Departments / Sheets / Activity / Users list each open (read-only OK) | ☐ |
| 3 | Users list is list-only (no invent create here — create is Exec/HR) | ☐ |

---

## 2. One pass per other log sheet (pick supervisor — ~30 min)

Do **one** create → open → Save each. Skip deep workflow.

| Process | Login | Password | OK |
|---------|-------|----------|----|
| AOD | `aod.supervisor@chandansteel.com` | `aod123` | ☐ |
| CCM | `ccm.supervisor@chandansteel.com` | `ccm123` | ☐ |
| RMILL | `supervisor.rolling@chandansteel.com` | `rolling123` | ☐ |
| WFURN or WDRAW | `supervisor.wire@chandansteel.com` | `wire123` | ☐ |
| BBAR | `supervisor.bbd@chandansteel.com` | `bbd123` | ☐ |
| GRIND | `supervisor.forge@chandansteel.com` | `forge123` | ☐ |
| PEEL (blocked) | any BBD e.g. `worker.bbd@…` / `bbd123` | Open **PEEL** → blocked message, no crash | ☐ |

---

## 3. Optional (nice before handover)

| Login | Password | Quick check | OK |
|-------|----------|-------------|----|
| `maint.quality@chandansteel.com` | `maint123` | Queue opens (quality scope) | ☐ |
| `maint.safety@chandansteel.com` | `maint123` | Queue opens | ☐ |
| `worker.rolling@chandansteel.com` | `rolling123` | Shift + My Runs | ☐ |
| `worker.wire@chandansteel.com` | `wire123` | Shift + My Runs | ☐ |
| `hod.rolling@chandansteel.com` | `hod123` | HoD home loads | ☐ |

Full 26-account matrix: [`MOBILE_P6_DEVICE_QA.md`](./MOBILE_P6_DEVICE_QA.md) — **not required** before manager UAT if §1–2 pass.

---

## 4. Sign-off (you → manager)

| | |
|--|--|
| Date | |
| Device | Android · Expo Go |
| API URL used | `http://____:8000/api/v1` |
| §0 + §1 all OK? | ☐ Yes |
| §2 log sheets OK? | ☐ Yes / ☐ Partial (list gaps): |
| Known issues to tell manager | |
| Ready for manager UAT? | ☐ Yes |

**What to give the manager**

1. This file (or a photo of your ticks) + [`LOGINS.md`](../LOGINS.md)  
2. How to open: Expo Go + QR, or later the preview APK  
3. Ask them to focus on: **login as their role**, **one happy path** (heat / WO / employees), **Messages**  
4. Tell them: PEEL is intentionally blocked; OS push is not live — use **Alerts** in Messages  

---

## Quick demo chips (`__DEV__` only)

On the login screen (dev builds), chips map to: Admin, CEO, HR, HoD, IAF Sup, Worker, Maint, Rolling — same passwords as above.
