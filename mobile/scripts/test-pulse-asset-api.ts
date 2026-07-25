/**
 * P5-PULSE-ASSET — unit + API: asset pulse + OEE; Open Workspace route wired.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'assets', '[id]', 'pulse.tsx'),
  'utf8'
);
assert.ok(route.includes('AssetPulseScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'pulse', 'AssetPulseScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchAssetPulse'));
assert.ok(screen.includes("fetchOee('asset'"));
assert.ok(screen.includes('Open Workspace'));
assert.ok(screen.includes('/workspace'));
assert.ok(screen.includes('Health'));
assert.ok(screen.includes('Live Parameters'));
assert.ok(screen.includes('current_operator') || screen.includes('Operator'));
assert.ok(screen.includes('Current Run'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'pulse.ts'), 'utf8');
assert.ok(api.includes('/pulse/asset/'));

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
    console.log(`pulse-asset-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('pulse-asset-api: CEO login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const assets = await request('/assets', { headers: auth });
  if (assets.res.status !== 200 || !(assets.json as { id: string }[])[0]) {
    console.log('pulse-asset-api: no assets — unit OK; skipped');
    return;
  }
  const assetId = (assets.json as { id: string }[])[0].id;

  const pulse = await request(`/pulse/asset/${assetId}`, { headers: auth });
  if (pulse.res.status !== 200) {
    console.error('pulse-asset-api: asset pulse failed', pulse.json);
    process.exit(1);
  }
  const p = pulse.json as {
    asset_id: string;
    asset_name: string;
    oee: { oee: number };
    live_parameters: unknown[];
  };
  assert.equal(p.asset_id, assetId);
  assert.ok(p.oee && typeof p.oee.oee === 'number');
  assert.ok(Array.isArray(p.live_parameters));

  const oeeRes = await request(`/oee/asset/${assetId}`, { headers: auth });
  if (oeeRes.res.status !== 200) {
    console.error('pulse-asset-api: oee failed', oeeRes.json);
    process.exit(1);
  }

  console.log(
    `pulse-asset-api: OK (asset=${p.asset_name}; params=${p.live_parameters.length}; workspace=/assets/${assetId}/workspace)`
  );
}

console.log('pulse-asset-api: unit OK (health/OEE/operator/run + Open Workspace)');
await apiSmoke();
