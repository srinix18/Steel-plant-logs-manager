/**
 * P5-ENERGY — unit + API: plant energy metrics; assets link to workspace.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(path.join(root, 'app', '(app)', 'energy', 'index.tsx'), 'utf8');
assert.ok(route.includes('CEO_TIER_ROLES'));
assert.ok(route.includes('EnergyDashboardScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'energy', 'EnergyDashboardScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchEnergyPlant'));
assert.ok(screen.includes('Today'));
assert.ok(screen.includes('This Week'));
assert.ok(screen.includes('This Month'));
assert.ok(screen.includes("Today's Cost"));
assert.ok(screen.includes('Peak Load'));
assert.ok(screen.includes('Avg Load'));
assert.ok(screen.includes('Energy by Department'));
assert.ok(screen.includes('Top Asset Consumers'));
assert.ok(screen.includes('Consumption History'));
assert.ok(screen.includes('/workspace'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'energy.ts'), 'utf8');
assert.ok(api.includes('/energy/plant/'));
assert.ok(api.includes('fetchEnergyPlant'));

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
    console.log(`energy-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('energy-api: CEO login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const plants = await request('/plants', { headers: auth });
  if (plants.res.status !== 200 || !(plants.json as { id: string }[])[0]) {
    console.log('energy-api: no plants — unit OK; skipped');
    return;
  }
  const plantId = (plants.json as { id: string }[])[0].id;

  const energy = await request(`/energy/plant/${plantId}`, { headers: auth });
  if (energy.res.status !== 200) {
    console.error('energy-api: plant energy failed', energy.json);
    process.exit(1);
  }
  const d = energy.json as {
    plant_id: string;
    today_kwh: number;
    week_kwh: number;
    month_kwh: number;
    today_cost: number;
    departments: { code: string; kwh: number }[];
    assets: { asset_id: string; name: string; kwh: number }[];
    history: { reading_at: string; kwh: number }[];
  };
  assert.equal(d.plant_id, plantId);
  assert.ok(typeof d.today_kwh === 'number');
  assert.ok(typeof d.week_kwh === 'number');
  assert.ok(typeof d.month_kwh === 'number');
  assert.ok(typeof d.today_cost === 'number');
  assert.ok(Array.isArray(d.departments));
  assert.ok(Array.isArray(d.assets));
  assert.ok(Array.isArray(d.history));

  const top = [...d.assets].sort((a, b) => b.kwh - a.kwh)[0];
  if (top) {
    assert.ok(top.asset_id, 'top asset missing id for workspace link');
  }

  console.log(
    `energy-api: OK (today=${d.today_kwh}; depts=${d.departments.length}; assets=${d.assets.length}; history=${d.history.length}; workspaceLink=${!!top})`
  );
}

console.log('energy-api: unit OK (KPIs + dept bars + assets→workspace + history)');
await apiSmoke();
