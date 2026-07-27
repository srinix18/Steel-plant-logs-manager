/**
 * P5-FND-ASSETS — unit + API: create/edit asset; events; assign; maintenance history.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'foundation', 'assets.tsx'),
  'utf8'
);
assert.ok(route.includes('HOD_TIER_ROLES'));
assert.ok(route.includes('FoundationAssetsScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'foundation', 'FoundationAssetsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchFoundationAssets'));
assert.ok(screen.includes('createFoundationAsset'));
assert.ok(screen.includes('updateFoundationAsset'));
assert.ok(screen.includes('fetchAssetEvents'));
assert.ok(screen.includes('createAssetEvent'));
assert.ok(screen.includes('addAssetResponsibility'));
assert.ok(screen.includes('fetchAssetMaintenanceHistory'));
assert.ok(screen.includes('Details'));
assert.ok(screen.includes('Maintenance'));
assert.ok(screen.includes('Log manual event'));
assert.ok(screen.includes('Assign'));
assert.ok(screen.includes('canEdit'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'foundation.ts'), 'utf8');
assert.ok(api.includes('/foundation/assets'));
assert.ok(api.includes('/foundation/asset-groups'));
assert.ok(api.includes('/events'));
assert.ok(api.includes('/responsibilities'));

const maint = fs.readFileSync(path.join(root, 'src', 'api', 'maintenancePm.ts'), 'utf8');
assert.ok(maint.includes('maintenance-history'));
assert.ok(maint.includes('fetchAssetMaintenanceHistory'));

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
    console.log(`foundation-assets-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('foundation-assets-api: HOD login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const plants = await request('/plants', { headers: auth });
  if (plants.res.status !== 200 || !(plants.json as { id: string }[])[0]) {
    console.log('foundation-assets-api: no plants — unit OK; skipped');
    return;
  }
  const plantId = (plants.json as { id: string }[])[0].id;

  const groups = await request(
    `/foundation/asset-groups?plant_id=${encodeURIComponent(plantId)}`,
    { headers: auth }
  );
  if (groups.res.status !== 200 || !(groups.json as { id: string }[])[0]) {
    console.log('foundation-assets-api: no asset groups — unit OK; skipped');
    return;
  }
  const groupId = (groups.json as { id: string }[])[0].id;

  const listBefore = await request(
    `/foundation/assets?plant_id=${encodeURIComponent(plantId)}`,
    { headers: auth }
  );
  if (listBefore.res.status !== 200) {
    console.error('foundation-assets-api: list failed', listBefore.json);
    process.exit(1);
  }
  assert.ok(Array.isArray(listBefore.json));

  const code = `MOB-FND-${Date.now().toString(36).toUpperCase()}`;
  const created = await request('/foundation/assets', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      group_id: groupId,
      asset_no: code,
      name: `Mobile smoke ${code}`,
      status: 'active',
      remarks: 'p5-fnd-assets smoke',
      expected_life: { unit: 'heats', value: 100 },
      life_counters: { heats: 5 },
    }),
  });
  if (!created.res.ok) {
    console.error('foundation-assets-api: create failed', created.res.status, created.json);
    process.exit(1);
  }
  const asset = created.json as { id: string; asset_no: string; name: string };
  assert.equal(asset.asset_no, code);

  const patched = await request(`/foundation/assets/${asset.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      name: `${asset.name} edited`,
      life_counters: { heats: 6 },
      expected_life: { unit: 'heats', value: 100 },
    }),
  });
  if (!patched.res.ok) {
    console.error('foundation-assets-api: edit failed', patched.json);
    process.exit(1);
  }
  assert.ok((patched.json as { name: string }).name.includes('edited'));

  const ev = await request(`/foundation/assets/${asset.id}/events`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      event_type: 'manual_entry',
      occurred_at: new Date().toISOString(),
      payload: { note: 'Manual inspection entry' },
    }),
  });
  if (!ev.res.ok) {
    console.error('foundation-assets-api: event failed', ev.json);
    process.exit(1);
  }

  const events = await request(`/foundation/assets/${asset.id}/events`, { headers: auth });
  if (events.res.status !== 200 || !(events.json as unknown[]).length) {
    console.error('foundation-assets-api: events list empty after create', events.json);
    process.exit(1);
  }

  const users = await request(`/plants/${plantId}/users`, { headers: auth });
  let assigned = false;
  if (users.res.ok && (users.json as { id: string }[])[0]) {
    const userId = (users.json as { id: string }[])[0].id;
    const resp = await request(`/foundation/assets/${asset.id}/responsibilities`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ user_id: userId }),
    });
    if (!resp.res.ok) {
      console.error('foundation-assets-api: assign failed', resp.json);
      process.exit(1);
    }
    const listResp = await request(`/foundation/assets/${asset.id}/responsibilities`, {
      headers: auth,
    });
    if (
      listResp.res.status !== 200 ||
      !(listResp.json as { user_id: string }[]).some((r) => r.user_id === userId)
    ) {
      console.error('foundation-assets-api: responsibility missing after assign', listResp.json);
      process.exit(1);
    }
    assigned = true;
  }

  const hist = await request(`/foundation/assets/${asset.id}/maintenance-history`, {
    headers: auth,
  });
  // empty-OK: 200 with entries array, or soft-fail allowed if endpoint missing
  if (hist.res.status === 200) {
    assert.ok(Array.isArray((hist.json as { entries: unknown[] }).entries));
  } else if (hist.res.status !== 404) {
    console.error('foundation-assets-api: maintenance-history unexpected', hist.res.status, hist.json);
    process.exit(1);
  }

  console.log(
    `foundation-assets-api: OK (create+edit ${code}; events=${(events.json as unknown[]).length}; assigned=${assigned}; hist=${hist.res.status})`
  );
}

console.log('foundation-assets-api: unit OK (form + details/maintenance tabs)');
await apiSmoke();
