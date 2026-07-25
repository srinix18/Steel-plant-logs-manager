/**
 * P3-OPS-SUPER — unit + API smoke for Supervisor Monitor / raise issue.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canSubmitMaintenanceIssue,
  filterSupervisorRuns,
  uniqueRunStates,
} from '../src/features/supervisor/supervisorFilters.ts';
import type { ProcessRun } from '../src/types/processRun.ts';

const runs = [
  {
    id: '1',
    run_number: 'IAF-1',
    run_type: 'heat',
    process_instance_id: 'i1',
    template_version_id: 't',
    current_state: 'in_progress',
    created_at: '2026-07-25T00:00:00Z',
  },
  {
    id: '2',
    run_number: 'BBAR-1',
    run_type: 'daily',
    process_instance_id: 'i2',
    template_version_id: 't',
    current_state: 'completed',
    created_at: '2026-07-25T00:00:00Z',
  },
] as ProcessRun[];

const metaFor = (run: ProcessRun) =>
  run.id === '1'
    ? { processCode: 'IAF', processName: 'IAF', instanceName: 'F1' }
    : { processCode: 'BBAR', processName: 'BBAR', instanceName: 'L1' };

assert.equal(filterSupervisorRuns(runs, { processFilter: '', stateFilter: '', metaFor }).length, 2);
assert.equal(
  filterSupervisorRuns(runs, { processFilter: 'IAF', stateFilter: '', metaFor }).length,
  1
);
assert.equal(
  filterSupervisorRuns(runs, { processFilter: '', stateFilter: 'completed', metaFor })[0]
    ?.run_number,
  'BBAR-1'
);
assert.deepEqual(uniqueRunStates(runs), ['completed', 'in_progress']);

assert.equal(
  canSubmitMaintenanceIssue({ plantId: 'p', title: 'Leak', description: 'Valve drip' }),
  true
);
assert.equal(
  canSubmitMaintenanceIssue({ plantId: 'p', title: '  ', description: 'Valve drip' }),
  false
);
assert.equal(
  canSubmitMaintenanceIssue({ plantId: '', title: 'Leak', description: 'Valve drip' }),
  false
);
assert.equal(
  canSubmitMaintenanceIssue({ plantId: 'p', title: 'Leak', description: '' }),
  false
);

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(path.join(root, 'app', '(app)', 'supervisor', 'index.tsx'), 'utf8');
assert.ok(route.includes('SUPERVISOR_ROLES'));
assert.ok(route.includes('SupervisorMonitorScreen'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'supervisor', 'SupervisorMonitorScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('createMaintenanceIssue'));
assert.ok(screen.includes('fetchMaintenanceIssues'));
assert.ok(screen.includes('/(app)/reports/'));
assert.ok(screen.includes('Workspace'));
assert.ok(screen.includes('Raise maintenance issue'));

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
        email: 'iaf.supervisor@chandansteel.com',
        password: 'iaf123',
      }),
    });
  } catch (err) {
    console.log(`supervisor-issue-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('supervisor-issue-api: supervisor login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const meRes = await request('/auth/me', { headers: auth });
  if (!meRes.res.ok) {
    console.error('supervisor-issue-api: /auth/me failed', meRes.json);
    process.exit(1);
  }
  const me = meRes.json as { plant_id?: string };

  const plantsRes = await request('/plants', { headers: auth });
  const plants = plantsRes.res.ok ? (plantsRes.json as { id: string }[]) : [];
  const plantId = me.plant_id || plants[0]?.id;
  if (!plantId) {
    console.log('supervisor-issue-api: no plant — unit OK; skipped create');
    return;
  }

  const cats = await request('/maintenance/categories', { headers: auth });
  if (!cats.res.ok) {
    console.error('supervisor-issue-api: categories failed', cats.json);
    process.exit(1);
  }

  const runsRes = await request('/process-runs', { headers: auth });
  if (!runsRes.res.ok) {
    console.error('supervisor-issue-api: process-runs failed', runsRes.json);
    process.exit(1);
  }
  if (!Array.isArray(runsRes.json)) {
    console.error('supervisor-issue-api: process-runs not array', runsRes.json);
    process.exit(1);
  }

  const before = await request('/maintenance/issues?status=open', { headers: auth });
  if (!before.res.ok) {
    console.error('supervisor-issue-api: open issues failed', before.json);
    process.exit(1);
  }
  const beforeCount = Array.isArray(before.json) ? before.json.length : -1;

  const bad = await request('/maintenance/issues', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      title: '',
      description: '',
      category: 'equipment',
      severity: 'medium',
    }),
  });
  if (bad.res.ok) {
    console.error('supervisor-issue-api: empty title/description should fail');
    process.exit(1);
  }

  const stamp = Date.now();
  const created = await request('/maintenance/issues', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      title: `Mobile P3-OPS-SUPER smoke ${stamp}`,
      description: 'Raised by test-supervisor-issue-api.ts',
      category: 'equipment',
      severity: 'low',
    }),
  });
  if (!created.res.ok) {
    console.error('supervisor-issue-api: create failed', created.json);
    process.exit(1);
  }
  const issue = created.json as { id: string; title: string; status: string };
  if (!issue.id || issue.status !== 'open') {
    console.error('supervisor-issue-api: unexpected create payload', issue);
    process.exit(1);
  }

  const after = await request('/maintenance/issues?status=open', { headers: auth });
  if (!after.res.ok || !Array.isArray(after.json)) {
    console.error('supervisor-issue-api: refresh open issues failed', after.json);
    process.exit(1);
  }
  const found = (after.json as { id: string }[]).some((i) => i.id === issue.id);
  if (!found) {
    console.error('supervisor-issue-api: created issue missing from open list');
    process.exit(1);
  }
  if (beforeCount >= 0 && after.json.length < beforeCount) {
    console.error('supervisor-issue-api: open list shrank after create');
    process.exit(1);
  }

  console.log(
    `supervisor-issue-api: ok (runs=${(runsRes.json as unknown[]).length} open=${after.json.length} created=${issue.id})`
  );
}

await apiSmoke();
console.log('supervisor-issue-api: unit OK (filters + title/description gate)');
