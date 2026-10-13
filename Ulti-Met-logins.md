# Ulti-Met IMAP — Logins

One pattern: **`<role>.<department>@chandansteel.com`**, and one password per role: **`<Role>@123`**.

| Role prefix | Meaning | Password |
|---|---|---|
| `admin` | Platform admin | `Admin@123` |
| `ceo` | CEO | `Ceo@123` |
| `hr` | HR | `Hr@123` |
| `hod.<dept>` | Head of department | `Hod@123` |
| `sup.<dept or process>` | Shift supervisor | `Sup@123` |
| `op.<dept>` | Operator / worker | `Op@123` |
| `maint.<division>` | Maintenance crew | `Maint@123` |

Departments: `sms` (Steel Melting Shop), `rolling`, `wire`, `bbd` (Bright Bar), `forge`.
Supervisor processes in SMS: `iaf`, `aod`, `ccm`.

## Management
| Login | Password |
|---|---|
| admin@chandansteel.com | Admin@123 |
| ceo@chandansteel.com | Ceo@123 |
| hr@chandansteel.com | Hr@123 |

## Heads of department
| Login | Department | Password |
|---|---|---|
| hod.sms@chandansteel.com | Steel Melting Shop | Hod@123 |
| hod.rolling@chandansteel.com | Rolling Mill | Hod@123 |
| hod.wire@chandansteel.com | Wire Division | Hod@123 |
| hod.bbd@chandansteel.com | Bright Bar | Hod@123 |
| hod.forge@chandansteel.com | Forge Shop | Hod@123 |

## Supervisors
| Login | Area | Password |
|---|---|---|
| sup.iaf@chandansteel.com | SMS, induction furnace | Sup@123 |
| sup.aod@chandansteel.com | SMS, AOD | Sup@123 |
| sup.ccm@chandansteel.com | SMS, continuous casting | Sup@123 |
| sup.sms@chandansteel.com | SMS, general | Sup@123 |
| sup.rolling@chandansteel.com | Rolling Mill | Sup@123 |
| sup.wire@chandansteel.com | Wire Division | Sup@123 |
| sup.bbd@chandansteel.com | Bright Bar | Sup@123 |
| sup.forge@chandansteel.com | Forge Shop | Sup@123 |

## Operators
| Login | Department | Password |
|---|---|---|
| op.sms@chandansteel.com | Steel Melting Shop | Op@123 |
| op.rolling@chandansteel.com | Rolling Mill | Op@123 |
| op.wire@chandansteel.com | Wire Division | Op@123 |
| op.bbd@chandansteel.com | Bright Bar | Op@123 |
| op.forge@chandansteel.com | Forge Shop | Op@123 |

## Maintenance
| Login | Division | Password |
|---|---|---|
| maint.quality@chandansteel.com | Quality | Maint@123 |
| maint.safety@chandansteel.com | Safety | Maint@123 |
| maint.energy@chandansteel.com | Energy | Maint@123 |
| maint.equipment@chandansteel.com | Equipment | Maint@123 |
| maint.process@chandansteel.com | Process | Maint@123 |

## The other ~225 employees
Loaded from the Excel upload, one per person: `firstname.lastname<number>@chandansteel.com`, password **`Welcome@123`**.
They cover every department (Steel Melting Shop, Rolling Mill, Wire, Bright Bar, Forge, Quality, Utilities, Maintenance) and HR.

## Notes
- The first login after the server has been idle can take up to a minute (free hosting); try again.
- Old addresses (`admin@logbook.app`, `hod@`, `melter@`, `iaf.supervisor@`, `worker.rolling@`, and so on) no longer work.
