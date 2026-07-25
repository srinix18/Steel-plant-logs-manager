/**
 * P3-OPS-HOD — unit smoke: Department Overview wraps SupervisorMonitor + HoD nav.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(path.join(root, 'app', '(app)', 'hod', 'index.tsx'), 'utf8');
assert.ok(route.includes('HOD_TIER_ROLES'));
assert.ok(route.includes('SupervisorMonitorScreen'));
assert.ok(route.includes('Department Overview'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'supervisor', 'SupervisorMonitorScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('filterSupervisorRuns'));
assert.ok(screen.includes('createMaintenanceIssue'));

const files = [
  path.join(root, 'src', 'auth', 'roles.ts'),
  path.join(root, 'src', 'nav', 'buildDrawerNav.ts'),
];
const backups = files.map((f) => ({ f, raw: fs.readFileSync(f, 'utf8') }));

try {
  for (const { f, raw } of backups) {
    fs.writeFileSync(
      f,
      raw
        .replaceAll("from '../types/user'", "from '../types/user.ts'")
        .replaceAll("from '../auth/roles'", "from '../auth/roles.ts'")
    );
  }

  const { drawerLinkHrefs } = await import(
    pathToFileURL(path.join(root, 'src/nav/buildDrawerNav.ts')).href
  );

  const hodHrefs = drawerLinkHrefs('hod');
  assert.ok(hodHrefs.includes('/hod'), 'hod drawer has Department Overview → /hod');
  assert.ok(!hodHrefs.includes('/supervisor'), 'hod uses /hod not supervisor-only menu');

  const plantAdminHrefs = drawerLinkHrefs('plant_admin');
  assert.ok(plantAdminHrefs.includes('/hod'), 'plant_admin drawer has /hod');

  const workerHrefs = drawerLinkHrefs('worker');
  assert.ok(!workerHrefs.includes('/hod'), 'worker does not see /hod');

  console.log('hod-overview: ok (Department Overview + HoD nav)');
} finally {
  for (const { f, raw } of backups) {
    fs.writeFileSync(f, raw);
  }
}
