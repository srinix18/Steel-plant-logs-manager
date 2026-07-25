/**
 * P4-WF-EMP — unit + API smoke: employees list, create, patch (HR).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'workforce', 'employees.tsx'),
  'utf8'
);
assert.ok(route.includes('WORKFORCE_ADMIN_ROLES'));
assert.ok(route.includes('WorkforceEmployeesScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'WorkforceEmployeesScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchWorkforceEmployees'));
assert.ok(screen.includes('createWorkforceEmployee'));
assert.ok(screen.includes('updateWorkforceEmployee'));
assert.ok(screen.includes('EmployeeFormPanel'));
assert.ok(screen.includes('Add employee'));

const form = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'EmployeeFormPanel.tsx'),
  'utf8'
);
assert.ok(form.includes("role === 'supervisor'"));
assert.ok(form.includes("role === 'maintenance'"));
assert.ok(form.includes('Process / log sheet'));
assert.ok(form.includes('Maintenance category'));
assert.ok(form.includes('fetchMaintenanceCategories'));
assert.ok(form.includes('New password (optional)'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'workforce.ts'), 'utf8');
assert.ok(api.includes('/workforce/employees'));
assert.ok(api.includes('createWorkforceEmployee'));
assert.ok(api.includes('updateWorkforceEmployee'));

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
    console.log(`wf-emp-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('wf-emp-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const list = await request('/workforce/employees', { headers: auth });
  if (list.res.status !== 200) {
    console.error('wf-emp-api: list failed', list.res.status, list.json);
    process.exit(1);
  }
  if (!Array.isArray(list.json)) {
    console.error('wf-emp-api: list not array', list.json);
    process.exit(1);
  }

  const depts = await request('/departments', { headers: auth });
  if (depts.res.status !== 200) {
    console.error('wf-emp-api: departments failed', depts.res.status, depts.json);
    process.exit(1);
  }
  const departments = depts.json as { id: string; plant_id?: string }[];
  const deptId = departments[0]?.id ?? null;
  let plantId = departments[0]?.plant_id ?? null;
  if (!plantId) {
    const plants = await request('/plants', { headers: auth });
    if (plants.res.status === 200) {
      plantId = (plants.json as { id: string }[])[0]?.id ?? null;
    }
  }

  const cats = await request('/maintenance/categories', { headers: auth });
  if (cats.res.status !== 200) {
    console.error('wf-emp-api: categories failed', cats.res.status, cats.json);
    process.exit(1);
  }

  const stamp = Date.now();
  const email = `mobile.emp.${stamp}@chandansteel.com`;
  const created = await request('/workforce/employees', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      email,
      password: 'emp12345',
      full_name: `Mobile Emp ${stamp}`,
      role: 'worker',
      department_id: deptId,
      plant_id: plantId,
      employment_status: 'active',
      employment_type: 'permanent',
      process_id: null,
      maintenance_division: null,
    }),
  });
  if (created.res.status !== 201 && created.res.status !== 200) {
    console.error('wf-emp-api: create failed', created.res.status, created.json);
    process.exit(1);
  }
  const emp = created.json as { id: string; full_name: string; role: string };

  const patched = await request(`/workforce/employees/${emp.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      full_name: `Mobile Emp Edited ${stamp}`,
      designation: 'Melter helper',
      role: 'worker',
      process_id: null,
      maintenance_division: null,
    }),
  });
  if (patched.res.status !== 200) {
    console.error('wf-emp-api: patch failed', patched.res.status, patched.json);
    process.exit(1);
  }
  const updated = patched.json as { full_name: string; designation?: string };
  if (!updated.full_name.includes('Edited')) {
    console.error('wf-emp-api: patch did not update name', updated);
    process.exit(1);
  }

  let processId: string | null = null;
  if (deptId) {
    const procs = await request(
      `/processes?department_id=${encodeURIComponent(deptId)}`,
      { headers: auth }
    );
    if (procs.res.status === 200) {
      const list = procs.json as { id: string }[];
      processId = list[0]?.id ?? null;
    }
  }

  if (processId) {
    const asSuper = await request(`/workforce/employees/${emp.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({
        role: 'supervisor',
        department_id: deptId,
        process_id: processId,
        maintenance_division: null,
      }),
    });
    if (asSuper.res.status !== 200) {
      console.error('wf-emp-api: supervisor patch failed', asSuper.res.status, asSuper.json);
      process.exit(1);
    }
  }

  const maint = await request(`/workforce/employees/${emp.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      role: 'maintenance',
      department_id: deptId,
      plant_id: plantId,
      process_id: null,
      maintenance_division: 'equipment',
    }),
  });
  if (maint.res.status !== 200) {
    console.error('wf-emp-api: maintenance role patch failed', maint.res.status, maint.json);
    process.exit(1);
  }
  const maintUser = maint.json as { role: string; maintenance_division?: string };
  if (maintUser.role !== 'maintenance' || maintUser.maintenance_division !== 'equipment') {
    console.error('wf-emp-api: maintenance fields not set', maintUser);
    process.exit(1);
  }

  console.log(
    `wf-emp-api: OK (list=${(list.json as unknown[]).length}; create+edit+conditionals${processId ? '+supervisor process' : ''})`
  );
}

console.log('wf-emp-api: unit OK (employees list + form conditionals)');
await apiSmoke();
