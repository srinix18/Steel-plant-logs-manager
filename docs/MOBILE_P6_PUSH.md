# Mobile P6-PUSH — OS push skipped

**Status:** Skipped (optional chunk).

## Why

The API stores in-app notifications (`user_notifications`) and exposes:

- `GET /notifications`
- `GET /notifications/unread-count`
- `PATCH /notifications/{id}/read`

There is **no** device-token / Expo push / FCM registration endpoint. Mobile must not invent one.

## What users get instead

| Channel | Behavior |
|---------|----------|
| **Alerts tab** | `/(app)/messages/alerts` — list + mark read + deep links; auto-refresh ~30s |
| **Messages badge** | Drawer unread count polls `GET /notifications/unread-count` ~30s while signed in |
| **Pull to refresh** | Alerts and Messages screens |

Copy for operators: **“Alerts via polling / open Alerts tab”** — no OS notification tray until push is built on the backend.

## When to revisit

Add Expo Notifications + a backend `POST /devices` (or similar) that stores Expo push tokens, then send pushes when creating `UserNotification` rows. Until then keep `PUSH_SKIPPED = true` in `mobile/src/notifications/pushPolicy.ts`.
