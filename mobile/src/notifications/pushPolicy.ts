/**
 * P6-PUSH policy — OS push is skipped until the backend exposes device-token registration.
 *
 * Backend today: in-app `UserNotification` rows via
 * `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/{id}/read`.
 * No FCM / Expo push token endpoints exist — do not invent them.
 */
export const PUSH_SKIPPED = true as const;

export const PUSH_SKIP_REASON =
  'Backend has no Expo/FCM device-token registration. Alerts are in-app via polling and the Alerts tab.';

/** Unread badge + Alerts list refresh interval (matches Plant Pulse ~30s). */
export const ALERTS_POLL_INTERVAL_MS = 30_000;

/** Deep-link path for users: Messages → Alerts. */
export const ALERTS_TAB_HREF = '/(app)/messages/alerts';
