/**
 * Unit: P2-BBD-PEEL blocked empty state — no fake template.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  PEEL_BLOCKED_DESCRIPTION,
  PEEL_BLOCKED_TITLE,
  PEEL_PROCESS_CODE,
  isPeelProcessCode,
} from '../src/features/peel/peelBlocked.ts';
import {
  PROCESS_OPTIONS,
  filterProcessOptions,
  isNotDigitizedProcess,
  startButtonLabel,
} from '../src/features/shift/processOptions.ts';

assert.equal(PEEL_BLOCKED_TITLE, 'Peeling not digitized yet.');
assert.ok(PEEL_BLOCKED_DESCRIPTION.length > 20);
assert.equal(isPeelProcessCode('PEEL'), true);
assert.equal(isPeelProcessCode('peel'), true);
assert.equal(isPeelProcessCode('BBAR'), false);

const peel = PROCESS_OPTIONS.find((p) => p.code === PEEL_PROCESS_CODE);
assert.ok(peel, 'PEEL listed in PROCESS_OPTIONS for when process appears');
assert.equal(peel!.notDigitized, true);
assert.equal(isNotDigitizedProcess(peel), true);
assert.equal(startButtonLabel('PEEL', 'daily', true), 'View status');

// Hidden until API returns PEEL code
assert.deepEqual(
  filterProcessOptions(['BBAR', 'IAF']).map((p) => p.code),
  ['IAF', 'BBAR']
);
assert.deepEqual(
  filterProcessOptions(['BBAR', 'PEEL']).map((p) => p.code),
  ['BBAR', 'PEEL']
);

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const peelRoute = path.join(root, 'app', '(app)', 'peel', 'index.tsx');
assert.ok(fs.existsSync(peelRoute), 'peel route file exists');
const peelSrc = fs.readFileSync(peelRoute, 'utf8');
assert.ok(peelSrc.includes('PeelBlockedScreen'));
assert.ok(!peelSrc.includes('DesktopOnlyGate'));
assert.ok(!/JSON\.stringify|TextInput.*json/i.test(peelSrc));

const screenSrc = fs.readFileSync(
  path.join(root, 'src', 'features', 'peel', 'PeelBlockedScreen.tsx'),
  'utf8'
);
assert.ok(screenSrc.includes('PEEL_BLOCKED_TITLE'));
assert.ok(!screenSrc.includes('DesktopOnlyGate'));

// Drawer exposes /peel for shop-floor roles (BBD workers use worker role)
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
  const workerHrefs = drawerLinkHrefs('worker') as string[];
  const supervisorHrefs = drawerLinkHrefs('supervisor') as string[];
  assert.ok(workerHrefs.includes('/peel'), 'worker drawer has /peel');
  assert.ok(supervisorHrefs.includes('/peel'), 'supervisor drawer has /peel');
  assert.ok(!drawerLinkHrefs('hr').includes('/peel'), 'hr has no peel (not shop floor)');
} finally {
  for (const { f, raw } of backups) {
    fs.writeFileSync(f, raw);
  }
}

console.log('peel-blocked: OK');
