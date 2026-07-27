/**
 * P5-FND-CA — unit + API: create CA from observation; Close → closed.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'foundation', 'corrective-actions.tsx'),
  'utf8'
);
assert.ok(route.includes('SUPERVISOR_ROLES'));
assert.ok(route.includes('MAINTENANCE_ROLES'));
assert.ok(route.includes('FoundationCorrectiveActionsScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'foundation', 'FoundationCorrectiveActionsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchFoundationCorrectiveActions'));
assert.ok(screen.includes('createFoundationCorrectiveAction'));
assert.ok(screen.includes('updateFoundationCorrectiveAction'));
assert.ok(screen.includes('fetchFoundationObservations'));
assert.ok(screen.includes('fetchPlantUsers'));
assert.ok(screen.includes('Close'));
assert.ok(screen.includes("status: 'closed'"));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'foundation.ts'), 'utf8');
assert.ok(api.includes('/foundation/corrective-actions'));
assert.ok(api.includes('/corrective-actions'));
assert.ok(api.includes('createFoundationCorrectiveAction'));
assert.ok(api.includes('updateFoundationCorrectiveAction'));

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
    console.log(`foundation-ca-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('foundation-ca-api: supervisor login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const plants = await request('/plants', { headers: auth });
  if (plants.res.status !== 200 || !(plants.json as { id: string }[])[0]) {
    console.log('foundation-ca-api: no plants — unit OK; skipped');
    return;
  }
  const plantId = (plants.json as { id: string }[])[0].id;

  const stamp = Date.now().toString(36).toUpperCase();
  const obs = await request('/foundation/observations', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      title: `CA parent ${stamp}`,
      description: 'P5-FND-CA smoke parent observation',
      category: 'process',
      severity: 'low',
    }),
  });
  if (!obs.res.ok) {
    console.error('foundation-ca-api: observation create failed', obs.res.status, obs.json);
    process.exit(1);
  }
  const observationId = (obs.json as { id: string }).id;

  const users = await request(`/plants/${plantId}/users`, { headers: auth });
  if (users.res.status !== 200 || !(users.json as { id: string }[])[0]) {
    console.log('foundation-ca-api: no plant users — unit OK; skipped');
    return;
  }
  const assigneeId = (users.json as { id: string }[])[0].id;

  const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const title = `CA smoke ${stamp}`;
  const created = await request(`/foundation/observations/${observationId}/corrective-actions`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      title,
      assigned_to: assigneeId,
      due_date: due,
    }),
  });
  if (!created.res.ok) {
    console.error('foundation-ca-api: create CA failed', created.res.status, created.json);
    process.exit(1);
  }
  const action = created.json as {
    id: string;
    title: string;
    status: string;
    observation_id: string;
  };
  assert.equal(action.title, title);
  assert.equal(action.observation_id, observationId);
  assert.ok(action.status !== 'closed');

  const list = await request(
    `/foundation/corrective-actions?plant_id=${encodeURIComponent(plantId)}`,
    { headers: auth }
  );
  if (list.res.status !== 200 || !Array.isArray(list.json)) {
    console.error('foundation-ca-api: list failed', list.json);
    process.exit(1);
  }
  assert.ok((list.json as { id: string }[]).some((a) => a.id === action.id));

  const closed = await request(`/foundation/corrective-actions/${action.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      status: 'closed',
      closure_notes: 'Completed via foundation UI',
    }),
  });
  if (!closed.res.ok) {
    console.error('foundation-ca-api: close failed', closed.res.status, closed.json);
    process.exit(1);
  }
  assert.equal((closed.json as { status: string }).status, 'closed');

  console.log(
    `foundation-ca-api: OK (create→close ${title}; status=closed; list=${(list.json as unknown[]).length})`
  );
}

console.log('foundation-ca-api: unit OK (create form + Close wiring)');
await apiSmoke();
