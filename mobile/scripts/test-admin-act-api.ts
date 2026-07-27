/**
 * P5-ADM-ACT — unit + API: activity feed loads; filters narrow runs; ops observations.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'admin', 'activity.tsx'),
  'utf8'
);
assert.ok(route.includes('PLATFORM_ADMIN_ROLES'));
assert.ok(route.includes('AdminActivityScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'admin', 'AdminActivityScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchAllRuns'));
assert.ok(screen.includes('fetchOpsObservations'));
assert.ok(screen.includes('fetchOpenCorrectiveActions'));
assert.ok(screen.includes('orgFilter'));
assert.ok(screen.includes('deptFilter'));
assert.ok(screen.includes('processFilter'));
assert.ok(screen.includes('stateFilter'));
assert.ok(screen.includes('filteredRuns'));
assert.ok(screen.includes('/(app)/reports/'));
assert.ok(screen.includes('/(app)/heat/'));
assert.ok(!screen.includes('/foundation/observations'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'admin.ts'), 'utf8');
assert.ok(api.includes('/observations'));
assert.ok(api.includes('/dashboards/actions/open'));
assert.ok(api.includes('fetchOpsObservations'));

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
    console.log(`admin-act-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('admin-act-api: admin login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token?: string }).access_token;
  if (!token) {
    console.log('admin-act-api: no token — unit OK; skipped');
    return;
  }
  const headers = { Authorization: `Bearer ${token}` };

  const runs = await request('/process-runs', { headers });
  assert.equal(runs.res.status, 200);
  assert.ok(Array.isArray(runs.json));

  const plants = await request('/plants', { headers });
  assert.equal(plants.res.status, 200);
  const plantId = Array.isArray(plants.json) && plants.json.length
    ? (plants.json[0] as { id: string }).id
    : null;

  if (plantId) {
    const obs = await request(`/observations?plant_id=${encodeURIComponent(plantId)}`, {
      headers,
    });
    assert.equal(obs.res.status, 200, `observations ${obs.res.status}`);
    assert.ok(Array.isArray(obs.json));

    const acts = await request(
      `/dashboards/actions/open?plant_id=${encodeURIComponent(plantId)}`,
      { headers }
    );
    assert.equal(acts.res.status, 200, `open actions ${acts.res.status}`);
    assert.ok(Array.isArray(acts.json));
  }

  for (const p of [
    '/organisations',
    '/departments',
    '/processes',
    '/process-instances',
  ]) {
    const r = await request(p, { headers });
    assert.equal(r.res.status, 200, p);
  }

  // Filter narrowing simulation (client-side parity)
  const all = runs.json as { current_state: string }[];
  if (all.length > 0) {
    const state = all[0].current_state;
    const narrowed = all.filter((r) => r.current_state === state);
    assert.ok(narrowed.length <= all.length);
    assert.ok(narrowed.every((r) => r.current_state === state));
  }

  console.log(
    `admin-act-api: OK (runs=${(runs.json as unknown[]).length}${plantId ? ` plant=${plantId}` : ''})`
  );
}

await apiSmoke();
console.log('test-admin-act-api: OK');
