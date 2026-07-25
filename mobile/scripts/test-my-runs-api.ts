/**
 * P3-OPS-MYRUNS — unit + API smoke for My Runs.
 * Editable-state gating, route wiring, GET /process-runs/mine when API up.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatMyRunStartedAt,
  isMyRunEditable,
  MY_RUN_EDITABLE_STATES,
} from '../src/features/my-runs/editableStates.ts';

assert.ok(MY_RUN_EDITABLE_STATES.has('created'));
assert.ok(MY_RUN_EDITABLE_STATES.has('in_progress'));
assert.ok(MY_RUN_EDITABLE_STATES.has('waiting_for_sample'));
assert.ok(MY_RUN_EDITABLE_STATES.has('refining'));
assert.ok(MY_RUN_EDITABLE_STATES.has('ready_to_tap'));
assert.equal(isMyRunEditable('created'), true);
assert.equal(isMyRunEditable('completed'), false);
assert.equal(isMyRunEditable('cancelled'), false);
assert.equal(isMyRunEditable('approved'), false);

assert.ok(
  formatMyRunStartedAt({
    started_at: '2026-07-25T10:00:00.000Z',
    created_at: '2026-07-24T09:00:00.000Z',
  }).length > 0
);
assert.ok(
  formatMyRunStartedAt({
    started_at: null,
    created_at: '2026-07-24T09:00:00.000Z',
  }).length > 0
);

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(path.join(root, 'app', '(app)', 'my-runs', 'index.tsx'), 'utf8');
assert.ok(route.includes('MyRunsScreen'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'my-runs', 'MyRunsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchMyRuns'));
assert.ok(screen.includes('/(app)/heat/'));
assert.ok(screen.includes('/(app)/reports/'));
assert.ok(screen.includes('Open Shift Dashboard'));
assert.ok(screen.includes('/(app)/shift'));
assert.ok(screen.includes('isMyRunEditable'));
assert.ok(screen.includes('formatMyRunStartedAt'));
assert.ok(screen.includes('Report'));
assert.ok(screen.includes('Edit'));

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(
  /\/$/,
  ''
);

async function request(p: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}${p}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json };
}

async function apiSmoke() {
  let login;
  try {
    login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'melter@chandansteel.com',
        password: 'worker123',
      }),
    });
  } catch (err) {
    console.log(`my-runs-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('my-runs-api: melter login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const meRes = await request('/auth/me', { headers: auth });
  if (!meRes.res.ok) {
    console.error('my-runs-api: /auth/me failed', meRes.json);
    process.exit(1);
  }
  const me = meRes.json as { id: string };

  const mine = await request('/process-runs/mine', { headers: auth });
  if (!mine.res.ok) {
    console.error('my-runs-api: /process-runs/mine failed', mine.json);
    process.exit(1);
  }
  if (!Array.isArray(mine.json)) {
    console.error('my-runs-api: /mine not an array', mine.json);
    process.exit(1);
  }

  const runs = mine.json as {
    id: string;
    run_number: string;
    current_state: string;
    created_by?: string;
    started_at?: string | null;
    created_at: string;
  }[];

  for (const run of runs) {
    if (!run.run_number || !run.current_state || !run.created_at) {
      console.error('my-runs-api: run missing required fields', run);
      process.exit(1);
    }
    // Own-runs only when created_by is present on the payload
    if (run.created_by && run.created_by !== me.id) {
      console.error('my-runs-api: /mine returned another user\'s run', run.id, run.created_by);
      process.exit(1);
    }
  }

  console.log(
    `my-runs-api: ok (unit + /mine ${runs.length} run(s); editable gate ${[...MY_RUN_EDITABLE_STATES].join(',')})`
  );
}

await apiSmoke();
console.log('my-runs-api: unit OK (editable states + Shift empty CTA + Report always)');
