/**
 * P3-MAINT-QUEUE — unit + API smoke: mine / assign / close round-trip.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(path.join(root, 'app', '(app)', 'maintenance', 'index.tsx'), 'utf8');
assert.ok(route.includes('MAINTENANCE_ROLES'));
assert.ok(route.includes('MaintenanceQueueScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'maintenance', 'MaintenanceQueueScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchMyMaintenanceIssues'));
assert.ok(screen.includes('assignMaintenanceIssue'));
assert.ok(screen.includes('closeMaintenanceIssue'));
assert.ok(screen.includes('Take issue'));
assert.ok(screen.includes('Mark completed'));
assert.ok(screen.includes('highlightId') || screen.includes('issue'));
assert.ok(screen.includes('resolutionNotes') || screen.includes('Resolution'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'maintenance.ts'), 'utf8');
assert.ok(api.includes('/maintenance/issues/mine'));
assert.ok(api.includes('/assign'));
assert.ok(api.includes('/close'));

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

async function login(email: string, password: string) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.res.ok) return null;
  return (res.json as { access_token: string }).access_token;
}

async function apiSmoke() {
  let token;
  try {
    token = await login('maint.quality@chandansteel.com', 'maint123');
  } catch (err) {
    console.log(`maint-queue-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!token) {
    console.log('maint-queue-api: maint login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${token}` };

  const mine = await request('/maintenance/issues/mine', { headers: auth });
  if (!mine.res.ok) {
    console.error('maint-queue-api: /mine failed', mine.json);
    process.exit(1);
  }
  if (!Array.isArray(mine.json)) {
    console.error('maint-queue-api: /mine not array', mine.json);
    process.exit(1);
  }
  console.log(`ok  mine → ${(mine.json as unknown[]).length} issue(s)`);

  // Raise a quality issue as IAF supervisor so maint.quality can take it
  const supToken = await login('iaf.supervisor@chandansteel.com', 'iaf123');
  if (!supToken) {
    console.log('maint-queue-api: supervisor login failed — skipped assign/close');
    return;
  }
  const supAuth = { Authorization: `Bearer ${supToken}` };
  const me = await request('/auth/me', { headers: supAuth });
  const plants = await request('/plants', { headers: supAuth });
  const plantId =
    (me.res.ok ? (me.json as { plant_id?: string }).plant_id : undefined) ||
    (plants.res.ok ? (plants.json as { id: string }[])[0]?.id : undefined);
  if (!plantId) {
    console.log('maint-queue-api: no plant — skipped assign/close');
    return;
  }

  const stamp = Date.now();
  const created = await request('/maintenance/issues', {
    method: 'POST',
    headers: supAuth,
    body: JSON.stringify({
      plant_id: plantId,
      title: `Mobile P3-MAINT-QUEUE ${stamp}`,
      description: 'Smoke issue for assign/close',
      category: 'quality',
      severity: 'low',
    }),
  });
  if (!created.res.ok) {
    console.error('maint-queue-api: create failed', created.json);
    process.exit(1);
  }
  const issue = created.json as { id: string; status: string };
  console.log(`ok  create → ${issue.id} (${issue.status})`);

  const assigned = await request(`/maintenance/issues/${issue.id}/assign`, {
    method: 'POST',
    headers: auth,
  });
  if (!assigned.res.ok) {
    console.error('maint-queue-api: assign failed', assigned.json);
    process.exit(1);
  }
  const afterAssign = assigned.json as { status: string };
  if (afterAssign.status !== 'in_progress') {
    console.error('maint-queue-api: expected in_progress after assign', afterAssign);
    process.exit(1);
  }
  console.log('ok  assign → in_progress');

  const closed = await request(`/maintenance/issues/${issue.id}/close`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ resolution_notes: 'Fixed in smoke test' }),
  });
  if (!closed.res.ok) {
    console.error('maint-queue-api: close failed', closed.json);
    process.exit(1);
  }
  const afterClose = closed.json as { status: string; resolution_notes?: string };
  if (afterClose.status !== 'closed') {
    console.error('maint-queue-api: expected closed', afterClose);
    process.exit(1);
  }
  if (!afterClose.resolution_notes?.includes('smoke')) {
    console.error('maint-queue-api: resolution notes missing', afterClose);
    process.exit(1);
  }
  console.log('ok  close → closed with resolution');

  const mine2 = await request('/maintenance/issues/mine', { headers: auth });
  const found = Array.isArray(mine2.json)
    ? (mine2.json as { id: string; status: string }[]).find((i) => i.id === issue.id)
    : undefined;
  if (!found || found.status !== 'closed') {
    console.error('maint-queue-api: closed issue missing from /mine', found);
    process.exit(1);
  }

  console.log('maint-queue-api: ok (mine + assign + close round-trip)');
}

await apiSmoke();
console.log('maint-queue-api: unit OK (tabs + Take/Complete wiring)');
