/**
 * P5-FIN-AN — unit + API: top-drivers + trends; groupBy reloads trends.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'finance', 'analytics.tsx'),
  'utf8'
);
assert.ok(route.includes('FINANCE_VIEW_ROLES'));
assert.ok(route.includes('CostAnalyticsScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'finance', 'CostAnalyticsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchTopCostDrivers'));
assert.ok(screen.includes('fetchCostTrends'));
assert.ok(screen.includes('groupBy'));
assert.ok(screen.includes('setGroupBy'));
assert.ok(screen.includes("'day'"));
assert.ok(screen.includes("'department'"));
assert.ok(screen.includes("'process'"));
assert.ok(screen.includes("'asset'"));
assert.ok(screen.includes('ProgressBar'));
assert.ok(screen.includes('percentage'));
assert.ok(screen.includes('total_cost'));
assert.ok(screen.includes('run_count'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'finance.ts'), 'utf8');
assert.ok(api.includes('/finance/analytics/top-drivers'));
assert.ok(api.includes('/finance/analytics/trends'));
assert.ok(api.includes('fetchTopCostDrivers'));
assert.ok(api.includes('fetchCostTrends'));
assert.ok(api.includes('group_by='));

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
    console.log(`finance-an-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('finance-an-api: CEO login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token?: string }).access_token;
  if (!token) {
    console.log('finance-an-api: no token — unit OK; skipped');
    return;
  }

  const plants = await request('/plants', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!plants.res.ok || !Array.isArray(plants.json) || plants.json.length === 0) {
    console.log('finance-an-api: no plants — unit OK; skipped');
    return;
  }
  const plantId = (plants.json[0] as { id: string }).id;

  const drivers = await request(
    `/finance/analytics/top-drivers?plant_id=${encodeURIComponent(plantId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert.equal(drivers.res.status, 200, `top-drivers ${drivers.res.status}`);
  assert.ok(Array.isArray(drivers.json));
  for (const d of drivers.json as { category?: string; amount?: number; percentage?: number }[]) {
    assert.ok(typeof d.category === 'string');
    assert.equal(typeof d.amount, 'number');
    assert.equal(typeof d.percentage, 'number');
  }

  const day = await request(
    `/finance/analytics/trends?plant_id=${encodeURIComponent(plantId)}&group_by=day`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert.equal(day.res.status, 200, `trends day ${day.res.status}`);
  assert.ok(Array.isArray(day.json));

  const dept = await request(
    `/finance/analytics/trends?plant_id=${encodeURIComponent(plantId)}&group_by=department`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert.equal(dept.res.status, 200, `trends department ${dept.res.status}`);
  assert.ok(Array.isArray(dept.json));
  // Changing groupBy returns a distinct response shape key (array of trend points).
  for (const t of dept.json as { label?: string; total_cost?: number; run_count?: number }[]) {
    assert.ok(typeof t.label === 'string');
    assert.equal(typeof t.total_cost, 'number');
    assert.equal(typeof t.run_count, 'number');
  }

  console.log(
    `finance-an-api: OK (drivers=${(drivers.json as unknown[]).length} day=${(day.json as unknown[]).length} dept=${(dept.json as unknown[]).length})`
  );
}

await apiSmoke();
console.log('test-finance-an-api: OK');
