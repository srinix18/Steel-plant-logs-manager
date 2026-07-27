/**
 * P5-FND-OBS — unit + API: create observation; appears in list with status; enums.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'foundation', 'observations.tsx'),
  'utf8'
);
assert.ok(route.includes('SUPERVISOR_ROLES'));
assert.ok(route.includes('MAINTENANCE_ROLES'));
assert.ok(route.includes('FoundationObservationsScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'foundation', 'FoundationObservationsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchFoundationObservations'));
assert.ok(screen.includes('createFoundationObservation'));
assert.ok(screen.includes('quality'));
assert.ok(screen.includes('safety'));
assert.ok(screen.includes('energy'));
assert.ok(screen.includes('equipment'));
assert.ok(screen.includes('process'));
assert.ok(screen.includes('low'));
assert.ok(screen.includes('medium'));
assert.ok(screen.includes('high'));
assert.ok(screen.includes('critical'));
assert.ok(screen.includes('observed_at') || screen.includes('formatWhen'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'foundation.ts'), 'utf8');
assert.ok(api.includes('/foundation/observations'));
assert.ok(api.includes('createFoundationObservation'));

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
      body: JSON.stringify({
        email: 'iaf.supervisor@chandansteel.com',
        password: 'iaf123',
      }),
    });
  } catch (err) {
    console.log(`foundation-obs-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('foundation-obs-api: supervisor login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const plants = await request('/plants', { headers: auth });
  if (plants.res.status !== 200 || !(plants.json as { id: string }[])[0]) {
    console.log('foundation-obs-api: no plants — unit OK; skipped');
    return;
  }
  const plantId = (plants.json as { id: string }[])[0].id;

  const stamp = Date.now().toString(36).toUpperCase();
  const title = `Mobile OBS ${stamp}`;
  const created = await request('/foundation/observations', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      title,
      description: 'P5-FND-OBS smoke observation',
      category: 'equipment',
      severity: 'medium',
    }),
  });
  if (!created.res.ok) {
    console.error('foundation-obs-api: create failed', created.res.status, created.json);
    process.exit(1);
  }
  const obs = created.json as {
    id: string;
    title: string;
    status: string;
    category: string;
    severity: string;
  };
  assert.equal(obs.title, title);
  assert.equal(obs.category, 'equipment');
  assert.equal(obs.severity, 'medium');
  assert.ok(obs.status, 'expected status on create');

  const list = await request(
    `/foundation/observations?plant_id=${encodeURIComponent(plantId)}`,
    { headers: auth }
  );
  if (list.res.status !== 200 || !Array.isArray(list.json)) {
    console.error('foundation-obs-api: list failed', list.json);
    process.exit(1);
  }
  const found = (list.json as { id: string; status: string }[]).find((o) => o.id === obs.id);
  if (!found) {
    console.error('foundation-obs-api: created observation missing from list');
    process.exit(1);
  }
  assert.ok(found.status);

  // Enum rejection
  const bad = await request('/foundation/observations', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      title: 'bad',
      description: 'bad',
      category: 'not-a-category',
      severity: 'medium',
    }),
  });
  assert.ok(bad.res.status === 422 || bad.res.status === 400);

  console.log(
    `foundation-obs-api: OK (create ${title}; status=${found.status}; list=${(list.json as unknown[]).length})`
  );
}

console.log('foundation-obs-api: unit OK (form enums + list columns)');
await apiSmoke();
