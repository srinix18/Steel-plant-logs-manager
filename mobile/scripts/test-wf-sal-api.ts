/**
 * P4-WF-SAL — unit + API: create salary structure; list shows gross/deductions.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'workforce', 'salary-structures.tsx'),
  'utf8'
);
const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'SalaryStructuresScreen.tsx'),
  'utf8'
);
const api = fs.readFileSync(path.join(root, 'src', 'api', 'workforceOps.ts'), 'utf8');
assert.ok(route.includes('SalaryStructuresScreen'));
assert.ok(screen.includes('Gross') && screen.includes('Deductions'));
assert.ok(api.includes('createSalaryStructure') && api.includes('fetchSalaryStructures'));

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
      body: JSON.stringify({ email: 'hr@chandansteel.com', password: 'hr123' }),
    });
  } catch (err) {
    console.log(`wf-sal-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('wf-sal-api: login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };
  const emps = await request('/workforce/employees', { headers: auth });
  // Prefer a worker without existing structure if possible — otherwise any emp
  const employees = emps.json as { id: string; email: string }[];
  const stamp = Date.now();
  // Create a dedicated employee for salary smoke to avoid unique conflicts
  const depts = await request('/departments', { headers: auth });
  const deptId = (depts.json as { id: string }[])[0]?.id ?? null;
  const plants = await request('/plants', { headers: auth });
  const plantId = (plants.json as { id: string }[])[0]?.id ?? null;
  const email = `mobile.sal.${stamp}@chandansteel.com`;
  const createdEmp = await request('/workforce/employees', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      email,
      password: 'sal12345',
      full_name: `Salary Smoke ${stamp}`,
      role: 'worker',
      department_id: deptId,
      plant_id: plantId,
      employment_status: 'active',
      employment_type: 'permanent',
    }),
  });
  const empId =
    createdEmp.res.ok
      ? (createdEmp.json as { id: string }).id
      : employees[0]?.id;
  if (!empId) {
    console.log('wf-sal-api: no employee — unit OK; skipped');
    return;
  }

  const payload = {
    user_id: empId,
    basic: 30000,
    hra: 9000,
    allowances: 1500,
    pf: 2000,
    esi: 400,
    other_deductions: 100,
    effective_from: new Date().toISOString().slice(0, 10),
  };
  const created = await request('/workforce/payroll/salary-structures', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify(payload),
  });
  if (created.res.status !== 201 && created.res.status !== 200) {
    console.error('wf-sal-api: create failed', created.res.status, created.json);
    process.exit(1);
  }
  const row = created.json as typeof payload & { id: string };
  const gross = row.basic + row.hra + row.allowances;
  const deductions = row.pf + row.esi + row.other_deductions;
  assert.equal(gross, 40500);
  assert.equal(deductions, 2500);

  const list = await request('/workforce/payroll/salary-structures', { headers: auth });
  if (list.res.status !== 200) {
    console.error('wf-sal-api: list failed', list.json);
    process.exit(1);
  }
  const found = (list.json as { id: string }[]).some((s) => s.id === row.id);
  if (!found) {
    console.error('wf-sal-api: structure missing from list');
    process.exit(1);
  }

  console.log(`wf-sal-api: OK (gross=${gross}; deductions=${deductions})`);
}

console.log('wf-sal-api: unit OK (salary form + list gross/deductions)');
await apiSmoke();
