/**
 * P6-PERF — unit: VirtualList threshold + spot-check screens use FlatList;
 * run host stays Screen scroll (one card at a time).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LIST_VIRTUALIZE_THRESHOLD,
  shouldVirtualizeList,
} from '../src/components/ui/virtualListConfig.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

assert.equal(LIST_VIRTUALIZE_THRESHOLD, 50);
assert.equal(shouldVirtualizeList(50), false);
assert.equal(shouldVirtualizeList(51), true);
assert.equal(shouldVirtualizeList(0), false);

assert.ok(fs.existsSync(path.join(root, 'src/components/ui/VirtualList.tsx')));

const virtualSrc = fs.readFileSync(path.join(root, 'src/components/ui/VirtualList.tsx'), 'utf8');
assert.ok(virtualSrc.includes('FlatList'), 'VirtualList uses FlatList');
assert.ok(virtualSrc.includes('initialNumToRender'), 'windowing tuned');

const screens = [
  ['src/features/my-runs/MyRunsScreen.tsx', 'My Runs (IAF heats)', true],
  ['src/features/maintenance/WorkOrdersScreen.tsx', 'WO list', true],
  ['src/features/workforce/WorkforceEmployeesScreen.tsx', 'WF employees', true],
  ['src/features/executive/ExecutiveEmployeesScreen.tsx', 'Exec employees', false],
  ['src/features/admin/AdminUsersScreen.tsx', 'Admin users', true],
  ['src/features/supervisor/SupervisorMonitorScreen.tsx', 'Ops runs', true],
] as const;

for (const [rel, label, listOnly] of screens) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  assert.ok(src.includes('VirtualList'), `${label} must use VirtualList`);
  if (listOnly) {
    assert.ok(!src.includes('<Screen scroll'), `${label} list should not use Screen scroll`);
  }
}

const runHost = fs.readFileSync(
  path.join(root, 'src/features/run-host/RunHostScreen.tsx'),
  'utf8'
);
assert.ok(runHost.includes('<Screen'), 'RunHost keeps Screen');
assert.ok(runHost.includes('scroll'), 'RunHost cards stay scrollable');
assert.ok(!runHost.includes('VirtualList'), 'RunHost must not virtualize card steps away');

const index = fs.readFileSync(path.join(root, 'src/components/ui/index.ts'), 'utf8');
assert.ok(index.includes('VirtualList'), 'ui barrel exports VirtualList');

console.log('test-perf: OK');
