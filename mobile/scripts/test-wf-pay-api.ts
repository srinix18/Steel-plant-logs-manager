/**
 * P4-WF-PAY — unit + API: ensure salary structure, create run, process, line items.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(path.join(root, 'app', '(app)', 'workforce', 'payroll.tsx'), 'utf8');
const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'PayrollScreen.tsx'),
  'utf8'
);
const api = fs.readFileSync(path.join(root, 'src', 'api', 'workforceOps.ts'), 'utf8');
assert.ok(route.includes('PayrollScreen'));
assert.ok(screen.includes('No salary structures') && screen.includes('processPayrollRun'));
assert.ok(screen.includes('Gross') && screen.includes('Net'));
assert.ok(api.includes('createPayrollRun') && api.includes('fetchPayrollLineItems'));

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
    console.log(`wf-pay-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('wf-pay-api: login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const plants = await request('/plants', { headers: auth });
  const plantId = (plants.json as { id: string }[])[0]?.id;
  if (!plantId) {
    console.log('wf-pay-api: no plant — unit OK; skipped');
    return;
  }

  let structures = await request('/workforce/payroll/salary-structures', { headers: auth });
  let salaryCount = Array.isArray(structures.json) ? (structures.json as unknown[]).length : 0;
  if (salaryCount === 0) {
    const emps = await request('/workforce/employees', { headers: auth });
    const empId = (emps.json as { id: string }[])[0]?.id;
    if (empId) {
      await request('/workforce/payroll/salary-structures', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          user_id: empId,
          basic: 25000,
          hra: 8000,
          allowances: 2000,
          pf: 1800,
          esi: 500,
          other_deductions: 200,
          effective_from: new Date().toISOString().slice(0, 10),
        }),
      });
      structures = await request('/workforce/payroll/salary-structures', { headers: auth });
      salaryCount = Array.isArray(structures.json) ? (structures.json as unknown[]).length : 0;
    }
  }

  const now = new Date();
  // Use next month to reduce collision with existing runs
  let month = now.getMonth() + 2;
  let year = now.getFullYear();
  if (month > 12) {
    month = 1;
    year += 1;
  }

  const created = await request('/workforce/payroll/runs', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ plant_id: plantId, month, year }),
  });
  if (created.res.status !== 201 && created.res.status !== 200) {
    // Duplicate period may 400 — try far future
    const alt = await request('/workforce/payroll/runs', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ plant_id: plantId, month: 12, year: year + 5 }),
    });
    if (alt.res.status !== 201 && alt.res.status !== 200) {
      console.error('wf-pay-api: create run failed', created.res.status, created.json, alt.json);
      process.exit(1);
    }
    Object.assign(created, alt);
  }
  const run = created.json as { id: string; status: string };

  const processed = await request(`/workforce/payroll/runs/${run.id}/process`, {
    method: 'POST',
    headers: auth,
  });
  if (!processed.res.ok) {
    console.error('wf-pay-api: process failed', processed.res.status, processed.json);
    process.exit(1);
  }

  const lines = await request(`/workforce/payroll/runs/${run.id}/line-items`, { headers: auth });
  if (lines.res.status !== 200 || !Array.isArray(lines.json)) {
    console.error('wf-pay-api: line-items failed', lines.res.status, lines.json);
    process.exit(1);
  }
  const items = lines.json as {
    payable_days: number;
    gross_salary: number;
    deductions: number;
    net_salary: number;
  }[];
  if (salaryCount > 0 && items.length === 0) {
    console.error('wf-pay-api: expected line items when structures exist');
    process.exit(1);
  }
  if (items[0]) {
    assert.ok(typeof items[0].payable_days === 'number');
    assert.ok(typeof items[0].gross_salary === 'number');
    assert.ok(typeof items[0].net_salary === 'number');
  }

  console.log(
    `wf-pay-api: OK (structures=${salaryCount}; lines=${items.length}; status=${(processed.json as { status: string }).status})`
  );
}

console.log('wf-pay-api: unit OK (payroll screen + APIs)');
await apiSmoke();
