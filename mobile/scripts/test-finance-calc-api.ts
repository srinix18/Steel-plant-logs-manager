/**
 * P5-FIN-CALC — unit + API: bulk-compute returns computed/failed/skipped.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'finance', 'calculations.tsx'),
  'utf8'
);
assert.ok(route.includes('FINANCE_VIEW_ROLES'));
assert.ok(route.includes('CostCalculationsScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'finance', 'CostCalculationsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('bulkComputeCosts'));
assert.ok(screen.includes('FINANCE_MASTERS_WRITE_ROLES'));
assert.ok(screen.includes('Bulk Compute'));
assert.ok(screen.includes('computed'));
assert.ok(screen.includes('failed'));
assert.ok(screen.includes('skipped'));
assert.ok(screen.includes('canWrite'));
assert.ok(screen.includes('Read-only'));
assert.ok(screen.includes('from_date'));
assert.ok(screen.includes('department_id'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'finance.ts'), 'utf8');
assert.ok(api.includes('/finance/calculations/bulk-compute'));
assert.ok(api.includes('bulkComputeCosts'));
assert.ok(!api.includes('/finance/calculations/bulk"'));

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
    console.log(`finance-calc-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('finance-calc-api: CEO login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token?: string }).access_token;
  if (!token) {
    console.log('finance-calc-api: no token — unit OK; skipped');
    return;
  }

  const plants = await request('/plants', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const plantId =
    plants.res.ok && Array.isArray(plants.json) && plants.json.length > 0
      ? (plants.json[0] as { id: string }).id
      : undefined;

  // Narrow date window so bulk stays fast in smoke.
  const body: Record<string, string> = {
    from_date: '2099-01-01',
    to_date: '2099-01-02',
  };
  if (plantId) body.plant_id = plantId;

  const bulk = await request('/finance/calculations/bulk-compute', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  assert.ok(bulk.res.ok, `bulk-compute ${bulk.res.status} ${JSON.stringify(bulk.json)}`);
  const result = bulk.json as { computed?: number; failed?: number; skipped?: number };
  assert.equal(typeof result.computed, 'number');
  assert.equal(typeof result.failed, 'number');
  assert.equal(typeof result.skipped, 'number');

  console.log(
    `finance-calc-api: OK (computed=${result.computed} failed=${result.failed} skipped=${result.skipped})`
  );
}

await apiSmoke();
console.log('test-finance-calc-api: OK');
