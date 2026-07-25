/**
 * Unit: P2-DEPT-SHELLS — QUAL/MAINT/UTIL shells; non-log processes never launch.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  SHELL_DEPARTMENT_CODES,
  isShellDepartmentCode,
  shellDepartmentHref,
  shellDepartmentMessage,
} from '../src/features/org/deptShells.ts';
import {
  filterProcessOptions,
  isLogSheetProcessCode,
  nonLogProcessesFromApi,
} from '../src/features/shift/processOptions.ts';

assert.deepEqual([...SHELL_DEPARTMENT_CODES], ['QUAL', 'MAINT', 'UTIL']);
assert.equal(isShellDepartmentCode('QUAL'), true);
assert.equal(isShellDepartmentCode('qual'), true);
assert.equal(isShellDepartmentCode('SMS'), false);
assert.equal(isShellDepartmentCode('BBD'), false);

assert.ok(shellDepartmentMessage('MAINT').includes('Maintenance'));
assert.ok(shellDepartmentMessage('QUAL').toLowerCase().includes('quality'));
assert.ok(shellDepartmentMessage('UTIL').toLowerCase().includes('utilities'));
assert.equal(shellDepartmentHref('MAINT'), '/maintenance');
assert.equal(shellDepartmentHref('QUAL'), null);
assert.equal(shellDepartmentHref('UTIL'), null);

assert.equal(isLogSheetProcessCode('IAF'), true);
assert.equal(isLogSheetProcessCode('GRIND'), true);
assert.equal(isLogSheetProcessCode('PEEL'), true);
assert.equal(isLogSheetProcessCode('MAINT'), false);
assert.equal(isLogSheetProcessCode('QUAL'), false);

const api = [
  { code: 'IAF', name: 'IAF' },
  { code: 'MAINT', name: 'Maintenance mystery' },
  { code: 'XYZ', name: 'Unknown' },
];
assert.deepEqual(
  nonLogProcessesFromApi(api).map((p) => p.code),
  ['MAINT', 'XYZ']
);
assert.deepEqual(
  filterProcessOptions(api.map((p) => p.code)).map((p) => p.code),
  ['IAF']
);

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const deptRoute = path.join(root, 'app', '(app)', 'admin', 'departments.tsx');
assert.ok(fs.existsSync(deptRoute));
const src = fs.readFileSync(deptRoute, 'utf8');
assert.ok(src.includes('DeptBrowserScreen'));
assert.ok(!src.includes('RoleHomePlaceholder'));
assert.ok(!src.includes('DesktopOnlyGate'));

const browserSrc = fs.readFileSync(
  path.join(root, 'src', 'features', 'org', 'DeptBrowserScreen.tsx'),
  'utf8'
);
assert.ok(browserSrc.includes('isShellDepartmentCode'));
assert.ok(browserSrc.includes('shellDepartmentHref'));
assert.ok(!/fake template|invent/i.test(browserSrc) || browserSrc.includes('never'));

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
  assert.ok(
    drawerLinkHrefs('super_admin').includes('/admin/departments'),
    'admin sees departments'
  );
  assert.ok(
    drawerLinkHrefs('maintenance').includes('/maintenance'),
    'maintenance role sees Maintenance module'
  );
  assert.ok(
    drawerLinkHrefs('hod').includes('/admin/departments'),
    'hod can browse departments'
  );
} finally {
  for (const { f, raw } of backups) {
    fs.writeFileSync(f, raw);
  }
}

console.log('dept-shells: OK');
