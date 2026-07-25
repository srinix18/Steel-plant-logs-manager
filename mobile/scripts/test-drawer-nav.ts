import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
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

  const { buildDrawerNav, drawerLinkHrefs } = await import(
    pathToFileURL(path.join(root, 'src/nav/buildDrawerNav.ts')).href
  );

  const adminHrefs = drawerLinkHrefs('super_admin');
  const workerHrefs = drawerLinkHrefs('worker');
  const ceoHrefs = drawerLinkHrefs('ceo');
  const hrHrefs = drawerLinkHrefs('hr');

  assert.ok(adminHrefs.includes('/admin'), 'admin sees admin overview');
  assert.ok(adminHrefs.includes('/admin/users'), 'admin sees users');
  assert.ok(!workerHrefs.includes('/admin'), 'worker does not see admin');
  assert.ok(!workerHrefs.includes('/admin/users'), 'worker does not see users');

  assert.ok(workerHrefs.includes('/shift'), 'worker sees shift');
  assert.ok(workerHrefs.includes('/peel'), 'worker sees peeling stub');
  assert.ok(workerHrefs.includes('/workforce/my-attendance'), 'worker self-service');
  assert.ok(!adminHrefs.includes('/workforce/my-attendance'), 'admin has no worker self-service');
  assert.ok(!adminHrefs.includes('/peel'), 'platform admin has no shop-floor peel link');
  assert.ok(!adminHrefs.includes('/shift'), 'platform admin has no shift');

  assert.ok(ceoHrefs.includes('/pulse/plant'), 'ceo plant pulse');
  assert.ok(ceoHrefs.includes('/executive'), 'ceo executive');
  assert.ok(!ceoHrefs.includes('/admin'), 'ceo is not platform admin menu');

  assert.ok(hrHrefs.includes('/workforce'), 'hr workforce');
  assert.ok(hrHrefs.includes('/workforce/employees'), 'hr employees');
  assert.ok(!hrHrefs.includes('/admin'), 'hr no admin');

  for (const role of ['super_admin', 'worker', 'ceo', 'hr', 'maintenance'] as const) {
    const hrefs = drawerLinkHrefs(role);
    assert.ok(hrefs.includes('/profile'), `${role} profile`);
    assert.ok(hrefs.includes('/messages'), `${role} messages`);
  }

  const adminSections = buildDrawerNav('super_admin')
    .filter((e: { type: string }) => e.type === 'section')
    .map((e: { label: string }) => e.label);
  assert.ok(adminSections.includes('Administration'));
  assert.ok(adminSections.includes('Plant Foundation'));

  const workerSections = buildDrawerNav('worker')
    .filter((e: { type: string }) => e.type === 'section')
    .map((e: { label: string }) => e.label);
  assert.ok(workerSections.includes('Shop floor'));
  assert.ok(workerSections.includes('Self-service'));
  assert.ok(!workerSections.includes('Administration'));

  console.log('drawer nav: ok (worker vs admin differ)');
} finally {
  for (const { f, raw } of backups) {
    fs.writeFileSync(f, raw);
  }
}
