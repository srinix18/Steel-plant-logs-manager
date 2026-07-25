/**
 * P3-SAFE-DASH — unit + API smoke: GET /safety/dashboard/{plantId} 200.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(path.join(root, 'app', '(app)', 'safety', 'dashboard.tsx'), 'utf8');
assert.ok(route.includes('SafetyDashboardScreen'));
assert.ok(route.includes('SAFETY_MODULE_ROLES'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'safety', 'SafetyDashboardScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchSafetyDashboard'));
assert.ok(screen.includes('Under Maintenance'));
assert.ok(screen.includes('Unsafe Assets'));
assert.ok(screen.includes('Expired Certs'));
assert.ok(screen.includes('Inspection Due'));
assert.ok(screen.includes('Recent Incidents'));
assert.ok(screen.includes('Emergency Contacts'));
assert.ok(screen.includes('/(app)/safety/scan'));
assert.ok(screen.includes('/(app)/safety/inspections'));
assert.ok(screen.includes('/(app)/safety/sops'));
assert.ok(screen.includes('/(app)/safety/incidents'));

const indexRoute = fs.readFileSync(path.join(root, 'app', '(app)', 'safety', 'index.tsx'), 'utf8');
assert.ok(indexRoute.includes('/safety/dashboard'));

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
        email: 'melter@chandansteel.com',
        password: 'worker123',
      }),
    });
  } catch (err) {
    console.log(`safety-dashboard-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('safety-dashboard-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const meRes = await request('/auth/me', { headers: auth });
  const me = meRes.res.ok ? (meRes.json as { plant_id?: string }) : {};
  const plantsRes = await request('/plants', { headers: auth });
  if (!plantsRes.res.ok) {
    console.error('safety-dashboard-api: plants failed', plantsRes.json);
    process.exit(1);
  }
  const plants = plantsRes.json as { id: string }[];
  const plantId = me.plant_id || plants[0]?.id;
  if (!plantId) {
    console.log('safety-dashboard-api: no plant — unit OK; skipped');
    return;
  }

  const dash = await request(`/safety/dashboard/${plantId}`, { headers: auth });
  if (dash.res.status !== 200) {
    console.error('safety-dashboard-api: dashboard not 200', dash.res.status, dash.json);
    process.exit(1);
  }
  const body = dash.json as {
    assets_under_maintenance?: number;
    unsafe_assets?: number;
    expired_certifications?: number;
    inspection_due?: number;
    recent_incidents?: unknown[];
    emergency_contacts?: unknown[];
  };
  for (const key of [
    'assets_under_maintenance',
    'unsafe_assets',
    'expired_certifications',
    'inspection_due',
  ] as const) {
    if (typeof body[key] !== 'number') {
      console.error(`safety-dashboard-api: missing KPI ${key}`, body);
      process.exit(1);
    }
  }
  if (!Array.isArray(body.recent_incidents)) {
    console.error('safety-dashboard-api: recent_incidents not array', body);
    process.exit(1);
  }
  if (!Array.isArray(body.emergency_contacts)) {
    console.error('safety-dashboard-api: emergency_contacts not array', body);
    process.exit(1);
  }
  console.log(
    `safety-dashboard-api: ok (GET 200; KPIs + incidents=${body.recent_incidents.length} contacts=${body.emergency_contacts.length})`
  );
}

await apiSmoke();
console.log('safety-dashboard-api: unit OK (4 KPIs + links wiring)');
