/**
 * P5-FND-AN — unit + API: create KPI; list shows formula; empty OK.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'foundation', 'analytics.tsx'),
  'utf8'
);
assert.ok(route.includes('CEO_TIER_ROLES'));
assert.ok(route.includes('FoundationAnalyticsScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'foundation', 'FoundationAnalyticsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchKpiDefinitions'));
assert.ok(screen.includes('createKpiDefinition'));
assert.ok(screen.includes('canWrite'));
assert.ok(screen.includes('no auto-calculation'));
assert.ok(screen.includes('shift'));
assert.ok(screen.includes('daily'));
assert.ok(screen.includes('weekly'));
assert.ok(screen.includes('monthly'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'foundation.ts'), 'utf8');
assert.ok(api.includes('/foundation/kpi-definitions'));
assert.ok(api.includes('createKpiDefinition'));

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
    console.log(`foundation-kpi-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('foundation-kpi-api: CEO login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const before = await request('/foundation/kpi-definitions', { headers: auth });
  if (before.res.status !== 200 || !Array.isArray(before.json)) {
    console.error('foundation-kpi-api: list failed', before.json);
    process.exit(1);
  }
  // empty OK

  const stamp = Date.now().toString(36).toUpperCase();
  const code = `KPI-${stamp}`;
  const formula = `runs * ${stamp.length}`;
  const created = await request('/foundation/kpi-definitions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      code,
      name: `Mobile KPI ${stamp}`,
      formula,
      target_value: 100,
      frequency: 'daily',
    }),
  });
  if (!created.res.ok) {
    console.error('foundation-kpi-api: create failed', created.res.status, created.json);
    process.exit(1);
  }
  const kpi = created.json as { id: string; code: string; formula: string; frequency: string };
  assert.equal(kpi.code, code);
  assert.equal(kpi.formula, formula);
  assert.equal(kpi.frequency, 'daily');

  const after = await request('/foundation/kpi-definitions', { headers: auth });
  if (after.res.status !== 200 || !Array.isArray(after.json)) {
    console.error('foundation-kpi-api: list after create failed', after.json);
    process.exit(1);
  }
  const found = (after.json as { id: string; formula: string }[]).find((k) => k.id === kpi.id);
  if (!found) {
    console.error('foundation-kpi-api: created KPI missing from list');
    process.exit(1);
  }
  assert.equal(found.formula, formula);

  console.log(
    `foundation-kpi-api: OK (create ${code}; formula shown; list=${(after.json as unknown[]).length})`
  );
}

console.log('foundation-kpi-api: unit OK (create form + stored-only note)');
await apiSmoke();
