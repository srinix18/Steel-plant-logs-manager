/**
 * P3-SAFE-SCAN — unit + API smoke (search + POST /safety/scan).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { workspaceHrefFromScan } from '../src/features/safety/workspaceHref.ts';

assert.equal(
  workspaceHrefFromScan({
    asset_id: 'abc-123',
    workspace_url: '/assets/abc-123/workspace',
  }),
  '/(app)/assets/abc-123/workspace'
);
assert.equal(
  workspaceHrefFromScan({
    asset_id: 'fallback-id',
    workspace_url: '/other',
  }),
  '/(app)/assets/fallback-id/workspace'
);

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(path.join(root, 'app', '(app)', 'safety', 'scan.tsx'), 'utf8');
assert.ok(route.includes('SAFETY_MODULE_ROLES') || route.includes('SafetyScanScreen'));
assert.ok(route.includes('SafetyScanScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'safety', 'SafetyScanScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('expo-camera'));
assert.ok(screen.includes('CameraView'));
assert.ok(screen.includes('searchSafetyAssets'));
assert.ok(screen.includes('scanQrPayload'));
assert.ok(screen.includes('250'));

assert.ok(
  fs.existsSync(path.join(root, 'app', '(app)', 'assets', '[id]', 'workspace.tsx'))
);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
};
assert.ok(pkg.dependencies['expo-camera'], 'expo-camera dependency required');

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
        email: 'melter@chandansteel.com',
        password: 'worker123',
      }),
    });
  } catch (err) {
    console.log(`safety-scan-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('safety-scan-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const meRes = await request('/auth/me', { headers: auth });
  const me = meRes.res.ok ? (meRes.json as { plant_id?: string }) : {};
  const plantsRes = await request('/plants', { headers: auth });
  const plants = plantsRes.res.ok ? (plantsRes.json as { id: string }[]) : [];
  const plantId = me.plant_id || plants[0]?.id;

  const searchQ = plantId
    ? `/safety/assets/search?q=IAF&plant_id=${plantId}&limit=10`
    : '/safety/assets/search?q=IAF&limit=10';
  const search = await request(searchQ, { headers: auth });
  if (!search.res.ok) {
    console.error('safety-scan-api: search failed', search.json);
    process.exit(1);
  }
  if (!Array.isArray(search.json)) {
    console.error('safety-scan-api: search not array', search.json);
    process.exit(1);
  }
  const matches = search.json as { id: string; asset_no: string }[];
  console.log(`ok  search → ${matches.length} match(es)`);

  const unknown = await request('/safety/scan', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ payload: `unknown-qr-${Date.now()}` }),
  });
  if (unknown.res.ok) {
    console.error('safety-scan-api: unknown QR should 404');
    process.exit(1);
  }
  if (unknown.res.status !== 404) {
    console.error('safety-scan-api: expected 404 for unknown QR', unknown.res.status, unknown.json);
    process.exit(1);
  }
  console.log('ok  unknown QR → 404');

  let payload: string | null = null;
  if (matches[0]?.id) {
    payload = `asset:${matches[0].id}`;
  }
  if (!payload) {
    // Fall back: try listing assets
    const assetsRes = plantId
      ? await request(`/assets?plant_id=${plantId}`, { headers: auth })
      : await request('/assets', { headers: auth });
    const assets = assetsRes.res.ok ? (assetsRes.json as { id: string }[]) : [];
    if (assets[0]?.id) payload = `asset:${assets[0].id}`;
  }

  if (!payload) {
    console.log('safety-scan-api: no asset for known scan — unit OK; skipped create path');
    return;
  }

  const scanned = await request('/safety/scan', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ payload }),
  });
  if (!scanned.res.ok) {
    console.error('safety-scan-api: known scan failed', scanned.json);
    process.exit(1);
  }
  const result = scanned.json as { asset_id: string; workspace_url: string };
  if (!result.asset_id || !result.workspace_url?.includes('/workspace')) {
    console.error('safety-scan-api: bad scan payload', result);
    process.exit(1);
  }
  assert.equal(workspaceHrefFromScan(result), `/(app)/assets/${result.asset_id}/workspace`);
  console.log(`ok  scan → ${result.asset_id} ${result.workspace_url}`);
}

await apiSmoke();
console.log('safety-scan-api: unit OK (camera wiring + href helper)');
