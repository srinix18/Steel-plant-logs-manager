/**
 * P4-WF-DASH — unit + API smoke: workforce summary + ops summary (HR).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(path.join(root, 'app', '(app)', 'workforce', 'index.tsx'), 'utf8');
assert.ok(route.includes('WORKFORCE_DASHBOARD_ROLES'));
assert.ok(route.includes('WorkforceDashboardScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'WorkforceDashboardScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchWorkforceSummary'));
assert.ok(screen.includes('fetchWorkforceOpsSummary'));
assert.ok(screen.includes('DateTimeField'));
assert.ok(screen.includes('Pending leave'));
assert.ok(screen.includes('Certs expiring soon'));
assert.ok(screen.includes('Latest payroll'));
assert.ok(screen.includes('Employees present'));
assert.ok(screen.includes('Employees absent'));
assert.ok(screen.includes('half_day'));
assert.ok(screen.includes('leave'));
assert.ok(screen.includes('Departments'));
assert.ok(screen.includes('EmptyState'));
assert.ok(screen.includes('ErrorBanner'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'workforce.ts'), 'utf8');
assert.ok(api.includes('/workforce/summary'));
assert.ok(api.includes('attendance_date'));

const ops = fs.readFileSync(path.join(root, 'src', 'api', 'workforceOps.ts'), 'utf8');
assert.ok(ops.includes('/workforce/ops/summary'));
assert.ok(ops.includes('formatCurrency'));

const roles = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'workforceRoles.ts'),
  'utf8'
);
assert.ok(roles.includes('WORKFORCE_DASHBOARD_ROLES'));
assert.ok(roles.includes('HR_ROLES'));

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
    console.log(`wf-dash-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('wf-dash-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const date = todayIso();
  const summary = await request(
    `/workforce/summary?attendance_date=${encodeURIComponent(date)}`,
    { headers: auth }
  );
  if (summary.res.status !== 200) {
    console.error('wf-dash-api: summary failed', summary.res.status, summary.json);
    process.exit(1);
  }
  const s = summary.json as {
    employees_present?: number;
    employees_absent?: number;
    departments?: unknown[];
  };
  if (typeof s.employees_present !== 'number' || typeof s.employees_absent !== 'number') {
    console.error('wf-dash-api: summary missing present/absent', s);
    process.exit(1);
  }
  if (!Array.isArray(s.departments)) {
    console.error('wf-dash-api: departments not array', s);
    process.exit(1);
  }

  const opsRes = await request('/workforce/ops/summary', { headers: auth });
  if (opsRes.res.status !== 200) {
    console.error('wf-dash-api: ops summary failed', opsRes.res.status, opsRes.json);
    process.exit(1);
  }
  const opsJson = opsRes.json as {
    pending_leave_requests?: number;
    certifications_expiring_soon?: number;
  };
  if (
    typeof opsJson.pending_leave_requests !== 'number' ||
    typeof opsJson.certifications_expiring_soon !== 'number'
  ) {
    console.error('wf-dash-api: ops summary shape', opsJson);
    process.exit(1);
  }

  console.log(
    `wf-dash-api: OK (HR summary ${date}: present=${s.employees_present} depts=${s.departments.length}; pending leave=${opsJson.pending_leave_requests})`
  );
}

console.log('wf-dash-api: unit OK (dashboard + date + ops wiring)');
await apiSmoke();
