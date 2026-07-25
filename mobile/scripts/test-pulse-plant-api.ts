/**
 * P5-PULSE-PLANT — unit + API: plant pulse, feed, alerts; refresh; drill dept.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(path.join(root, 'app', '(app)', 'pulse', 'plant.tsx'), 'utf8');
assert.ok(route.includes('CEO_TIER_ROLES'));
assert.ok(route.includes('PlantPulseScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'pulse', 'PlantPulseScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchPlantPulse'));
assert.ok(screen.includes('fetchPulseFeed'));
assert.ok(screen.includes('fetchPulseAlerts'));
assert.ok(screen.includes('refreshPulse'));
assert.ok(screen.includes('30000') || screen.includes('30_000'));
assert.ok(screen.includes('Overall OEE'));
assert.ok(screen.includes("Today's Production"));
assert.ok(screen.includes("Today's Cost"));
assert.ok(screen.includes('Power'));
assert.ok(screen.includes('Downtime'));
assert.ok(screen.includes('Active Alerts'));
assert.ok(screen.includes('Pending Maint'));
assert.ok(screen.includes('Current Shift'));
assert.ok(screen.includes('Attendance'));
assert.ok(screen.includes('Department Pulse'));
assert.ok(screen.includes('pulse/department'));
assert.ok(screen.includes('Energy'));
assert.ok(screen.includes('Inventory'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'pulse.ts'), 'utf8');
assert.ok(api.includes('/pulse/plant/'));
assert.ok(api.includes('/pulse/feed'));
assert.ok(api.includes('/pulse/alerts'));
assert.ok(api.includes('/pulse/refresh'));

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
    console.log(`pulse-plant-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('pulse-plant-api: CEO login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const plants = await request('/plants', { headers: auth });
  if (plants.res.status !== 200 || !(plants.json as { id: string }[])[0]) {
    console.log('pulse-plant-api: no plants — unit OK; skipped');
    return;
  }
  const plantId = (plants.json as { id: string }[])[0].id;

  const pulse = await request(`/pulse/plant/${plantId}`, { headers: auth });
  if (pulse.res.status !== 200) {
    console.error('pulse-plant-api: plant pulse failed', pulse.json);
    process.exit(1);
  }
  const p = pulse.json as {
    plant_name: string;
    overall_oee?: number;
    departments: { department_id: string }[];
    oee: { oee: number };
  };
  assert.ok(p.plant_name);
  assert.ok(Array.isArray(p.departments));
  assert.ok(p.oee && typeof p.oee.oee === 'number');

  const feed = await request(`/pulse/feed?plant_id=${encodeURIComponent(plantId)}&limit=30`, {
    headers: auth,
  });
  if (feed.res.status !== 200) {
    console.error('pulse-plant-api: feed failed', feed.json);
    process.exit(1);
  }
  assert.ok(Array.isArray(feed.json));

  const alerts = await request(`/pulse/alerts?plant_id=${encodeURIComponent(plantId)}`, {
    headers: auth,
  });
  if (alerts.res.status !== 200) {
    console.error('pulse-plant-api: alerts failed', alerts.json);
    process.exit(1);
  }
  assert.ok(Array.isArray(alerts.json));

  const refresh = await request(`/pulse/refresh?plant_id=${encodeURIComponent(plantId)}`, {
    method: 'POST',
    headers: auth,
  });
  if (!refresh.res.ok) {
    console.error('pulse-plant-api: refresh failed', refresh.res.status, refresh.json);
    process.exit(1);
  }

  console.log(
    `pulse-plant-api: OK (plant=${p.plant_name}; depts=${p.departments.length}; feed=${(feed.json as unknown[]).length}; alerts=${(alerts.json as unknown[]).length}; refresh=ok)`
  );
}

console.log('pulse-plant-api: unit OK (KPIs + feed + refresh + dept drill)');
await apiSmoke();
