/**
 * P6-PUSH — unit: OS push skipped; in-app alerts via polling + Alerts tab.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALERTS_POLL_INTERVAL_MS,
  ALERTS_TAB_HREF,
  PUSH_SKIPPED,
  PUSH_SKIP_REASON,
} from '../src/notifications/pushPolicy.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.join(root, '..');

assert.equal(PUSH_SKIPPED, true, 'OS push must stay skipped without backend tokens');
assert.ok(PUSH_SKIP_REASON.toLowerCase().includes('poll'), 'skip reason mentions polling');
assert.ok(PUSH_SKIP_REASON.toLowerCase().includes('alert'), 'skip reason mentions alerts');
assert.equal(ALERTS_POLL_INTERVAL_MS, 30_000);
assert.ok(ALERTS_TAB_HREF.includes('messages/alerts'));

const doc = path.join(repoRoot, 'docs/MOBILE_P6_PUSH.md');
assert.ok(fs.existsSync(doc), 'docs/MOBILE_P6_PUSH.md missing');
const docText = fs.readFileSync(doc, 'utf8');
assert.ok(docText.includes('Skipped'), 'doc records skip');
assert.ok(docText.includes('polling') || docText.includes('poll'), 'doc mentions polling');
assert.ok(docText.includes('Alerts'), 'doc mentions Alerts tab');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.ok(
  !pkg.dependencies?.['expo-notifications'] && !pkg.devDependencies?.['expo-notifications'],
  'do not add expo-notifications until backend push exists'
);

// No invented device-token APIs in mobile client.
const apiDir = path.join(root, 'src/api');
for (const name of fs.readdirSync(apiDir)) {
  if (!name.endsWith('.ts')) continue;
  const src = fs.readFileSync(path.join(apiDir, name), 'utf8');
  assert.ok(!/device[_-]?token|expo.?push|\/devices/i.test(src), `no invent push API in ${name}`);
}

const alerts = fs.readFileSync(
  path.join(root, 'src/features/messages/MessagesAlertsScreen.tsx'),
  'utf8'
);
assert.ok(alerts.includes('ALERTS_POLL_INTERVAL_MS'), 'Alerts screen polls');
assert.ok(alerts.includes('setInterval'), 'Alerts uses interval poll');

const drawer = fs.readFileSync(path.join(root, 'src/nav/AppDrawerContent.tsx'), 'utf8');
assert.ok(drawer.includes('useUnreadNotificationPoll'), 'drawer badge polls unread');

const hook = fs.readFileSync(
  path.join(root, 'src/hooks/useUnreadNotificationPoll.ts'),
  'utf8'
);
assert.ok(hook.includes('fetchUnreadCount'), 'poll hits unread-count');
assert.ok(hook.includes('ALERTS_POLL_INTERVAL_MS'), 'shared interval');

console.log('test-push: OK (skipped OS push; polling + Alerts tab)');
