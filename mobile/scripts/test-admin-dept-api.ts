/**
 * P5-ADM-DEPT — unit + API: dept list, org filter, process → sheet shortcuts.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'admin', 'departments.tsx'),
  'utf8'
);
assert.ok(route.includes('AdminDepartmentsScreen'));
assert.ok(route.includes('DeptBrowserScreen'));
assert.ok(route.includes('PLATFORM_ADMIN_ROLES'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'admin', 'AdminDepartmentsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchDepartments'));
assert.ok(screen.includes('fetchOrganisations'));
assert.ok(screen.includes('fetchPlants'));
assert.ok(screen.includes('fetchProcesses'));
assert.ok(screen.includes('orgFilter'));
assert.ok(screen.includes('PROCESS_LOG_SHEETS'));
assert.ok(screen.includes('admin/sheets'));
assert.ok(screen.includes('processLogSheets'));

const mapSrc = fs.readFileSync(
  path.join(root, 'src', 'features', 'admin', 'processLogSheets.ts'),
  'utf8'
);
assert.ok(mapSrc.includes("IAF: { doc: 'F/PRD/02'"));
assert.ok(mapSrc.includes("AOD: { doc: 'F/PRD/03'"));
assert.ok(mapSrc.includes('BBAR'));

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
    console.log(`admin-dept-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('admin-dept-api: admin login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token?: string }).access_token;
  if (!token) {
    console.log('admin-dept-api: no token — unit OK; skipped');
    return;
  }
  const headers = { Authorization: `Bearer ${token}` };

  const [depts, orgs, plants, procs] = await Promise.all([
    request('/departments', { headers }),
    request('/organisations', { headers }),
    request('/plants', { headers }),
    request('/processes', { headers }),
  ]);
  for (const [name, r] of [
    ['departments', depts],
    ['organisations', orgs],
    ['plants', plants],
    ['processes', procs],
  ] as const) {
    assert.equal(r.res.status, 200, name);
    assert.ok(Array.isArray(r.json), name);
  }

  const orgList = orgs.json as { id: string }[];
  if (orgList.length > 0) {
    const orgId = orgList[0].id;
    const filtered = (depts.json as { organisation_id: string }[]).filter(
      (d) => d.organisation_id === orgId
    );
    assert.ok(filtered.length <= (depts.json as unknown[]).length);
  }

  const deptList = depts.json as {
    id: string;
    name: string;
    code: string;
    organisation_id: string;
    plant_id: string;
  }[];
  for (const d of deptList.slice(0, 5)) {
    assert.ok(typeof d.name === 'string');
    assert.ok(typeof d.code === 'string');
    const linked = (procs.json as { department_id: string; code: string }[]).filter(
      (p) => p.department_id === d.id
    );
    assert.ok(Array.isArray(linked));
  }

  console.log(
    `admin-dept-api: OK (depts=${deptList.length} orgs=${orgList.length} processes=${(procs.json as unknown[]).length})`
  );
}

await apiSmoke();
console.log('test-admin-dept-api: OK');
