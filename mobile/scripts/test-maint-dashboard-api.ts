/**
 * P3-MAINT-DASH — unit + API smoke: intelligence + analytics (+ evaluate counts).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'maintenance', 'dashboard.tsx'),
  'utf8'
);
assert.ok(route.includes('MAINTENANCE_PM_VIEW_ROLES'));
assert.ok(route.includes('MaintenanceDashboardScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'maintenance', 'MaintenanceDashboardScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchMaintenanceIntelligence'));
assert.ok(screen.includes('fetchMaintenanceAnalytics'));
assert.ok(screen.includes('evaluatePmTriggers'));
assert.ok(screen.includes('Assets Running'));
assert.ok(screen.includes('Under PM'));
assert.ok(screen.includes('Work orders'));
assert.ok(screen.includes('/(app)/maintenance/work-orders'));
assert.ok(screen.includes('Run PM evaluate'));
assert.ok(screen.includes('Force evaluate'));
assert.ok(screen.includes('Work order status breakdown'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'maintenancePm.ts'), 'utf8');
assert.ok(api.includes('/maintenance/intelligence'));
assert.ok(api.includes('/maintenance/pm/analytics'));
assert.ok(api.includes('/maintenance/pm/evaluate'));

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
        email: 'maint.quality@chandansteel.com',
        password: 'maint123',
      }),
    });
  } catch (err) {
    console.log(`maint-dashboard-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('maint-dashboard-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const meRes = await request('/auth/me', { headers: auth });
  const me = meRes.res.ok ? (meRes.json as { plant_id?: string }) : {};
  const plantsRes = await request('/plants', { headers: auth });
  if (!plantsRes.res.ok) {
    console.error('maint-dashboard-api: plants failed', plantsRes.json);
    process.exit(1);
  }
  const plants = plantsRes.json as { id: string }[];
  const plantId = me.plant_id || plants[0]?.id;
  if (!plantId) {
    console.log('maint-dashboard-api: no plant — unit OK; skipped');
    return;
  }

  const intel = await request(
    `/maintenance/intelligence?plant_id=${encodeURIComponent(plantId)}`,
    { headers: auth }
  );
  if (intel.res.status !== 200) {
    console.error('maint-dashboard-api: intelligence not 200', intel.res.status, intel.json);
    process.exit(1);
  }
  const intelBody = intel.json as Record<string, unknown>;
  for (const key of [
    'assets_running',
    'under_pm',
    'breakdown',
    'waiting_parts',
    'waiting_shutdown',
    'completed_today',
    'upcoming_pm',
  ] as const) {
    if (typeof intelBody[key] !== 'number') {
      console.error(`maint-dashboard-api: missing intel KPI ${key}`, intelBody);
      process.exit(1);
    }
  }

  const analytics = await request(
    `/maintenance/pm/analytics?plant_id=${encodeURIComponent(plantId)}`,
    { headers: auth }
  );
  if (analytics.res.status !== 200) {
    console.error('maint-dashboard-api: analytics not 200', analytics.res.status, analytics.json);
    process.exit(1);
  }
  const a = analytics.json as {
    open_work_orders?: number;
    overdue_work_orders?: number;
    completed_work_orders?: number;
    total_downtime_min?: number;
  };
  for (const key of [
    'open_work_orders',
    'overdue_work_orders',
    'completed_work_orders',
    'total_downtime_min',
  ] as const) {
    if (typeof a[key] !== 'number') {
      console.error(`maint-dashboard-api: missing analytics ${key}`, a);
      process.exit(1);
    }
  }

  const evaluate = await request(
    `/maintenance/pm/evaluate?plant_id=${encodeURIComponent(plantId)}`,
    { method: 'POST', headers: auth }
  );
  if (evaluate.res.status !== 200) {
    console.error('maint-dashboard-api: evaluate not 200', evaluate.res.status, evaluate.json);
    process.exit(1);
  }
  const ev = evaluate.json as {
    triggers_evaluated?: number;
    work_orders_generated?: number;
    notifications_sent?: number;
  };
  for (const key of [
    'triggers_evaluated',
    'work_orders_generated',
    'notifications_sent',
  ] as const) {
    if (typeof ev[key] !== 'number') {
      console.error(`maint-dashboard-api: missing evaluate ${key}`, ev);
      process.exit(1);
    }
  }

  console.log(
    `maint-dashboard-api: OK (intel + analytics + evaluate ${ev.triggers_evaluated} triggers)`
  );
}

console.log('maint-dashboard-api: unit OK (KPIs + evaluate + WO link)');
await apiSmoke();
