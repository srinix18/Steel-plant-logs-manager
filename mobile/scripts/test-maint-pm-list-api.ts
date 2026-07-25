/**
 * P3-MAINT-PM-LIST — unit + API smoke: Activate + Generate WO → draft in WO list.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'maintenance', 'programs', 'index.tsx'),
  'utf8'
);
assert.ok(route.includes('MAINTENANCE_MANAGER_ROLES'));
assert.ok(route.includes('MaintenanceProgramsScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'maintenance', 'MaintenanceProgramsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchMaintenancePrograms'));
assert.ok(screen.includes('updateMaintenanceProgram'));
assert.ok(screen.includes('generateWorkOrderFromProgram'));
assert.ok(screen.includes('evaluatePmTriggers'));
assert.ok(screen.includes('Activate'));
assert.ok(screen.includes('Generate WO'));
assert.ok(screen.includes('Create program'));
assert.ok(screen.includes('/(app)/maintenance/programs/new'));
assert.ok(screen.includes('/(app)/maintenance/work-orders'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'maintenancePm.ts'), 'utf8');
assert.ok(api.includes('/maintenance/pm/programs'));
assert.ok(api.includes('updateMaintenanceProgram'));
assert.ok(api.includes('generateWorkOrderFromProgram'));

assert.ok(
  fs.existsSync(path.join(root, 'app', '(app)', 'maintenance', 'programs', 'new.tsx'))
);
assert.ok(
  fs.existsSync(
    path.join(root, 'app', '(app)', 'maintenance', 'programs', '[id]', 'edit.tsx')
  )
);

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
        email: 'ceo@chandansteel.com',
        password: 'ceo123',
      }),
    });
  } catch (err) {
    console.log(`maint-pm-list-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('maint-pm-list-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const meRes = await request('/auth/me', { headers: auth });
  const me = meRes.res.ok ? (meRes.json as { plant_id?: string }) : {};
  const plantsRes = await request('/plants', { headers: auth });
  if (!plantsRes.res.ok) {
    console.error('maint-pm-list-api: plants failed', plantsRes.json);
    process.exit(1);
  }
  const plants = plantsRes.json as { id: string }[];
  const plantId = me.plant_id || plants[0]?.id;
  if (!plantId) {
    console.log('maint-pm-list-api: no plant — unit OK; skipped');
    return;
  }

  const created = await request('/maintenance/pm/programs', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      name: `Mobile PM list smoke ${Date.now()}`,
      category: 'equipment',
      priority: 'medium',
      status: 'draft',
      responsible_team: 'Smoke Team',
    }),
  });
  if (created.res.status !== 201 && created.res.status !== 200) {
    console.error('maint-pm-list-api: create program failed', created.res.status, created.json);
    process.exit(1);
  }
  const program = created.json as { id: string; status: string; name: string };
  if (program.status !== 'draft') {
    console.error('maint-pm-list-api: expected draft program', program);
    process.exit(1);
  }

  // Add a task so Generate WO creates something useful
  const task = await request(`/maintenance/pm/programs/${program.id}/tasks`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name: 'Smoke inspection',
      checklist: [{ label: 'OK', type: 'checkbox' }],
      sort_order: 1,
    }),
  });
  if (task.res.status !== 201 && task.res.status !== 200) {
    console.error('maint-pm-list-api: add task failed', task.res.status, task.json);
    process.exit(1);
  }

  const activate = await request(`/maintenance/pm/programs/${program.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'active' }),
  });
  if (activate.res.status !== 200) {
    console.error('maint-pm-list-api: activate failed', activate.res.status, activate.json);
    process.exit(1);
  }
  const activated = activate.json as { status: string };
  if (activated.status !== 'active') {
    console.error('maint-pm-list-api: expected active', activated);
    process.exit(1);
  }

  const generated = await request(
    `/maintenance/pm/programs/${program.id}/generate-work-order`,
    { method: 'POST', headers: auth }
  );
  if (generated.res.status !== 201 && generated.res.status !== 200) {
    console.error('maint-pm-list-api: generate WO failed', generated.res.status, generated.json);
    process.exit(1);
  }
  const wo = generated.json as { id: string; status: string; wo_number: string };
  if (wo.status !== 'draft') {
    console.error('maint-pm-list-api: expected draft WO', wo);
    process.exit(1);
  }

  const draftList = await request(
    `/maintenance/pm/work-orders?plant_id=${encodeURIComponent(plantId)}&status=draft`,
    { headers: auth }
  );
  if (draftList.res.status !== 200) {
    console.error('maint-pm-list-api: draft WO list failed', draftList.res.status, draftList.json);
    process.exit(1);
  }
  const drafts = draftList.json as { id: string }[];
  if (!drafts.some((d) => d.id === wo.id)) {
    console.error('maint-pm-list-api: generated WO missing from draft list');
    process.exit(1);
  }

  const evaluate = await request(
    `/maintenance/pm/evaluate?plant_id=${encodeURIComponent(plantId)}`,
    { method: 'POST', headers: auth }
  );
  if (evaluate.res.status !== 200) {
    console.error('maint-pm-list-api: evaluate failed', evaluate.res.status, evaluate.json);
    process.exit(1);
  }

  console.log(
    `maint-pm-list-api: OK (activate + ${wo.wo_number} draft in list)`
  );
}

console.log('maint-pm-list-api: unit OK (list + Activate/Generate/evaluate)');
await apiSmoke();
