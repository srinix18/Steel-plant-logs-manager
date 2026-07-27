/**
 * P5-FIN-DASH — unit + API: plant→dept→process drill; asset detail; cost-sheet route exists.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const plantRoute = fs.readFileSync(
  path.join(root, 'app', '(app)', 'finance', 'dashboard', 'index.tsx'),
  'utf8'
);
assert.ok(plantRoute.includes('FINANCE_VIEW_ROLES'));
assert.ok(plantRoute.includes('FinancePlantDashboardScreen'));
assert.ok(!plantRoute.includes('RoleHomePlaceholder'));

const deptRoute = fs.readFileSync(
  path.join(root, 'app', '(app)', 'finance', 'dashboard', 'departments', '[id].tsx'),
  'utf8'
);
assert.ok(deptRoute.includes('FinanceDepartmentDashboardScreen'));

const procRoute = fs.readFileSync(
  path.join(root, 'app', '(app)', 'finance', 'dashboard', 'processes', '[id].tsx'),
  'utf8'
);
assert.ok(procRoute.includes('FinanceProcessDashboardScreen'));

const assetRoute = fs.readFileSync(
  path.join(root, 'app', '(app)', 'finance', 'dashboard', 'assets', '[id].tsx'),
  'utf8'
);
assert.ok(assetRoute.includes('FinanceAssetDashboardScreen'));

const sheetRoute = fs.readFileSync(
  path.join(root, 'app', '(app)', 'finance', 'runs', '[runId]', 'cost-sheet.tsx'),
  'utf8'
);
assert.ok(sheetRoute.includes('RunCostSheetScreen'));
assert.ok(!sheetRoute.includes('RoleHomePlaceholder'));

const plantScreen = fs.readFileSync(
  path.join(root, 'src', 'features', 'finance', 'FinancePlantDashboardScreen.tsx'),
  'utf8'
);
assert.ok(plantScreen.includes('fetchPlantCostSummary'));
assert.ok(plantScreen.includes('by_department'));
assert.ok(plantScreen.includes('/finance/dashboard/departments/'));

const procScreen = fs.readFileSync(
  path.join(root, 'src', 'features', 'finance', 'FinanceProcessDashboardScreen.tsx'),
  'utf8'
);
assert.ok(procScreen.includes('/finance/runs/'));
assert.ok(procScreen.includes('cost-sheet'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'finance.ts'), 'utf8');
assert.ok(api.includes('/finance/dashboard/plant-summary'));
assert.ok(api.includes('/finance/dashboard/departments/'));
assert.ok(api.includes('/finance/dashboard/processes/'));
assert.ok(api.includes('/finance/dashboard/assets/'));

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
    console.log(`finance-dash-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('finance-dash-api: CEO login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const plants = await request('/plants', { headers: auth });
  if (plants.res.status !== 200 || !(plants.json as { id: string }[])[0]) {
    console.log('finance-dash-api: no plants — unit OK; skipped');
    return;
  }
  const plantId = (plants.json as { id: string }[])[0].id;

  const summary = await request(
    `/finance/dashboard/plant-summary?plant_id=${encodeURIComponent(plantId)}`,
    { headers: auth }
  );
  if (summary.res.status !== 200) {
    console.error('finance-dash-api: plant-summary failed', summary.res.status, summary.json);
    process.exit(1);
  }
  const plant = summary.json as {
    total_cost_today: number;
    total_cost_month: number;
    run_count_today: number;
    run_count_month: number;
    by_department: { department_id: string }[];
    by_category: unknown[];
  };
  assert.ok(typeof plant.total_cost_today === 'number');
  assert.ok(typeof plant.total_cost_month === 'number');
  assert.ok(Array.isArray(plant.by_department));
  assert.ok(Array.isArray(plant.by_category));

  let deptOk = false;
  let procOk = false;
  let sheetLinked = false;
  if (plant.by_department[0]) {
    const deptId = plant.by_department[0].department_id;
    const dept = await request(`/finance/dashboard/departments/${deptId}`, { headers: auth });
    if (dept.res.status !== 200) {
      console.error('finance-dash-api: dept detail failed', dept.json);
      process.exit(1);
    }
    const d = dept.json as { total_cost: number; cost_per_run: number };
    assert.ok(typeof d.total_cost === 'number');
    assert.ok(typeof d.cost_per_run === 'number');
    deptOk = true;

    const procs = await request(`/processes?department_id=${encodeURIComponent(deptId)}`, {
      headers: auth,
    });
    if (procs.res.status === 200 && (procs.json as { id: string }[])[0]) {
      const processId = (procs.json as { id: string }[])[0].id;
      const proc = await request(`/finance/dashboard/processes/${processId}`, { headers: auth });
      if (proc.res.status !== 200) {
        console.error('finance-dash-api: process detail failed', proc.json);
        process.exit(1);
      }
      const p = proc.json as {
        total_cost: number;
        average_cost: number;
        highest_cost_run_id?: string | null;
        lowest_cost_run_id?: string | null;
      };
      assert.ok(typeof p.total_cost === 'number');
      assert.ok(typeof p.average_cost === 'number');
      procOk = true;
      sheetLinked = !!(p.highest_cost_run_id || p.lowest_cost_run_id);
    }
  }

  let assetOk = false;
  const assets = await request(`/foundation/assets?plant_id=${encodeURIComponent(plantId)}`, {
    headers: auth,
  });
  if (assets.res.status === 200 && (assets.json as { id: string }[])[0]) {
    const assetId = (assets.json as { id: string }[])[0].id;
    const asset = await request(`/finance/dashboard/assets/${assetId}`, { headers: auth });
    if (asset.res.status !== 200) {
      console.error('finance-dash-api: asset detail failed', asset.res.status, asset.json);
      process.exit(1);
    }
    const a = asset.json as {
      total_production_kg: number;
      power_cost: number;
      total_cost: number;
    };
    assert.ok(typeof a.total_production_kg === 'number');
    assert.ok(typeof a.power_cost === 'number');
    assert.ok(typeof a.total_cost === 'number');
    assetOk = true;
  }

  console.log(
    `finance-dash-api: OK (plant; dept=${deptOk}; process=${procOk}; asset=${assetOk}; sheetLink=${sheetLinked})`
  );
}

console.log('finance-dash-api: unit OK (plant→dept→process→sheet routes)');
await apiSmoke();
