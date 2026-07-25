/**
 * P4-WF-MY-PAY — unit + API: payslips/mine; HTML GET when a slip exists (empty OK).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'workforce', 'my-payslips.tsx'),
  'utf8'
);
assert.ok(route.includes('WORKER_ROLES'));
assert.ok(route.includes('MyPayslipsScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'MyPayslipsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchMyPayslips'));
assert.ok(screen.includes('fetchPayslipHtml'));
assert.ok(screen.includes('formatCurrency'));
assert.ok(screen.includes('View HTML'));
assert.ok(screen.includes('payable_days') || screen.includes('Payable days'));
assert.ok(screen.includes('gross_salary') || screen.includes('Gross'));
assert.ok(screen.includes('net_salary') || screen.includes('Net'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'workforceOps.ts'), 'utf8');
assert.ok(api.includes('/workforce/payroll/payslips/mine'));
assert.ok(api.includes('fetchMyPayslips'));
assert.ok(api.includes('fetchPayslipHtml'));

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
  return { res, json, text };
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
    console.log(`wf-my-pay-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('wf-my-pay-api: worker login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const mine = await request('/workforce/payroll/payslips/mine', { headers: auth });
  if (mine.res.status !== 200) {
    console.error('wf-my-pay-api: mine failed', mine.json);
    process.exit(1);
  }
  assert.ok(Array.isArray(mine.json));
  const list = mine.json as {
    id: string;
    payable_days: number;
    gross_salary: number;
    net_salary: number;
  }[];

  if (list.length === 0) {
    console.log('wf-my-pay-api: OK (empty payslips list allowed)');
    return;
  }

  const first = list[0];
  assert.ok(typeof first.payable_days === 'number');
  assert.ok(typeof first.gross_salary === 'number');
  assert.ok(typeof first.net_salary === 'number');

  const htmlRes = await fetch(`${API_URL}/workforce/payroll/payslips/${first.id}`, {
    headers: {
      Accept: 'text/html, application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const html = await htmlRes.text();
  if (!htmlRes.ok) {
    console.error('wf-my-pay-api: HTML GET failed', htmlRes.status, html.slice(0, 200));
    process.exit(1);
  }
  assert.ok(html.length > 0, 'HTML body empty');
  assert.ok(
    /html|payslip|salary|gross|net/i.test(html),
    'HTML does not look like a payslip document'
  );

  console.log(
    `wf-my-pay-api: OK (mine=${list.length}; HTML GET ${html.length} chars for ${first.id})`
  );
}

console.log('wf-my-pay-api: unit OK (list + View HTML)');
await apiSmoke();
