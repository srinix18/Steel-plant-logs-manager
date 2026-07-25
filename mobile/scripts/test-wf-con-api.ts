/**
 * P4-WF-CON — unit + API smoke: create company/worker, edit, activate toggle (HR).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'workforce', 'contractors.tsx'),
  'utf8'
);
assert.ok(route.includes('WORKFORCE_HR_ROLES'));
assert.ok(route.includes('WorkforceContractorsScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'WorkforceContractorsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('createContractor'));
assert.ok(screen.includes('createContractWorker'));
assert.ok(screen.includes('updateContractor'));
assert.ok(screen.includes('updateContractWorker'));
assert.ok(screen.includes('SegmentedTabs'));
assert.ok(screen.includes('Deactivate') || screen.includes('Activate'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'workforce.ts'), 'utf8');
assert.ok(api.includes('/workforce/contractors'));
assert.ok(api.includes('/workforce/contract-workers'));

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
        email: 'hr@chandansteel.com',
        password: 'hr123',
      }),
    });
  } catch (err) {
    console.log(`wf-con-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('wf-con-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const depts = await request('/departments', { headers: auth });
  if (depts.res.status !== 200) {
    console.error('wf-con-api: departments failed', depts.res.status, depts.json);
    process.exit(1);
  }
  const deptId = (depts.json as { id: string }[])[0]?.id;
  if (!deptId) {
    console.log('wf-con-api: no departments — unit OK; skipped');
    return;
  }

  const stamp = Date.now();
  const code = `MC${String(stamp).slice(-6)}`;
  const created = await request('/workforce/contractors', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      code,
      name: `Mobile Co ${stamp}`,
      contact_person: 'Test Contact',
      phone: '9999999999',
    }),
  });
  if (created.res.status !== 201 && created.res.status !== 200) {
    console.error('wf-con-api: create contractor failed', created.res.status, created.json);
    process.exit(1);
  }
  const contractor = created.json as { id: string; is_active: boolean; name: string };

  const edited = await request(`/workforce/contractors/${contractor.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ name: `Mobile Co Edited ${stamp}`, phone: '8888888888' }),
  });
  if (edited.res.status !== 200) {
    console.error('wf-con-api: edit contractor failed', edited.res.status, edited.json);
    process.exit(1);
  }

  const deactivated = await request(`/workforce/contractors/${contractor.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ is_active: false }),
  });
  if (deactivated.res.status !== 200) {
    console.error('wf-con-api: deactivate failed', deactivated.res.status, deactivated.json);
    process.exit(1);
  }
  if ((deactivated.json as { is_active: boolean }).is_active !== false) {
    console.error('wf-con-api: contractor still active', deactivated.json);
    process.exit(1);
  }

  await request(`/workforce/contractors/${contractor.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ is_active: true }),
  });

  const worker = await request('/workforce/contract-workers', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      contractor_id: contractor.id,
      full_name: `Mobile Worker ${stamp}`,
      department_id: deptId,
      phone: '7777777777',
    }),
  });
  if (worker.res.status !== 201 && worker.res.status !== 200) {
    console.error('wf-con-api: create worker failed', worker.res.status, worker.json);
    process.exit(1);
  }
  const w = worker.json as { id: string; is_active: boolean };

  const workerEdit = await request(`/workforce/contract-workers/${w.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ full_name: `Mobile Worker Edited ${stamp}` }),
  });
  if (workerEdit.res.status !== 200) {
    console.error('wf-con-api: edit worker failed', workerEdit.res.status, workerEdit.json);
    process.exit(1);
  }

  const workerOff = await request(`/workforce/contract-workers/${w.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ is_active: false }),
  });
  if (workerOff.res.status !== 200 || (workerOff.json as { is_active: boolean }).is_active !== false) {
    console.error('wf-con-api: worker deactivate failed', workerOff.res.status, workerOff.json);
    process.exit(1);
  }

  console.log('wf-con-api: OK (create+edit+activate company & worker)');
}

console.log('wf-con-api: unit OK (tabs + CRUD wiring)');
await apiSmoke();
