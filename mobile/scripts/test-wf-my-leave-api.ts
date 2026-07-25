/**
 * P4-WF-MY-LEAVE — unit + API: worker apply leave; pending appears in /requests/mine.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'workforce', 'my-leave.tsx'),
  'utf8'
);
assert.ok(route.includes('WORKER_ROLES'));
assert.ok(route.includes('MyLeaveScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'MyLeaveScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('createLeaveRequest'));
assert.ok(screen.includes('fetchMyLeaveRequests'));
assert.ok(screen.includes('fetchLeaveTypes'));
assert.ok(screen.includes('Apply for leave'));
assert.ok(screen.includes('Remarks'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'workforceOps.ts'), 'utf8');
assert.ok(api.includes('/workforce/leave/requests/mine'));
assert.ok(api.includes('fetchMyLeaveRequests'));

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
    console.log(`wf-my-leave-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('wf-my-leave-api: worker login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const types = await request('/workforce/leave/types', { headers: auth });
  if (types.res.status !== 200) {
    console.error('wf-my-leave-api: types failed', types.json);
    process.exit(1);
  }
  const typeId = (types.json as { id: string }[])[0]?.id;
  if (!typeId) {
    console.log('wf-my-leave-api: no leave types — unit OK; skipped');
    return;
  }

  const from = new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10);
  const remarks = `mobile my-leave smoke ${Date.now()}`;
  const created = await request('/workforce/leave/requests', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      leave_type_id: typeId,
      from_date: from,
      to_date: from,
      remarks,
    }),
  });
  if (!created.res.ok) {
    console.error('wf-my-leave-api: create failed', created.res.status, created.json);
    process.exit(1);
  }
  const id = (created.json as { id: string; status: string }).id;
  assert.equal((created.json as { status: string }).status, 'pending');

  const mine = await request('/workforce/leave/requests/mine', { headers: auth });
  if (mine.res.status !== 200) {
    console.error('wf-my-leave-api: mine failed', mine.json);
    process.exit(1);
  }
  const found = (mine.json as { id: string; status: string; remarks?: string }[]).find(
    (r) => r.id === id
  );
  if (!found || found.status !== 'pending') {
    console.error('wf-my-leave-api: pending request missing from mine', found);
    process.exit(1);
  }

  console.log(`wf-my-leave-api: OK (apply → pending in mine; remarks=${!!found.remarks})`);
}

console.log('wf-my-leave-api: unit OK (apply form + mine list)');
await apiSmoke();
