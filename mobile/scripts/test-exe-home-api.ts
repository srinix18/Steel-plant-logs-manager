/**
 * P5-EXE-HOME — unit + API: dashboard metrics, open maint count/issues, recent runs.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'executive', 'index.tsx'),
  'utf8'
);
assert.ok(route.includes('CEO_TIER_ROLES'));
assert.ok(route.includes('ExecutiveOverviewScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'executive', 'ExecutiveOverviewScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchDashboardMetrics'));
assert.ok(screen.includes('fetchAllRuns'));
assert.ok(screen.includes('fetchOpenMaintenanceCount'));
assert.ok(screen.includes('fetchMaintenanceIssues'));
assert.ok(screen.includes("status: 'open'"));
assert.ok(screen.includes('openMaintCount'));
assert.ok(screen.includes('slice(0, 10)'));
assert.ok(screen.includes('slice(0, 8)'));
assert.ok(screen.includes('/(app)/reports/'));
assert.ok(screen.includes('total_plants'));
assert.ok(screen.includes('active_runs'));

const maintApi = fs.readFileSync(path.join(root, 'src', 'api', 'maintenance.ts'), 'utf8');
assert.ok(maintApi.includes('/maintenance/issues/open-count'));
assert.ok(maintApi.includes('fetchOpenMaintenanceCount'));

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
    console.log(`exe-home-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('exe-home-api: CEO login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token?: string }).access_token;
  if (!token) {
    console.log('exe-home-api: no token — unit OK; skipped');
    return;
  }
  const headers = { Authorization: `Bearer ${token}` };

  const dash = await request('/dashboard', { headers });
  assert.equal(dash.res.status, 200, `dashboard ${dash.res.status}`);
  const m = dash.json as Record<string, unknown>;
  for (const key of [
    'total_plants',
    'active_runs',
    'open_observations',
    'open_corrective_actions',
  ]) {
    assert.equal(typeof m[key], 'number', key);
  }

  const runs = await request('/process-runs', { headers });
  assert.equal(runs.res.status, 200);
  assert.ok(Array.isArray(runs.json));

  const count = await request('/maintenance/issues/open-count', { headers });
  assert.equal(count.res.status, 200, `open-count ${count.res.status}`);
  assert.equal(typeof (count.json as { count?: number }).count, 'number');

  const issues = await request('/maintenance/issues?status=open', { headers });
  assert.equal(issues.res.status, 200);
  assert.ok(Array.isArray(issues.json));
  for (const issue of (issues.json as { title?: string; category?: string; status?: string }[]).slice(
    0,
    3
  )) {
    assert.ok(typeof issue.title === 'string');
    assert.ok(typeof issue.category === 'string');
    assert.ok(typeof issue.status === 'string');
  }

  for (const p of ['/plants', '/departments', '/processes', '/process-instances']) {
    const r = await request(p, { headers });
    assert.equal(r.res.status, 200, p);
    assert.ok(Array.isArray(r.json), p);
  }

  console.log(
    `exe-home-api: OK (plants=${m.total_plants} active=${m.active_runs} maint=${(count.json as { count: number }).count} runs=${(runs.json as unknown[]).length})`
  );
}

await apiSmoke();
console.log('test-exe-home-api: OK');
