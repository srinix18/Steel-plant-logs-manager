/**
 * P5-FIN-SHEET — unit + API: compute/recalculate refreshes line items.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'finance', 'runs', '[runId]', 'cost-sheet.tsx'),
  'utf8'
);
assert.ok(route.includes('FINANCE_VIEW_ROLES'));
assert.ok(route.includes('RunCostSheetScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'finance', 'RunCostSheetScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchRunCostSheet'));
assert.ok(screen.includes('computeRunCost'));
assert.ok(screen.includes('FINANCE_MASTERS_WRITE_ROLES'));
assert.ok(screen.includes('canCompute'));
assert.ok(screen.includes('Recalculate') || screen.includes('Calculate Cost'));
assert.ok(screen.includes('line_items'));
assert.ok(screen.includes('No cost calculation'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'finance.ts'), 'utf8');
assert.ok(api.includes('/finance/dashboard/runs/'));
assert.ok(api.includes('/cost-sheet'));
assert.ok(api.includes('/finance/calculations/runs/'));
assert.ok(api.includes('/compute'));

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
    console.log(`finance-sheet-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('finance-sheet-api: CEO login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const runs = await request('/process-runs?limit=20', { headers: auth });
  if (runs.res.status !== 200 || !(runs.json as { id: string }[])[0]) {
    console.log('finance-sheet-api: no process runs — unit OK; skipped');
    return;
  }
  const runId = (runs.json as { id: string; run_number?: string }[])[0].id;

  // Empty-OK path: may 404 before compute
  const before = await request(`/finance/dashboard/runs/${runId}/cost-sheet`, { headers: auth });
  if (before.res.status !== 200 && before.res.status !== 404) {
    console.error('finance-sheet-api: unexpected sheet status', before.res.status, before.json);
    process.exit(1);
  }

  const computed = await request(`/finance/calculations/runs/${runId}/compute`, {
    method: 'POST',
    headers: auth,
  });
  if (!computed.res.ok) {
    console.error('finance-sheet-api: compute failed', computed.res.status, computed.json);
    process.exit(1);
  }
  const calc1 = computed.json as {
    version: number;
    total_cost: number;
    status: string;
    line_items?: unknown[];
  };
  assert.ok(typeof calc1.version === 'number');
  assert.ok(typeof calc1.total_cost === 'number');

  const sheet = await request(`/finance/dashboard/runs/${runId}/cost-sheet`, { headers: auth });
  if (sheet.res.status !== 200) {
    console.error('finance-sheet-api: sheet after compute failed', sheet.json);
    process.exit(1);
  }
  const s = sheet.json as {
    run_number: string;
    calculation: { version: number; line_items: unknown[]; total_cost: number; status: string };
    breakdown: unknown[];
  };
  assert.ok(s.run_number);
  assert.ok(Array.isArray(s.calculation.line_items));
  assert.ok(Array.isArray(s.breakdown));
  assert.equal(s.calculation.version, calc1.version);

  const recomputed = await request(`/finance/calculations/runs/${runId}/compute`, {
    method: 'POST',
    headers: auth,
  });
  if (!recomputed.res.ok) {
    console.error('finance-sheet-api: recalculate failed', recomputed.res.status, recomputed.json);
    process.exit(1);
  }
  const calc2 = recomputed.json as { version: number; line_items: unknown[] };
  assert.ok(calc2.version >= calc1.version);

  const sheet2 = await request(`/finance/dashboard/runs/${runId}/cost-sheet`, { headers: auth });
  if (sheet2.res.status !== 200) {
    console.error('finance-sheet-api: sheet after recalc failed', sheet2.json);
    process.exit(1);
  }
  assert.equal(
    (sheet2.json as { calculation: { version: number } }).calculation.version,
    calc2.version
  );
  assert.ok(
    Array.isArray((sheet2.json as { calculation: { line_items: unknown[] } }).calculation.line_items)
  );

  console.log(
    `finance-sheet-api: OK (run ${s.run_number}; v${calc1.version}→v${calc2.version}; lines=${(sheet2.json as { calculation: { line_items: unknown[] } }).calculation.line_items.length})`
  );
}

console.log('finance-sheet-api: unit OK (empty + calculate/recalculate wiring)');
await apiSmoke();
