/**
 * P5-INV — unit + API: inventory list; adjust quantity persists on reload.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'inventory-pulse', 'index.tsx'),
  'utf8'
);
assert.ok(route.includes('CEO_TIER_ROLES'));
assert.ok(route.includes('InventoryPulseScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'inventory', 'InventoryPulseScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchInventoryPulse'));
assert.ok(screen.includes('adjustInventory'));
assert.ok(screen.includes('critical'));
assert.ok(screen.includes('Adjust'));
assert.ok(screen.includes('New quantity') || screen.includes('quantity'));
assert.ok(screen.includes('quality_grade') || screen.includes('Quality grade'));
assert.ok(screen.includes('location') || screen.includes('Location'));
assert.ok(screen.includes('Days remaining') || screen.includes('days_remaining'));
assert.ok(screen.includes('Supplier') || screen.includes('supplier'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'inventoryPulse.ts'), 'utf8');
assert.ok(api.includes('/inventory-pulse/'));
assert.ok(api.includes('/adjust'));
assert.ok(api.includes('adjustInventory'));

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
    console.log(`inventory-pulse-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('inventory-pulse-api: CEO login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const plants = await request('/plants', { headers: auth });
  if (plants.res.status !== 200 || !(plants.json as { id: string }[])[0]) {
    console.log('inventory-pulse-api: no plants — unit OK; skipped');
    return;
  }
  const plantId = (plants.json as { id: string }[])[0].id;

  const listRes = await request(`/inventory-pulse/${plantId}`, { headers: auth });
  if (listRes.res.status !== 200) {
    console.error('inventory-pulse-api: list failed', listRes.json);
    process.exit(1);
  }
  assert.ok(Array.isArray(listRes.json));
  const items = listRes.json as {
    material_code: string;
    quantity: number;
    status: string;
  }[];
  const critical = items.filter((i) => i.status === 'critical').length;

  if (items.length === 0) {
    const created = await request(`/inventory-pulse/${plantId}/adjust`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        material_code: 'SMOKE-INV',
        quantity: 42,
        location: 'mobile-smoke',
      }),
    });
    if (!created.res.ok) {
      console.error('inventory-pulse-api: create-via-adjust failed', created.json);
      process.exit(1);
    }
    const again = await request(`/inventory-pulse/${plantId}`, { headers: auth });
    const found = (again.json as { material_code: string; quantity: number }[]).find(
      (i) => i.material_code === 'SMOKE-INV'
    );
    if (!found || found.quantity !== 42) {
      console.error('inventory-pulse-api: adjusted item missing after create', found);
      process.exit(1);
    }
    console.log('inventory-pulse-api: OK (empty→adjust create; qty=42)');
    return;
  }

  const target = items[0];
  const newQty = Number((Number(target.quantity) + 1.5).toFixed(3));
  const adj = await request(`/inventory-pulse/${plantId}/adjust`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      material_code: target.material_code,
      quantity: newQty,
      quality_grade: 'smoke-grade',
      location: 'mobile-smoke-bay',
    }),
  });
  if (!adj.res.ok) {
    console.error('inventory-pulse-api: adjust failed', adj.res.status, adj.json);
    process.exit(1);
  }
  const adjBody = adj.json as { material_code: string; quantity: number; status: string };
  assert.equal(adjBody.material_code, target.material_code);
  assert.equal(Number(adjBody.quantity), newQty);

  const reload = await request(`/inventory-pulse/${plantId}`, { headers: auth });
  if (reload.res.status !== 200) {
    console.error('inventory-pulse-api: reload failed', reload.json);
    process.exit(1);
  }
  const updated = (reload.json as { material_code: string; quantity: number; location?: string }[]).find(
    (i) => i.material_code === target.material_code
  );
  if (!updated || Number(updated.quantity) !== newQty) {
    console.error('inventory-pulse-api: quantity not updated on reload', updated);
    process.exit(1);
  }

  // Restore prior quantity to keep demo data stable.
  await request(`/inventory-pulse/${plantId}/adjust`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      material_code: target.material_code,
      quantity: target.quantity,
    }),
  });

  console.log(
    `inventory-pulse-api: OK (items=${items.length}; critical=${critical}; adjust ${target.material_code} ${target.quantity}→${newQty}→restored)`
  );
}

console.log('inventory-pulse-api: unit OK (list + critical banner + adjust form)');
await apiSmoke();
