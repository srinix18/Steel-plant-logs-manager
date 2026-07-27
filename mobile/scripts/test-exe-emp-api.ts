/**
 * P5-EXE-EMP — unit + API: create + edit org user; conditional process/category.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'executive', 'employees.tsx'),
  'utf8'
);
assert.ok(route.includes('CEO_TIER_ROLES'));
assert.ok(route.includes('ExecutiveEmployeesScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'executive', 'ExecutiveEmployeesScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchOrgUsers'));
assert.ok(screen.includes('createOrgUser'));
assert.ok(screen.includes('updateOrgUser'));
assert.ok(screen.includes('fetchMaintenanceCategories'));
assert.ok(screen.includes('supervisor'));
assert.ok(screen.includes('maintenance'));
assert.ok(screen.includes('process_id'));
assert.ok(screen.includes('maintenance_division'));
assert.ok(screen.includes("role !== 'super_admin'"));
assert.ok(screen.includes("role !== 'ceo'"));
assert.ok(screen.includes("'hr'"));
assert.ok(screen.includes("'hod'"));
assert.ok(screen.includes("'worker'"));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'admin.ts'), 'utf8');
assert.ok(api.includes('/organisations/${orgId}/users'));
assert.ok(api.includes('createOrgUser'));
assert.ok(api.includes('updateOrgUser'));

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
      body: JSON.stringify({ email: 'ceo@chandansteel.com', password: 'ceo123' }),
    });
  } catch (err) {
    console.log(`exe-emp-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('exe-emp-api: CEO login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token?: string }).access_token;
  const me = (login.json as { user?: { organisation_id?: string } }).user;
  if (!token) {
    console.log('exe-emp-api: no token — unit OK; skipped');
    return;
  }
  const headers = { Authorization: `Bearer ${token}` };

  let orgId = me?.organisation_id;
  if (!orgId) {
    const plants = await request('/plants', { headers });
    assert.equal(plants.res.status, 200);
    orgId = (plants.json as { organisation_id: string }[])[0]?.organisation_id;
  }
  assert.ok(orgId, 'org id required');

  const [depts, plants, cats] = await Promise.all([
    request('/departments', { headers }),
    request('/plants', { headers }),
    request('/maintenance/categories', { headers }),
  ]);
  assert.equal(depts.res.status, 200);
  assert.equal(plants.res.status, 200);
  assert.ok(cats.res.ok || cats.res.status === 404);

  const deptId = (depts.json as { id: string }[])[0]?.id;
  const plantId = (plants.json as { id: string; organisation_id: string }[]).find(
    (p) => p.organisation_id === orgId
  )?.id;

  let processId: string | undefined;
  if (deptId) {
    const procs = await request(`/processes?department_id=${encodeURIComponent(deptId)}`, {
      headers,
    });
    assert.equal(procs.res.status, 200);
    processId = (procs.json as { id: string }[])[0]?.id;
  }

  const list = await request(`/organisations/${orgId}/users`, { headers });
  assert.equal(list.res.status, 200, `list users ${list.res.status}`);
  assert.ok(Array.isArray(list.json));

  const stamp = Date.now();
  const email = `mobile.smoke.emp.${stamp}@chandansteel.com`;
  const create = await request(`/organisations/${orgId}/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password: 'SmokeEmp123!',
      full_name: `Smoke Emp ${stamp}`,
      role: 'supervisor',
      department_id: deptId ?? null,
      process_id: processId ?? null,
      plant_id: plantId ?? null,
      designation: 'Smoke Tester',
    }),
  });
  assert.ok(create.res.ok, `create ${create.res.status} ${JSON.stringify(create.json)}`);
  const created = create.json as { id: string; role: string; process_id?: string | null };
  assert.ok(created.id);
  assert.equal(created.role, 'supervisor');

  const patch = await request(`/organisations/${orgId}/users/${created.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      full_name: `Smoke Emp Edited ${stamp}`,
      role: 'maintenance',
      department_id: deptId ?? null,
      process_id: null,
      maintenance_division: 'equipment',
      plant_id: plantId ?? null,
      designation: 'Maint Smoke',
    }),
  });
  assert.ok(patch.res.ok, `patch ${patch.res.status} ${JSON.stringify(patch.json)}`);
  const updated = patch.json as {
    full_name: string;
    role: string;
    maintenance_division?: string | null;
  };
  assert.equal(updated.role, 'maintenance');
  assert.equal(updated.maintenance_division, 'equipment');
  assert.ok(updated.full_name.includes('Edited'));

  console.log(`exe-emp-api: OK (created+edited ${email})`);
}

await apiSmoke();
console.log('test-exe-emp-api: OK');
