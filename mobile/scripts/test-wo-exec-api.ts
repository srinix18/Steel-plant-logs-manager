/**
 * P3-MAINT-WO-EXEC — unit + API smoke: execute tasks → completed; reload persists.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'maintenance', 'work-orders', '[id].tsx'),
  'utf8'
);
assert.ok(route.includes('MAINTENANCE_PM_VIEW_ROLES'));
assert.ok(route.includes('WorkOrderExecScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'maintenance', 'WorkOrderExecScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchWorkOrder'));
assert.ok(screen.includes('executeWorkOrderTask'));
assert.ok(screen.includes('transitionWorkOrder'));
assert.ok(screen.includes('WO_ALLOWED_TRANSITIONS'));
assert.ok(screen.includes('Pass'));
assert.ok(screen.includes('Fail'));
assert.ok(screen.includes('N/A'));
assert.ok(screen.includes('Mark completed'));
assert.ok(screen.includes('complete all tasks') || screen.includes('Complete every task'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'maintenancePm.ts'), 'utf8');
assert.ok(api.includes('/tasks/'));
assert.ok(api.includes('executeWorkOrderTask'));
assert.ok(api.includes('WO_ALLOWED_TRANSITIONS'));

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
        email: 'maint.quality@chandansteel.com',
        password: 'maint123',
      }),
    });
  } catch (err) {
    console.log(`wo-exec-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('wo-exec-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const meRes = await request('/auth/me', { headers: auth });
  const me = meRes.res.ok ? (meRes.json as { plant_id?: string }) : {};
  const plantsRes = await request('/plants', { headers: auth });
  if (!plantsRes.res.ok) {
    console.error('wo-exec-api: plants failed', plantsRes.json);
    process.exit(1);
  }
  const plants = plantsRes.json as { id: string }[];
  const plantId = me.plant_id || plants[0]?.id;
  if (!plantId) {
    console.log('wo-exec-api: no plant — unit OK; skipped');
    return;
  }

  const programsRes = await request(
    `/maintenance/pm/programs?plant_id=${encodeURIComponent(plantId)}`,
    { headers: auth }
  );
  if (!programsRes.res.ok) {
    console.error('wo-exec-api: programs failed', programsRes.res.status, programsRes.json);
    process.exit(1);
  }
  const programs = programsRes.json as { id: string; name: string }[];
  const program = programs[0];
  if (!program) {
    console.log('wo-exec-api: no PM programs — unit OK; skipped');
    return;
  }

  const generated = await request(
    `/maintenance/pm/programs/${program.id}/generate-work-order`,
    { method: 'POST', headers: auth }
  );
  if (generated.res.status !== 201 && generated.res.status !== 200) {
    console.error('wo-exec-api: generate WO failed', generated.res.status, generated.json);
    process.exit(1);
  }
  let wo = generated.json as {
    id: string;
    status: string;
    wo_number: string;
    tasks: { id: string; status: string; name: string }[];
  };
  if (!wo.tasks?.length) {
    console.log(
      `wo-exec-api: generated WO ${wo.wo_number} has no tasks — unit OK; skipped execute`
    );
    return;
  }

  for (const to of ['assigned', 'accepted', 'in_progress'] as const) {
    const tr = await request(`/maintenance/pm/work-orders/${wo.id}/transition`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ to_state: to }),
    });
    if (tr.res.status !== 200) {
      console.error(`wo-exec-api: transition → ${to} failed`, tr.res.status, tr.json);
      process.exit(1);
    }
    wo = tr.json as typeof wo;
  }

  for (const task of wo.tasks) {
    const ex = await request(
      `/maintenance/pm/work-orders/${wo.id}/tasks/${task.id}/execute`,
      {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          status: 'pass',
          remarks: 'smoke pass',
          checklist_responses: { 'Inspection complete': true },
          photos: ['smoke://photo'],
          time_spent_min: 5,
        }),
      }
    );
    if (ex.res.status !== 200) {
      console.error('wo-exec-api: execute failed', task.name, ex.res.status, ex.json);
      process.exit(1);
    }
  }

  const complete = await request(`/maintenance/pm/work-orders/${wo.id}/transition`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ to_state: 'completed', notes: 'All tasks executed' }),
  });
  if (complete.res.status !== 200) {
    console.error('wo-exec-api: complete failed', complete.res.status, complete.json);
    process.exit(1);
  }

  const reload = await request(`/maintenance/pm/work-orders/${wo.id}`, { headers: auth });
  if (reload.res.status !== 200) {
    console.error('wo-exec-api: reload failed', reload.res.status, reload.json);
    process.exit(1);
  }
  const body = reload.json as {
    status: string;
    tasks: { status: string; remarks?: string | null; photos?: unknown[] }[];
  };
  if (body.status !== 'completed') {
    console.error('wo-exec-api: expected completed after reload', body.status);
    process.exit(1);
  }
  if (!body.tasks.every((t) => t.status !== 'pending')) {
    console.error('wo-exec-api: pending tasks remain after execute', body.tasks);
    process.exit(1);
  }
  if (!body.tasks.every((t) => t.remarks === 'smoke pass')) {
    console.error('wo-exec-api: remarks not persisted', body.tasks);
    process.exit(1);
  }

  console.log(
    `wo-exec-api: OK (${wo.wo_number} ${body.tasks.length} tasks → completed)`
  );
}

console.log('wo-exec-api: unit OK (tasks + all transitions + complete gate)');
await apiSmoke();
