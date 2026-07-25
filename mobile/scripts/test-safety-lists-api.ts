/**
 * P3-SAFE-LISTS — unit + API smoke for inspections / SOPs / incidents GET lists.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const leaf of ['inspections', 'sops', 'incidents'] as const) {
  const route = fs.readFileSync(path.join(root, 'app', '(app)', 'safety', `${leaf}.tsx`), 'utf8');
  assert.ok(route.includes('SAFETY_MODULE_ROLES'), `${leaf} role gate`);
  assert.ok(!route.includes('RoleHomePlaceholder'), `${leaf} not stub`);
}

assert.ok(
  fs.existsSync(path.join(root, 'src', 'features', 'safety', 'SafetyInspectionsScreen.tsx'))
);
assert.ok(fs.existsSync(path.join(root, 'src', 'features', 'safety', 'SafetySopsScreen.tsx')));
assert.ok(fs.existsSync(path.join(root, 'src', 'features', 'safety', 'SafetyIncidentsScreen.tsx')));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'safety.ts'), 'utf8');
assert.ok(api.includes('fetchSafetyInspections'));
assert.ok(api.includes('fetchSafetySops'));
assert.ok(api.includes('fetchSafetyIncidents'));
assert.ok(api.includes('/safety/inspections/'));
assert.ok(api.includes('/safety/sops/'));
assert.ok(api.includes('/safety/incidents/'));

const dash = fs.readFileSync(
  path.join(root, 'src', 'features', 'safety', 'SafetyDashboardScreen.tsx'),
  'utf8'
);
assert.ok(dash.includes('/(app)/safety/inspections'));
assert.ok(dash.includes('/(app)/safety/sops'));
assert.ok(dash.includes('/(app)/safety/incidents'));

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
    console.log(`safety-lists-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('safety-lists-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const meRes = await request('/auth/me', { headers: auth });
  const me = meRes.res.ok ? (meRes.json as { plant_id?: string }) : {};
  const plantsRes = await request('/plants', { headers: auth });
  const plants = plantsRes.res.ok ? (plantsRes.json as { id: string }[]) : [];
  const plantId = me.plant_id || plants[0]?.id;
  if (!plantId) {
    console.log('safety-lists-api: no plant — unit OK; skipped');
    return;
  }

  for (const [label, pathSuffix] of [
    ['inspections', `/safety/inspections/${plantId}`],
    ['sops', `/safety/sops/${plantId}`],
    ['incidents', `/safety/incidents/${plantId}`],
  ] as const) {
    const res = await request(pathSuffix, { headers: auth });
    if (!res.res.ok) {
      console.error(`safety-lists-api: ${label} failed`, res.res.status, res.json);
      process.exit(1);
    }
    if (!Array.isArray(res.json)) {
      console.error(`safety-lists-api: ${label} not array`, res.json);
      process.exit(1);
    }
    console.log(`ok  ${label} → ${(res.json as unknown[]).length} row(s)`);
  }

  console.log(`safety-lists-api: ok (GET lists for plant ${plantId})`);
}

await apiSmoke();
console.log('safety-lists-api: unit OK (3 list routes + GET wiring)');
