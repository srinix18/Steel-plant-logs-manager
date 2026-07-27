/**
 * P5-ADM-USERS — unit + API: list-only GET /users + organisations.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(path.join(root, 'app', '(app)', 'admin', 'users.tsx'), 'utf8');
assert.ok(route.includes('PLATFORM_ADMIN_ROLES'));
assert.ok(route.includes('AdminUsersScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'admin', 'AdminUsersScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchUsers'));
assert.ok(screen.includes('fetchOrganisations'));
assert.ok(screen.includes('full_name'));
assert.ok(screen.includes('email'));
assert.ok(screen.includes('role'));
assert.ok(screen.includes('organisation_id'));
assert.ok(screen.includes('P5-EXE-EMP') || screen.includes('Executive'));
assert.ok(!screen.includes('createUser'));
assert.ok(!screen.includes('POST'));
assert.ok(!screen.includes('PATCH'));
assert.ok(!screen.includes('DELETE'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'admin.ts'), 'utf8');
assert.ok(api.includes("get<User[]>('/users')") || api.includes("'/users'"));
assert.ok(api.includes('fetchUsers'));

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
      body: JSON.stringify({ email: 'admin@logbook.app', password: 'admin123' }),
    });
  } catch (err) {
    console.log(`admin-users-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('admin-users-api: admin login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token?: string }).access_token;
  if (!token) {
    console.log('admin-users-api: no token — unit OK; skipped');
    return;
  }
  const headers = { Authorization: `Bearer ${token}` };

  const users = await request('/users', { headers });
  assert.equal(users.res.status, 200, `users ${users.res.status}`);
  assert.ok(Array.isArray(users.json));
  for (const u of (users.json as { full_name?: string; email?: string; role?: string }[]).slice(
    0,
    5
  )) {
    assert.ok(typeof u.full_name === 'string');
    assert.ok(typeof u.email === 'string');
    assert.ok(typeof u.role === 'string');
  }

  const orgs = await request('/organisations', { headers });
  assert.equal(orgs.res.status, 200);
  assert.ok(Array.isArray(orgs.json));

  console.log(`admin-users-api: OK (users=${(users.json as unknown[]).length})`);
}

await apiSmoke();
console.log('test-admin-users-api: OK');
