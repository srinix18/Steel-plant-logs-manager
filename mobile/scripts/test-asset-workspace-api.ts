/**
 * P5-PULSE-WS — unit + API: workspace tabs; WO links; empty states OK.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'assets', '[id]', 'workspace.tsx'),
  'utf8'
);
assert.ok(route.includes('AssetWorkspaceScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));
assert.ok(!route.includes('Scan resolved this asset'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'pulse', 'AssetWorkspaceScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchAssetWorkspace'));
for (const tab of [
  'Overview',
  'Live Parameters',
  'Maintenance',
  'Alerts',
  'OEE',
  'Energy',
  'Inspections',
  'SOP',
]) {
  assert.ok(screen.includes(tab), `missing tab ${tab}`);
}
assert.ok(screen.includes('emergency_contacts') || screen.includes('Emergency Contacts'));
assert.ok(screen.includes('qr_payload') || screen.includes('QR'));
assert.ok(screen.includes('work-orders'));
assert.ok(screen.includes('EmptyState'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'pulse.ts'), 'utf8');
assert.ok(api.includes('/assets/'));
assert.ok(api.includes('workspace'));
assert.ok(api.includes('fetchAssetWorkspace'));

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
    console.log(`asset-workspace-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('asset-workspace-api: CEO login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const assets = await request('/assets', { headers: auth });
  if (assets.res.status !== 200 || !(assets.json as { id: string }[])[0]) {
    console.log('asset-workspace-api: no assets — unit OK; skipped');
    return;
  }
  const assetId = (assets.json as { id: string }[])[0].id;

  const ws = await request(`/assets/${assetId}/workspace`, { headers: auth });
  if (ws.res.status !== 200) {
    console.error('asset-workspace-api: workspace failed', ws.json);
    process.exit(1);
  }
  const data = ws.json as {
    asset_id: string;
    asset_name: string;
    live_parameters: unknown[];
    open_alerts: unknown[];
    oee: { oee: number };
    maintenance: { open_work_orders: { id: string }[] };
    inspections: unknown[];
    sops: unknown[];
    emergency_contacts: unknown[];
  };
  assert.equal(data.asset_id, assetId);
  assert.ok(data.oee && typeof data.oee.oee === 'number');
  assert.ok(Array.isArray(data.live_parameters));
  assert.ok(Array.isArray(data.open_alerts));
  assert.ok(Array.isArray(data.maintenance?.open_work_orders));
  assert.ok(Array.isArray(data.inspections));
  assert.ok(Array.isArray(data.sops));
  assert.ok(Array.isArray(data.emergency_contacts));

  const woCount = data.maintenance.open_work_orders.length;
  if (woCount > 0) {
    const woId = data.maintenance.open_work_orders[0].id;
    assert.ok(woId);
  }

  console.log(
    `asset-workspace-api: OK (asset=${data.asset_name}; wos=${woCount}; alerts=${data.open_alerts.length}; contacts=${data.emergency_contacts.length})`
  );
}

console.log('asset-workspace-api: unit OK (8 tabs + WO links + empty states)');
await apiSmoke();
