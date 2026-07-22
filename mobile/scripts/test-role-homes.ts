import assert from 'node:assert/strict';

import { getRoleHomeHref } from '../src/auth/roleHome.ts';
import type { UserRole } from '../src/types/user.ts';

const cases: Array<[UserRole, string]> = [
  ['super_admin', '/admin'],
  ['admin', '/admin'],
  ['ceo', '/pulse/plant'],
  ['org_admin', '/pulse/plant'],
  ['hr', '/workforce'],
  ['hod', '/pulse/department'],
  ['plant_admin', '/pulse/department'],
  ['maintenance', '/maintenance'],
  ['supervisor', '/supervisor'],
  ['department', '/supervisor'],
  ['worker', '/shift'],
  ['member', '/shift'],
  ['maintenance_manager', '/shift'],
];

for (const [role, expected] of cases) {
  assert.equal(String(getRoleHomeHref(role)), expected, `role ${role}`);
}

console.log(`role homes: ok (${cases.length} roles)`);
