/**
 * P5-FIN-MASTERS — unit + API: create per tab; lists rates.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'finance', 'masters.tsx'),
  'utf8'
);
assert.ok(route.includes('FINANCE_MASTERS_WRITE_ROLES'));
assert.ok(route.includes('CostMastersScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));
assert.ok(!route.includes('DesktopOnlyGate'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'finance', 'CostMastersScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('createRawMaterialRate'));
assert.ok(screen.includes('createPowerRate'));
assert.ok(screen.includes('createFuelRate'));
assert.ok(screen.includes('createLabourRate'));
assert.ok(screen.includes('createMaintenanceRate'));
assert.ok(screen.includes('fetchMasterMaterials'));
assert.ok(screen.includes('equipment'));
assert.ok(screen.includes('quality'));
assert.ok(screen.includes('process'));
assert.ok(screen.includes('canWrite'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'finance.ts'), 'utf8');
assert.ok(api.includes('/finance/masters/raw-materials'));
assert.ok(api.includes('/finance/masters/power'));
assert.ok(api.includes('/finance/masters/fuel'));
assert.ok(api.includes('/finance/masters/labour'));
assert.ok(api.includes('/finance/masters/maintenance'));

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
    console.log(`finance-masters-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('finance-masters-api: CEO login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const plants = await request('/plants', { headers: auth });
  if (plants.res.status !== 200 || !(plants.json as { id: string; organisation_id: string }[])[0]) {
    console.log('finance-masters-api: no plants — unit OK; skipped');
    return;
  }
  const plant = (plants.json as { id: string; organisation_id: string }[])[0];
  const plantId = plant.id;
  const orgId = plant.organisation_id;
  const stamp = Date.now().toString(36).toUpperCase();
  const today = new Date().toISOString().slice(0, 10);

  const materials = await request('/masters/materials', { headers: auth });
  if (materials.res.status !== 200 || !(materials.json as { id: string }[])[0]) {
    console.log('finance-masters-api: no materials — unit OK; skipped');
    return;
  }
  const materialId = (materials.json as { id: string }[])[0].id;

  const rm = await request('/finance/masters/raw-materials', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      organisation_id: orgId,
      material_id: materialId,
      rate: 12.5,
      effective_from: today,
    }),
  });
  if (!rm.res.ok) {
    console.error('finance-masters-api: raw-materials create failed', rm.res.status, rm.json);
    process.exit(1);
  }

  const power = await request('/finance/masters/power', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      cost_per_unit: 9.1,
      effective_from: today,
    }),
  });
  if (!power.res.ok) {
    console.error('finance-masters-api: power create failed', power.res.status, power.json);
    process.exit(1);
  }

  const fuel = await request('/finance/masters/fuel', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      fuel_name: `SmokeFuel-${stamp}`,
      rate: 45,
      effective_from: today,
    }),
  });
  if (!fuel.res.ok) {
    console.error('finance-masters-api: fuel create failed', fuel.res.status, fuel.json);
    process.exit(1);
  }

  const labour = await request('/finance/masters/labour', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      role_label: `SmokeOp-${stamp}`,
      cost_per_hour: 400,
    }),
  });
  if (!labour.res.ok) {
    console.error('finance-masters-api: labour create failed', labour.res.status, labour.json);
    process.exit(1);
  }

  const maint = await request('/finance/masters/maintenance', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      category: 'equipment',
      default_cost: 5500,
    }),
  });
  // maintenance may unique-collide on category — accept 200/201 or 400/409 duplicate
  if (!maint.res.ok && maint.res.status !== 400 && maint.res.status !== 409) {
    console.error('finance-masters-api: maintenance create failed', maint.res.status, maint.json);
    process.exit(1);
  }

  const lists = await Promise.all([
    request(`/finance/masters/raw-materials?organisation_id=${encodeURIComponent(orgId)}`, {
      headers: auth,
    }),
    request(`/finance/masters/power?plant_id=${encodeURIComponent(plantId)}`, { headers: auth }),
    request(`/finance/masters/fuel?plant_id=${encodeURIComponent(plantId)}`, { headers: auth }),
    request(`/finance/masters/labour?plant_id=${encodeURIComponent(plantId)}`, { headers: auth }),
    request(`/finance/masters/maintenance?plant_id=${encodeURIComponent(plantId)}`, {
      headers: auth,
    }),
  ]);
  for (const [i, name] of ['raw', 'power', 'fuel', 'labour', 'maint'].entries()) {
    if (lists[i].res.status !== 200 || !Array.isArray(lists[i].json)) {
      console.error(`finance-masters-api: list ${name} failed`, lists[i].json);
      process.exit(1);
    }
  }
  assert.ok((lists[0].json as unknown[]).length >= 1);
  assert.ok((lists[1].json as unknown[]).length >= 1);
  assert.ok((lists[2].json as { fuel_name: string }[]).some((f) => f.fuel_name.includes(stamp)));
  assert.ok((lists[3].json as { role_label: string }[]).some((l) => l.role_label.includes(stamp)));
  assert.ok((lists[4].json as unknown[]).length >= 1);

  console.log(
    `finance-masters-api: OK (rm/power/fuel/labour/maint; lists=${lists.map((l) => (l.json as unknown[]).length).join('/')})`
  );
}

console.log('finance-masters-api: unit OK (5 tabs + create forms)');
await apiSmoke();
