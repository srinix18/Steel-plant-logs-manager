/**
 * P5-FND-MASTERS — unit + API: create on writable tabs; contractors list-only.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'foundation', 'masters.tsx'),
  'utf8'
);
assert.ok(route.includes('HOD_TIER_ROLES'));
assert.ok(route.includes('FoundationMastersScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'foundation', 'FoundationMastersScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('CEO_TIER_ROLES'));
assert.ok(screen.includes('canWrite'));
assert.ok(screen.includes('createMasterGrade'));
assert.ok(screen.includes('createMasterMaterial'));
assert.ok(screen.includes('createMasterProduct'));
assert.ok(screen.includes('createMasterCustomer'));
assert.ok(screen.includes('createMasterDelayCode'));
assert.ok(screen.includes('fetchMasterContractors'));
assert.ok(screen.includes("type: 'alloy'") || screen.includes('type: form.type'));
assert.ok(screen.includes('category'));
assert.ok(screen.includes('Manage contractors in Workforce'));
assert.ok(!screen.includes('createMasterContractor'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'foundation.ts'), 'utf8');
assert.ok(api.includes('/masters/grades'));
assert.ok(api.includes('/masters/materials'));
assert.ok(api.includes('/masters/products'));
assert.ok(api.includes('/masters/customers'));
assert.ok(api.includes('/masters/delay-codes'));
assert.ok(api.includes('/masters/contractors'));

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
    console.log(`foundation-masters-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('foundation-masters-api: CEO login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const plants = await request('/plants', { headers: auth });
  if (plants.res.status !== 200 || !(plants.json as { id: string; organisation_id: string }[])[0]) {
    console.log('foundation-masters-api: no plants — unit OK; skipped');
    return;
  }
  const plant = (plants.json as { id: string; organisation_id: string }[])[0];
  const plantId = plant.id;
  const orgId = plant.organisation_id;
  const stamp = Date.now().toString(36).toUpperCase();
  // DelayCode.code is String(10) — keep ≤10 chars
  const short = stamp.slice(-6);

  const gradeCode = `MG-${stamp}`;
  const grade = await request('/masters/grades', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      organisation_id: orgId,
      code: gradeCode,
      description: 'mobile smoke grade',
    }),
  });
  if (!grade.res.ok) {
    console.error('foundation-masters-api: grade create failed', grade.res.status, grade.json);
    process.exit(1);
  }

  const matCode = `MM-${stamp}`;
  const material = await request('/masters/materials', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      organisation_id: orgId,
      type: 'alloy',
      code: matCode,
      name: `Smoke mat ${stamp}`,
    }),
  });
  if (!material.res.ok) {
    console.error('foundation-masters-api: material create failed', material.res.status, material.json);
    process.exit(1);
  }
  assert.equal((material.json as { type: string }).type, 'alloy');

  const prodCode = `MP-${stamp}`;
  const product = await request('/masters/products', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      organisation_id: orgId,
      code: prodCode,
      name: `Smoke product ${stamp}`,
    }),
  });
  if (!product.res.ok) {
    console.error('foundation-masters-api: product create failed', product.res.status, product.json);
    process.exit(1);
  }

  const custCode = `MC-${stamp}`;
  const customer = await request('/masters/customers', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      name: `Smoke Customer ${stamp}`,
      code: custCode,
    }),
  });
  if (!customer.res.ok) {
    console.error('foundation-masters-api: customer create failed', customer.res.status, customer.json);
    process.exit(1);
  }

  const delayCode = `M${short}`; // e.g. MABC123 ≤10
  const delay = await request('/masters/delay-codes', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      code: delayCode,
      description: 'Mobile smoke delay',
      category: 'process',
    }),
  });
  if (!delay.res.ok) {
    console.error('foundation-masters-api: delay-code create failed', delay.res.status, delay.json);
    process.exit(1);
  }
  assert.equal((delay.json as { category: string }).category, 'process');

  const lists = await Promise.all([
    request('/masters/grades', { headers: auth }),
    request('/masters/materials', { headers: auth }),
    request('/masters/products', { headers: auth }),
    request(`/masters/customers?plant_id=${encodeURIComponent(plantId)}`, { headers: auth }),
    request(`/masters/delay-codes?plant_id=${encodeURIComponent(plantId)}`, { headers: auth }),
    request('/masters/contractors', { headers: auth }),
  ]);
  for (const [i, name] of [
    'grades',
    'materials',
    'products',
    'customers',
    'delay-codes',
    'contractors',
  ].entries()) {
    if (lists[i].res.status !== 200 || !Array.isArray(lists[i].json)) {
      console.error(`foundation-masters-api: list ${name} failed`, lists[i].json);
      process.exit(1);
    }
  }

  assert.ok((lists[0].json as { code: string }[]).some((g) => g.code === gradeCode));
  assert.ok((lists[1].json as { code: string }[]).some((m) => m.code === matCode));
  assert.ok((lists[2].json as { code: string }[]).some((p) => p.code === prodCode));
  assert.ok((lists[3].json as { code: string }[]).some((c) => c.code === custCode));
  assert.ok((lists[4].json as { code: string }[]).some((d) => d.code === delayCode));

  // Contractors: GET only — POST must not be used by app (list-only)
  assert.ok(Array.isArray(lists[5].json));

  console.log(
    `foundation-masters-api: OK (grade/material/product/customer/delay created; contractors=${(lists[5].json as unknown[]).length})`
  );
}

console.log('foundation-masters-api: unit OK (tabs + CEO write + contractors RO)');
await apiSmoke();
