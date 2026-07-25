/**
 * P5-PULSE-DEPT — unit + API: dept pulse + OEE; HOD default / query switch.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'pulse', 'department.tsx'),
  'utf8'
);
assert.ok(route.includes('HOD_TIER_ROLES'));
assert.ok(route.includes('DepartmentPulseScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'pulse', 'DepartmentPulseScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchDepartmentPulse'));
assert.ok(screen.includes("fetchOee('department'"));
assert.ok(screen.includes('useLocalSearchParams'));
assert.ok(screen.includes('department_id'));
assert.ok(screen.includes('SelectSheet'));
assert.ok(screen.includes('DeptSpecificCards') || screen.includes('SMS'));
assert.ok(screen.includes('IAF') || screen.includes('ROLLING'));
assert.ok(screen.includes('WIRE'));
assert.ok(screen.includes('Shift Progress'));
assert.ok(screen.includes('OEE Trend'));
assert.ok(screen.includes('Active Runs'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'pulse.ts'), 'utf8');
assert.ok(api.includes('/pulse/department/'));
const oee = fs.readFileSync(path.join(root, 'src', 'api', 'oee.ts'), 'utf8');
assert.ok(oee.includes('/oee/'));

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
      body: JSON.stringify({ email: 'hod@chandansteel.com', password: 'hod123' }),
    });
  } catch (err) {
    console.log(`pulse-dept-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('pulse-dept-api: HOD login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const me = await request('/auth/me', { headers: auth });
  if (me.res.status !== 200) {
    console.error('pulse-dept-api: me failed', me.json);
    process.exit(1);
  }
  const hodDept = (me.json as { department_id?: string | null }).department_id;

  const depts = await request('/departments', { headers: auth });
  if (depts.res.status !== 200 || !(depts.json as { id: string }[]).length) {
    console.log('pulse-dept-api: no departments — unit OK; skipped');
    return;
  }
  const list = depts.json as { id: string; code: string }[];
  const defaultId = hodDept || list[0].id;
  const switchId = list.find((d) => d.id !== defaultId)?.id ?? defaultId;

  for (const id of [defaultId, switchId]) {
    const pulse = await request(`/pulse/department/${id}`, { headers: auth });
    if (pulse.res.status !== 200) {
      console.error('pulse-dept-api: dept pulse failed', id, pulse.json);
      process.exit(1);
    }
    const p = pulse.json as {
      department_id: string;
      department_code: string;
      oee_detail: { oee: number };
      active_runs: unknown[];
    };
    assert.equal(p.department_id, id);
    assert.ok(p.oee_detail && typeof p.oee_detail.oee === 'number');
    assert.ok(Array.isArray(p.active_runs));

    const oeeRes = await request(`/oee/department/${id}`, { headers: auth });
    if (oeeRes.res.status !== 200) {
      console.error('pulse-dept-api: oee failed', oeeRes.json);
      process.exit(1);
    }
    assert.ok(Array.isArray((oeeRes.json as { daily: unknown[] }).daily));
  }

  console.log(
    `pulse-dept-api: OK (hodDefault=${!!hodDept}; default=${defaultId}; switched=${switchId !== defaultId})`
  );
}

console.log('pulse-dept-api: unit OK (picker + SMS/ROLLING/WIRE + OEE trend)');
await apiSmoke();
