# Phase 5 — Plant Pulse & Operational Monitoring

Phase 5 adds a read-only operational intelligence layer on top of existing MOI data.

## Modules

| Module | Route | API |
|--------|-------|-----|
| Plant Pulse | `/pulse/plant` | `GET /pulse/plant/{plant_id}` |
| Department Pulse | `/pulse/department` | `GET /pulse/department/{department_id}` |
| Asset Pulse | `/assets/:id/pulse` | `GET /pulse/asset/{asset_id}` |
| Asset Workspace | `/assets/:id/workspace` | `GET /assets/{id}/workspace` |
| OEE Engine | (embedded in dashboards) | `GET /oee/{scope_type}/{scope_id}` |
| Energy | `/energy` | `GET /energy/plant/{plant_id}` |
| Safety | `/safety/dashboard` | `GET /safety/dashboard/{plant_id}` |
| QR Scan | `/safety/scan` | `POST /safety/scan` |
| Inventory Pulse | `/inventory-pulse` | `GET /inventory-pulse/{plant_id}` |
| Maintenance Intelligence | `/maintenance/dashboard` | `GET /maintenance/intelligence` |

## Data refresh

- Snapshots refresh on startup (seed) and every 5 minutes via background task
- Manual refresh: `POST /pulse/refresh?plant_id=...` (CEO/admin)

## Demo flow

1. Login as CEO (`ceo@chandansteel.com`) → lands on Plant Pulse
2. Review department cards, live feed, critical alerts
3. Open Department Pulse for SMS/IAF detail
4. Scan QR or open `/assets/{id}/workspace` for asset intelligence
5. HoD login → Department Pulse scoped to their department

## Future integrations

Live parameters and energy readings use `source` field (`manual` | `process_run` | `plc`) — PLC/Kafka can populate the same tables without UI changes.
