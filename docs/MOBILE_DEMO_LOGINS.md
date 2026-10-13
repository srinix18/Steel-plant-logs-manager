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
| Super Admin | `admin@chandansteel.com` | `Admin@123` |
| CEO | `ceo@chandansteel.com` | `Ceo@123` |
| HR | `hr@chandansteel.com` | `Hr@123` |

---

## SMS — Steel Melting Shop (IAF / AOD / CCM)

| Role | Email | Password |
|------|-------|----------|
| HoD | `hod.sms@chandansteel.com` | `Hod@123` |
| IAF Supervisor | `sup.iaf@chandansteel.com` | `Sup@123` |
| AOD Supervisor | `sup.aod@chandansteel.com` | `Sup@123` |
| CCM Supervisor | `sup.ccm@chandansteel.com` | `Sup@123` |
| Supervisor (legacy) | `sup.sms@chandansteel.com` | `Sup@123` |
| Worker (melter) | `op.sms@chandansteel.com` | `Op@123` |

---

## Rolling Mill

| Role | Email | Password |
|------|-------|----------|
| HoD | `hod.rolling@chandansteel.com` | `Hod@123` |
| Supervisor | `sup.rolling@chandansteel.com` | `Sup@123` |
| Worker | `op.rolling@chandansteel.com` | `Op@123` |

---

## Wire Division (furnace + drawing)

| Role | Email | Password |
|------|-------|----------|
| HoD | `hod.wire@chandansteel.com` | `Hod@123` |
| Supervisor | `sup.wire@chandansteel.com` | `Sup@123` |
| Worker | `op.wire@chandansteel.com` | `Op@123` |

---

## Bright Bar Division

| Role | Email | Password |
|------|-------|----------|
| HoD | `hod.bbd@chandansteel.com` | `Hod@123` |
| Supervisor | `sup.bbd@chandansteel.com` | `Sup@123` |
| Worker | `op.bbd@chandansteel.com` | `Op@123` |

---

## Forge Shop (grinding)

| Role | Email | Password |
|------|-------|----------|
| HoD | `hod.forge@chandansteel.com` | `Hod@123` |
| Supervisor | `sup.forge@chandansteel.com` | `Sup@123` |
| Worker | `op.forge@chandansteel.com` | `Op@123` |

---

## Maintenance

| Role | Email | Password |
|------|-------|----------|
| Quality | `maint.quality@chandansteel.com` | `Maint@123` |
| Safety | `maint.safety@chandansteel.com` | `Maint@123` |
| Energy | `maint.energy@chandansteel.com` | `Maint@123` |
| Equipment | `maint.equipment@chandansteel.com` | `Maint@123` |
| Process | `maint.process@chandansteel.com` | `Maint@123` |

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
2. Login as **`op.sms@chandansteel.com` / `Op@123`** → start / open an IAF heat.
3. Then try each department’s **Worker** account above for that area’s sheet.
4. Use Supervisor / HoD accounts for oversight.

API docs (optional): https://moi-api-woif.onrender.com/docs
