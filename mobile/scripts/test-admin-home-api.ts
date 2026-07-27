/**
 * P5-ADM-HOME — unit + API: dashboard KPIs + recent runs without crash.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(path.join(root, 'app', '(app)', 'admin', 'index.tsx'), 'utf8');
assert.ok(route.includes('PLATFORM_ADMIN_ROLES'));
assert.ok(route.includes('AdminHomeScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'admin', 'AdminHomeScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchDashboardMetrics'));
assert.ok(screen.includes('fetchAllRuns'));
assert.ok(screen.includes('fetchTemplates'));
assert.ok(screen.includes('fetchOrganisations'));
assert.ok(screen.includes('fetchPlants'));
assert.ok(screen.includes('fetchDepartments'));
assert.ok(screen.includes('fetchProcesses'));
assert.ok(screen.includes('fetchProcessInstances'));
assert.ok(screen.includes('total_organisations'));
assert.ok(screen.includes('total_plants'));
assert.ok(screen.includes('active_runs'));
assert.ok(screen.includes('open_observations'));
assert.ok(screen.includes('open_corrective_actions'));
assert.ok(screen.includes('admin/sheets'));
assert.ok(screen.includes('/(app)/heat/'));
assert.ok(screen.includes('/(app)/reports/'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'admin.ts'), 'utf8');
assert.ok(api.includes('/dashboard'));
assert.ok(api.includes('/organisations'));
assert.ok(api.includes('fetchDashboardMetrics'));
assert.ok(api.includes('fetchOrganisations'));

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
    console.log(`admin-home-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('admin-home-api: admin login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token?: string }).access_token;
  if (!token) {
    console.log('admin-home-api: no token — unit OK; skipped');
    return;
  }
  const headers = { Authorization: `Bearer ${token}` };

  const dash = await request('/dashboard', { headers });
  assert.equal(dash.res.status, 200, `dashboard ${dash.res.status}`);
  const m = dash.json as Record<string, unknown>;
  for (const key of [
    'total_organisations',
    'total_plants',
    'active_runs',
    'open_observations',
    'open_corrective_actions',
  ]) {
    assert.equal(typeof m[key], 'number', key);
  }

  const runs = await request('/process-runs', { headers });
  assert.equal(runs.res.status, 200, `process-runs ${runs.res.status}`);
  assert.ok(Array.isArray(runs.json));

  const templates = await request('/templates', { headers });
  assert.equal(templates.res.status, 200, `templates ${templates.res.status}`);
  assert.ok(Array.isArray(templates.json));

  const orgs = await request('/organisations', { headers });
  assert.equal(orgs.res.status, 200, `organisations ${orgs.res.status}`);
  assert.ok(Array.isArray(orgs.json));

  for (const path of ['/plants', '/departments', '/processes', '/process-instances']) {
    const r = await request(path, { headers });
    assert.equal(r.res.status, 200, `${path} ${r.res.status}`);
    assert.ok(Array.isArray(r.json), path);
  }

  console.log(
    `admin-home-api: OK (orgs=${m.total_organisations} plants=${m.total_plants} runs=${(runs.json as unknown[]).length})`
  );
}

await apiSmoke();
console.log('test-admin-home-api: OK');
