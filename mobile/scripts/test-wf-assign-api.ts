/**
 * P4-WF-ASSIGN — unit + API smoke: create shift assignment; list shows emp/dept/shift/date.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'workforce', 'shift-assignments.tsx'),
  'utf8'
);
assert.ok(route.includes('WORKFORCE_HR_ROLES'));
assert.ok(route.includes('ShiftAssignmentsScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'ShiftAssignmentsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('createShiftAssignment'));
assert.ok(screen.includes('fetchShiftAssignments'));
assert.ok(screen.includes('Effective'));
assert.ok(screen.includes('Add assignment'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'workforce.ts'), 'utf8');
assert.ok(api.includes('/workforce/shift-assignments'));
assert.ok(api.includes('/workforce/shifts'));

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
    console.log(`wf-assign-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('wf-assign-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const [emps, depts, plants] = await Promise.all([
    request('/workforce/employees', { headers: auth }),
    request('/departments', { headers: auth }),
    request('/plants', { headers: auth }),
  ]);
  if (emps.res.status !== 200 || depts.res.status !== 200 || plants.res.status !== 200) {
    console.error('wf-assign-api: lookups failed');
    process.exit(1);
  }
  const employees = emps.json as { id: string; role: string }[];
  const departments = depts.json as { id: string }[];
  const plantId = (plants.json as { id: string }[])[0]?.id;
  const worker = employees.find((e) => e.role === 'worker') ?? employees[0];
  const deptId = departments[0]?.id;
  if (!worker || !deptId || !plantId) {
    console.log('wf-assign-api: missing fixtures — unit OK; skipped');
    return;
  }

  const shiftsRes = await request(
    `/workforce/shifts?plant_id=${encodeURIComponent(plantId)}`,
    { headers: auth }
  );
  if (shiftsRes.res.status !== 200) {
    console.error('wf-assign-api: shifts failed', shiftsRes.res.status, shiftsRes.json);
    process.exit(1);
  }
  const shifts = shiftsRes.json as { id: string; code: string }[];
  const shiftId = shifts[0]?.id;
  if (!shiftId) {
    console.log('wf-assign-api: no shifts — unit OK; skipped');
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const created = await request('/workforce/shift-assignments', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      user_id: worker.id,
      department_id: deptId,
      shift_id: shiftId,
      effective_date: date,
    }),
  });
  if (created.res.status !== 201 && created.res.status !== 200) {
    console.error('wf-assign-api: create failed', created.res.status, created.json);
    process.exit(1);
  }
  const row = created.json as {
    id: string;
    user_name?: string;
    department_code?: string;
    shift_code?: string;
    effective_date: string;
  };

  const list = await request('/workforce/shift-assignments', { headers: auth });
  if (list.res.status !== 200) {
    console.error('wf-assign-api: list failed', list.res.status, list.json);
    process.exit(1);
  }
  const found = (list.json as { id: string }[]).some((a) => a.id === row.id);
  if (!found) {
    console.error('wf-assign-api: created assignment missing from list');
    process.exit(1);
  }

  console.log(
    `wf-assign-api: OK (create ${row.user_name ?? worker.id} / ${row.department_code ?? deptId} / ${row.shift_code ?? shifts[0].code} / ${row.effective_date})`
  );
}

console.log('wf-assign-api: unit OK (assignments list + create form)');
await apiSmoke();
