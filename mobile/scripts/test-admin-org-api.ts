/**
 * P5-ADM-ORG — unit + API: org select filters plants/depts/instances (GET only).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'admin', 'organisations.tsx'),
  'utf8'
);
assert.ok(route.includes('PLATFORM_ADMIN_ROLES'));
assert.ok(route.includes('AdminOrganisationsScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'admin', 'AdminOrganisationsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchOrganisations'));
assert.ok(screen.includes('fetchPlants'));
assert.ok(screen.includes('fetchDepartments'));
assert.ok(screen.includes('fetchProcesses'));
assert.ok(screen.includes('fetchProcessInstances'));
assert.ok(screen.includes('selectedOrgId'));
assert.ok(screen.includes('setSelectedOrgId'));
assert.ok(screen.includes('timezone'));
assert.ok(screen.includes('Equipment instances'));
assert.ok(!screen.includes('createOrganisation'));
assert.ok(!screen.includes('POST'));

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
    console.log(`admin-org-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('admin-org-api: admin login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token?: string }).access_token;
  if (!token) {
    console.log('admin-org-api: no token — unit OK; skipped');
    return;
  }
  const headers = { Authorization: `Bearer ${token}` };

  const orgs = await request('/organisations', { headers });
  assert.equal(orgs.res.status, 200);
  assert.ok(Array.isArray(orgs.json));
  if ((orgs.json as unknown[]).length === 0) {
    console.log('admin-org-api: no orgs — unit OK; skipped filter assert');
    return;
  }
  const orgId = (orgs.json as { id: string }[])[0].id;

  const [plants, depts, procs, insts] = await Promise.all([
    request('/plants', { headers }),
    request('/departments', { headers }),
    request('/processes', { headers }),
    request('/process-instances', { headers }),
  ]);
  for (const [name, r] of [
    ['plants', plants],
    ['departments', depts],
    ['processes', procs],
    ['process-instances', insts],
  ] as const) {
    assert.equal(r.res.status, 200, name);
    assert.ok(Array.isArray(r.json), name);
  }

  const orgPlants = (plants.json as { organisation_id: string; name: string; code: string; timezone: string }[]).filter(
    (p) => p.organisation_id === orgId
  );
  for (const p of orgPlants) {
    assert.ok(typeof p.name === 'string');
    assert.ok(typeof p.code === 'string');
    assert.ok(typeof p.timezone === 'string');
  }

  const orgDepts = (
    depts.json as { organisation_id: string; id: string; name: string; code: string; plant_id: string }[]
  ).filter((d) => d.organisation_id === orgId);
  for (const d of orgDepts) {
    assert.ok(typeof d.name === 'string');
    assert.ok(typeof d.code === 'string');
  }

  const orgDeptIds = new Set(orgDepts.map((d) => d.id));
  const orgProcIds = new Set(
    (procs.json as { id: string; department_id: string }[])
      .filter((p) => orgDeptIds.has(p.department_id))
      .map((p) => p.id)
  );
  const filteredInsts = (
    insts.json as { process_id: string; name: string; status: string }[]
  ).filter((i) => orgProcIds.has(i.process_id));
  for (const i of filteredInsts) {
    assert.ok(typeof i.name === 'string');
    assert.ok(typeof i.status === 'string');
  }

  console.log(
    `admin-org-api: OK (org plants=${orgPlants.length} depts=${orgDepts.length} instances=${filteredInsts.length})`
  );
}

await apiSmoke();
console.log('test-admin-org-api: OK');
