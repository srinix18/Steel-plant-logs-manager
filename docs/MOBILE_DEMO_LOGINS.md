# MOI Mobile — Demo Logins

Use with the **MOI preview APK** against:

`https://moi-api-woif.onrender.com`

**Dev / demo passwords only — do not use in production.**

If the first login is slow, wait ~30–60 seconds (Render free tier may be waking up) and try again.

---

## How to use

| Who | What to do |
|-----|------------|
| **Worker** | Open shift / start a run and fill the log sheet for that department |
| **Supervisor** | Oversight for their process / shift |
| **HoD** | Department-level view |
| **CEO / HR / Admin** | Org / workforce / platform |

---

## Organisation / platform

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@logbook.app` | `admin123` |
| CEO | `ceo@chandansteel.com` | `ceo123` |
| HR | `hr@chandansteel.com` | `hr123` |

---

## SMS — Steel Melting Shop (IAF / AOD / CCM)

| Role | Email | Password |
|------|-------|----------|
| HoD | `hod@chandansteel.com` | `hod123` |
| IAF Supervisor | `iaf.supervisor@chandansteel.com` | `iaf123` |
| AOD Supervisor | `aod.supervisor@chandansteel.com` | `aod123` |
| CCM Supervisor | `ccm.supervisor@chandansteel.com` | `ccm123` |
| Supervisor (legacy) | `supervisor@chandansteel.com` | `supervisor123` |
| Worker (melter) | `melter@chandansteel.com` | `worker123` |

---

## Rolling Mill

| Role | Email | Password |
|------|-------|----------|
| HoD | `hod.rolling@chandansteel.com` | `hod123` |
| Supervisor | `supervisor.rolling@chandansteel.com` | `rolling123` |
| Worker | `worker.rolling@chandansteel.com` | `rolling123` |

---

## Wire Division (furnace + drawing)

| Role | Email | Password |
|------|-------|----------|
| HoD | `hod.wire@chandansteel.com` | `hod123` |
| Supervisor | `supervisor.wire@chandansteel.com` | `wire123` |
| Worker | `worker.wire@chandansteel.com` | `wire123` |

---

## Bright Bar Division

| Role | Email | Password |
|------|-------|----------|
| HoD | `hod.bbd@chandansteel.com` | `hod123` |
| Supervisor | `supervisor.bbd@chandansteel.com` | `bbd123` |
| Worker | `worker.bbd@chandansteel.com` | `bbd123` |

---

## Forge Shop (grinding)

| Role | Email | Password |
|------|-------|----------|
| HoD | `hod.forge@chandansteel.com` | `hod123` |
| Supervisor | `supervisor.forge@chandansteel.com` | `forge123` |
| Worker | `worker.forge@chandansteel.com` | `forge123` |

---

## Maintenance

| Role | Email | Password |
|------|-------|----------|
| Quality | `maint.quality@chandansteel.com` | `maint123` |
| Safety | `maint.safety@chandansteel.com` | `maint123` |
| Energy | `maint.energy@chandansteel.com` | `maint123` |
| Equipment | `maint.equipment@chandansteel.com` | `maint123` |
| Process | `maint.process@chandansteel.com` | `maint123` |

---

## What works on the mobile APK

| Area | Status |
|------|--------|
| SMS heats (IAF / AOD / CCM) | Full log sheets |
| Rolling Mill shift report | Full log sheets |
| Wire furnace + drawing | Full log sheets |
| Bright Bar daily register | Full log sheets |
| Forge grinding register | Full log sheets |
| Bright Bar peeling | Not live yet (blocked / planned) |
| Quality / Utilities | Department shell only (no fake production sheet) |
| Maintenance accounts | Maintenance queues (not furnace entry) |

---

## Suggested walkthrough

1. Install `MOI-preview.apk` (allow unknown sources if asked).
2. Login as **`melter@chandansteel.com` / `worker123`** → start / open an IAF heat.
3. Then try each department’s **Worker** account above for that area’s sheet.
4. Use Supervisor / HoD accounts for oversight.

API docs (optional): https://moi-api-woif.onrender.com/docs
