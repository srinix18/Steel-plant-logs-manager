# BUILD CHUNK P1-08 — Plan 1 exit gate

Part of [`MOBILE_APP_MASTER_PLAN.md`](./MOBILE_APP_MASTER_PLAN.md).

**Status: COMPLETE** (2026-07-23)

**Goal:** Confirm Plan 1 foundation is shippable enough to start `P2-ENGINE-01` (log-sheet engine).

---

## Checklist

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Emulator + physical phone | **PASS** (physical) | Expo Go on physical Android used through P1-01…P1-07. Emulator optional — not required if phone path works (`P1-00`). |
| 2 | Session restore | **PASS** | `AuthContext` restores token from SecureStore/`AsyncStorage` fallback → `GET /auth/me`. Kill Expo Go → reopen stays signed in (verified in Plan 1 acceptance). |
| 3 | Role homes | **PASS** | `getRoleHomeHref` + `scripts/test-role-homes.ts` (13 roles). Demo logins map roles → homes (`scripts/test-demo-logins.ts`, 26/26). |
| 4 | Drawer correctness | **PASS** | Sidebar-parity `buildDrawerNav` + `scripts/test-drawer-nav.ts` (admin ≠ worker; Profile + Messages always). Sign out in drawer footer. |
| 5 | Env-based API URL | **PASS** | `EXPO_PUBLIC_API_URL` in `.env` / `.env.example`; `src/api/client.ts` reads it. Refresh LAN IP via `scripts/print-lan-ip.ps1` when Wi‑Fi changes. |
| 6 | `mobile/README.md` complete | **PASS** | Setup, nvm, env, structure, auth, smoke, Plan 1 status, next chunk. |

**Automated gate:** `mobile/scripts/p1-exit-gate.ps1` (wraps `smoke.ps1` + prints this checklist).

---

## Plan 1 delivered

| Chunk | Deliverable |
|-------|-------------|
| P1-00 | Prerequisites (API, CORS, Expo Go, LAN IP) |
| P1-01 | Expo SDK 54 scaffold + drawer shell |
| P1-02 | fetch API client + session storage |
| P1-03 | Login UI (show/hide, KAV, demo chips) |
| P1-04 | Role home redirects + placeholders |
| P1-05 | Role-filtered drawer + Sign out |
| P1-06 | A.5 UI kit on Login / Profile / Messages |
| P1-07 | Profile GET/PATCH `/auth/me` |
| **P1-08** | **This exit gate** |

---

## Next

```text
Implement BUILD CHUNK P2-ENGINE-01 from docs/MOBILE_APP_MASTER_PLAN.md
```
