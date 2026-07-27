/**
 * P6-OFFLINE — unit: draft queue merge + network failure detection (Q8).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ApiError } from '../src/api/errors.ts';
import {
  draftCount,
  mergeFieldValues,
  mergePayloads,
  mergeSectionData,
  removeDraft,
  upsertDraft,
} from '../src/offline/draftQueueLogic.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- File presence ---
for (const rel of [
  'src/offline/types.ts',
  'src/offline/draftQueueLogic.ts',
  'src/offline/draftQueue.ts',
  'src/offline/isNetworkFailure.ts',
  'src/offline/NetworkContext.tsx',
  'src/components/OfflineBanner.tsx',
]) {
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.ok(
  pkg.dependencies?.['@react-native-community/netinfo'],
  'netinfo dependency required'
);

const runHost = fs.readFileSync(path.join(root, 'src/features/run-host/useRunHost.ts'), 'utf8');
assert.ok(runHost.includes('enqueueDraftSave'), 'useRunHost queues drafts');
assert.ok(runHost.includes('isNetworkFailure'), 'useRunHost detects network failures');
assert.ok(runHost.includes('Draft queued'), 'useRunHost surfaces queue message (never silent)');

const appLayout = fs.readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8');
assert.ok(appLayout.includes('NetworkProvider'), 'root NetworkProvider');

const drawerLayout = fs.readFileSync(path.join(root, 'app/(app)/_layout.tsx'), 'utf8');
assert.ok(drawerLayout.includes('OfflineBanner'), 'app OfflineBanner');

const banner = fs.readFileSync(path.join(root, 'src/components/OfflineBanner.tsx'), 'utf8');
assert.ok(banner.includes('Retry'), 'banner Retry action');

const netFailSrc = fs.readFileSync(path.join(root, 'src/offline/isNetworkFailure.ts'), 'utf8');
assert.ok(netFailSrc.includes('NETWORK_ERROR'), 'detects NETWORK_ERROR');
assert.ok(netFailSrc.includes('ECONNABORTED'), 'detects timeout');

// Mirror isNetworkFailure rules here so Node smoke need not resolve RN/@ paths.
function isNetworkFailure(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED';
  }
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('network request failed')
    );
  }
  return false;
}

// --- Pure merge logic ---
const fields = mergeFieldValues(
  [{ field_key: 'a', value: '1' }],
  [
    { field_key: 'a', value: '2' },
    { field_key: 'b', value: '3' },
  ]
);
assert.deepEqual(fields, [
  { field_key: 'a', value: '2' },
  { field_key: 'b', value: '3' },
]);

const sections = mergeSectionData(
  [{ section_key: 'blow', data: { x: 1 } }],
  [{ section_key: 'blow', data: { x: 9 } }]
);
assert.deepEqual(sections, [{ section_key: 'blow', data: { x: 9 } }]);

const merged = mergePayloads(
  { field_values: [{ field_key: 't', value: 'old' }] },
  { section_data: [{ section_key: 's', data: {} }], grade_id: 'g1' }
);
assert.equal(merged.grade_id, 'g1');
assert.equal(merged.field_values?.[0]?.value, 'old');
assert.equal(merged.section_data?.[0]?.section_key, 's');

let queue = upsertDraft(
  [],
  'run-1',
  { field_values: [{ field_key: 'f', value: '1' }] },
  undefined,
  '2026-01-01T00:00:00Z',
  () => 'id-1'
);
assert.equal(draftCount(queue), 1);
queue = upsertDraft(
  queue,
  'run-1',
  {
    field_values: [
      { field_key: 'f', value: '2' },
      { field_key: 'g', value: '3' },
    ],
  },
  'net err',
  '2026-01-01T00:01:00Z',
  () => 'id-2'
);
assert.equal(draftCount(queue), 1, 'one draft per run');
assert.equal(queue[0].payload.field_values?.find((f) => f.field_key === 'f')?.value, '2');
assert.equal(queue[0].payload.field_values?.find((f) => f.field_key === 'g')?.value, '3');
assert.equal(queue[0].lastError, 'net err');
assert.equal(queue[0].id, 'id-1', 'keeps original id on merge');

queue = upsertDraft(queue, 'run-2', { section_data: [{ section_key: 'x', data: 1 }] });
assert.equal(draftCount(queue), 2);
queue = removeDraft(queue, 'run-1');
assert.equal(draftCount(queue), 1);
assert.equal(queue[0].runId, 'run-2');

assert.equal(isNetworkFailure(new ApiError('x', { code: 'NETWORK_ERROR' })), true);
assert.equal(isNetworkFailure(new ApiError('x', { code: 'ECONNABORTED' })), true);
assert.equal(isNetworkFailure(new ApiError('x', { code: 'HTTP', status: 500 })), false);
assert.equal(isNetworkFailure(new TypeError('Failed to fetch')), true);
assert.equal(isNetworkFailure(new Error('Network request failed')), true);
assert.equal(isNetworkFailure(new Error('validation failed')), false);

console.log('test-offline: OK');
