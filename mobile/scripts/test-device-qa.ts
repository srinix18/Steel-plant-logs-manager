/**
 * P6-DEVICE-QA — unit: checklist doc + LOGINS matrix + happy-path routes exist.
 * Live login matrix: scripts/test-demo-logins.ts (via p6-device-qa.ps1).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALL_DEMO_LOGINS } from '../src/auth/demoAccounts.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.join(root, '..');

const qaDoc = path.join(repoRoot, 'docs/MOBILE_P6_DEVICE_QA.md');
assert.ok(fs.existsSync(qaDoc), 'docs/MOBILE_P6_DEVICE_QA.md missing');
const qa = fs.readFileSync(qaDoc, 'utf8');
assert.ok(qa.includes('LOGINS.md'), 'QA doc references LOGINS.md');
assert.ok(qa.includes('Happy paths'), 'QA doc has happy paths');
assert.ok(qa.includes('Plan 2'), 'QA doc covers Plan 2');
assert.ok(qa.includes('Plan 3'), 'QA doc covers Plan 3');
assert.ok(qa.includes('Plan 4'), 'QA doc covers Plan 4');
assert.ok(qa.includes('Plan 5'), 'QA doc covers Plan 5');
assert.ok(qa.includes('Sign-off'), 'QA doc has sign-off');
assert.ok(qa.includes('PENDING') || qa.includes('Phone'), 'physical rows present');

const loginsMd = fs.readFileSync(path.join(repoRoot, 'LOGINS.md'), 'utf8');
const emailsInLogins = [...loginsMd.matchAll(/`([a-z0-9.+_-]+@[a-z0-9.-]+)`/gi)].map((m) =>
  m[1].toLowerCase()
);
const uniqueLoginEmails = [...new Set(emailsInLogins)].filter((e) =>
  ALL_DEMO_LOGINS.some((a) => a.email.toLowerCase() === e)
);
assert.equal(
  ALL_DEMO_LOGINS.length,
  26,
  `expected 26 seed logins, got ${ALL_DEMO_LOGINS.length}`
);
for (const account of ALL_DEMO_LOGINS) {
  assert.ok(
    loginsMd.includes(account.email),
    `LOGINS.md missing ${account.email}`
  );
  assert.ok(qa.includes(account.email.split('@')[0]) || qa.includes(account.email), `QA matrix covers ${account.email}`);
}
assert.ok(uniqueLoginEmails.length >= 20, 'LOGINS.md should list seed emails');

/** One happy-path file per Plan 2–5 module (relative to app/(app)/). */
const happyPathRoutes: { module: string; file: string }[] = [
  // Plan 2
  { module: 'shift/IAF entry', file: 'shift/index.tsx' },
  { module: 'heat run host', file: 'heat/[runId].tsx' },
  { module: 'PEEL blocked', file: 'peel/index.tsx' },
  { module: 'reports', file: 'reports/[runId].tsx' },
  { module: 'my-runs', file: 'my-runs/index.tsx' },
  // Plan 3
  { module: 'supervisor', file: 'supervisor/index.tsx' },
  { module: 'hod', file: 'hod/index.tsx' },
  { module: 'safety scan', file: 'safety/scan.tsx' },
  { module: 'maint queue', file: 'maintenance/index.tsx' },
  { module: 'WO list', file: 'maintenance/work-orders/index.tsx' },
  { module: 'PM programs', file: 'maintenance/programs/index.tsx' },
  { module: 'messages', file: 'messages/index.tsx' },
  { module: 'alerts', file: 'messages/alerts.tsx' },
  // Plan 4
  { module: 'workforce', file: 'workforce/index.tsx' },
  { module: 'employees', file: 'workforce/employees.tsx' },
  { module: 'attendance', file: 'workforce/attendance.tsx' },
  { module: 'my-attendance', file: 'workforce/my-attendance.tsx' },
  { module: 'payroll', file: 'workforce/payroll.tsx' },
  // Plan 5
  { module: 'plant pulse', file: 'pulse/plant.tsx' },
  { module: 'energy', file: 'energy/index.tsx' },
  { module: 'inventory', file: 'inventory-pulse/index.tsx' },
  { module: 'foundation assets', file: 'foundation/assets.tsx' },
  { module: 'finance dash', file: 'finance/dashboard/index.tsx' },
  { module: 'admin home', file: 'admin/index.tsx' },
  { module: 'executive', file: 'executive/index.tsx' },
  { module: 'exec employees', file: 'executive/employees.tsx' },
];

const appRoot = path.join(root, 'app/(app)');
for (const { module, file } of happyPathRoutes) {
  const full = path.join(appRoot, file);
  assert.ok(fs.existsSync(full), `missing route for ${module}: ${file}`);
}

const gate = path.join(root, 'scripts/p6-device-qa.ps1');
assert.ok(fs.existsSync(gate), 'p6-device-qa.ps1 missing');

console.log(
  `test-device-qa: OK (doc + ${ALL_DEMO_LOGINS.length} logins + ${happyPathRoutes.length} routes)`
);
