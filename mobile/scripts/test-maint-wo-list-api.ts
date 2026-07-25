/**
 * P3-MAINT-WO-LIST — unit + API smoke: status filter + Start (accept→in_progress).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'maintenance', 'work-orders', 'index.tsx'),
  'utf8'
);
assert.ok(route.includes('MAINTENANCE_PM_VIEW_ROLES'));
assert.ok(route.includes('WorkOrdersScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const stub = fs.readFileSync(
  path.join(root, 'app', '(app)', 'maintenance', 'work-orders', '[id].tsx'),
  'utf8'
);
assert.ok(stub.includes('P3-MAINT-WO-EXEC'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'maintenance', 'WorkOrdersScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchWorkOrders'));
assert.ok(screen.includes('transitionWorkOrder'));
assert.ok(screen.includes('Assign'));
assert.ok(screen.includes('Accept'));
assert.ok(screen.includes('Start'));
assert.ok(screen.includes('waiting_parts'));
assert.ok(screen.includes('/(app)/maintenance/work-orders/'));
assert.ok(screen.includes("to_state: 'accepted'"));
assert.ok(screen.includes("to_state: 'in_progress'"));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'maintenancePm.ts'), 'utf8');
assert.ok(api.includes('/maintenance/pm/work-orders'));
assert.ok(api.includes('/transition'));

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
    console.log(`maint-wo-list-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('maint-wo-list-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const meRes = await request('/auth/me', { headers: auth });
  const me = meRes.res.ok ? (meRes.json as { plant_id?: string }) : {};
  const plantsRes = await request('/plants', { headers: auth });
  if (!plantsRes.res.ok) {
    console.error('maint-wo-list-api: plants failed', plantsRes.json);
    process.exit(1);
  }
  const plants = plantsRes.json as { id: string }[];
  const plantId = me.plant_id || plants[0]?.id;
  if (!plantId) {
    console.log('maint-wo-list-api: no plant — unit OK; skipped');
    return;
  }

  const created = await request('/maintenance/pm/work-orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      title: `Mobile WO list smoke ${Date.now()}`,
    }),
  });
  if (created.res.status !== 201 && created.res.status !== 200) {
    console.error('maint-wo-list-api: create WO failed', created.res.status, created.json);
    process.exit(1);
  }
  const wo = created.json as { id: string; status: string; wo_number: string };
  if (wo.status !== 'draft') {
    console.error('maint-wo-list-api: expected draft WO', wo);
    process.exit(1);
  }

  const draftList = await request(
    `/maintenance/pm/work-orders?plant_id=${encodeURIComponent(plantId)}&status=draft`,
    { headers: auth }
  );
  if (draftList.res.status !== 200) {
    console.error('maint-wo-list-api: draft filter failed', draftList.res.status, draftList.json);
    process.exit(1);
  }
  const drafts = draftList.json as { id: string }[];
  if (!drafts.some((d) => d.id === wo.id)) {
    console.error('maint-wo-list-api: created WO missing from draft filter', drafts.length);
    process.exit(1);
  }

  const assign = await request(`/maintenance/pm/work-orders/${wo.id}/transition`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ to_state: 'assigned' }),
  });
  if (assign.res.status !== 200) {
    console.error('maint-wo-list-api: assign failed', assign.res.status, assign.json);
    process.exit(1);
  }

  const accept = await request(`/maintenance/pm/work-orders/${wo.id}/transition`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ to_state: 'accepted' }),
  });
  if (accept.res.status !== 200) {
    console.error('maint-wo-list-api: accept failed', accept.res.status, accept.json);
    process.exit(1);
  }

  const start = await request(`/maintenance/pm/work-orders/${wo.id}/transition`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ to_state: 'in_progress' }),
  });
  if (start.res.status !== 200) {
    console.error('maint-wo-list-api: start failed', start.res.status, start.json);
    process.exit(1);
  }
  const started = start.json as { status: string };
  if (started.status !== 'in_progress') {
    console.error('maint-wo-list-api: expected in_progress', started);
    process.exit(1);
  }

  const detail = await request(`/maintenance/pm/work-orders/${wo.id}`, { headers: auth });
  if (detail.res.status !== 200) {
    console.error('maint-wo-list-api: get WO failed', detail.res.status, detail.json);
    process.exit(1);
  }

  console.log(`maint-wo-list-api: OK (${wo.wo_number} draft→assigned→accepted→in_progress)`);
}

console.log('maint-wo-list-api: unit OK (tabs + Assign/Accept/Start + exec link)');
await apiSmoke();
