/**
 * P3-MAINT-PM-WIZ — unit + API smoke: 6-step create (trigger+task) → active; edit loads nested.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const newRoute = fs.readFileSync(
  path.join(root, 'app', '(app)', 'maintenance', 'programs', 'new.tsx'),
  'utf8'
);
assert.ok(newRoute.includes('MAINTENANCE_MANAGER_ROLES'));
assert.ok(newRoute.includes('MaintenanceProgramWizardScreen'));
assert.ok(!newRoute.includes('RoleHomePlaceholder'));

const editRoute = fs.readFileSync(
  path.join(root, 'app', '(app)', 'maintenance', 'programs', '[id]', 'edit.tsx'),
  'utf8'
);
assert.ok(editRoute.includes('MaintenanceProgramWizardScreen'));
assert.ok(editRoute.includes('programId'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'maintenance', 'MaintenanceProgramWizardScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes("'Program'"));
assert.ok(screen.includes("'Triggers'"));
assert.ok(screen.includes("'Tasks'"));
assert.ok(screen.includes("'Notifications'"));
assert.ok(screen.includes("'Auto WO'"));
assert.ok(screen.includes("'Review'"));
assert.ok(screen.includes('createProgramTrigger'));
assert.ok(screen.includes('createProgramTaskTemplate'));
assert.ok(screen.includes('createProgramNotificationRule'));
assert.ok(screen.includes('fetchMaintenanceProgramDetail'));
assert.ok(screen.includes('fetchFoundationAssets'));
assert.ok(screen.includes('Add at least one trigger'));
assert.ok(screen.includes('Add at least one task'));
assert.ok(screen.includes("status: 'active'"));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'maintenancePm.ts'), 'utf8');
assert.ok(api.includes('fetchMaintenanceProgramDetail'));
assert.ok(api.includes('/triggers'));
assert.ok(api.includes('/tasks'));
assert.ok(api.includes('/notifications'));

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
        email: 'ceo@chandansteel.com',
        password: 'ceo123',
      }),
    });
  } catch (err) {
    console.log(`pm-wizard-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('pm-wizard-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const meRes = await request('/auth/me', { headers: auth });
  const me = meRes.res.ok ? (meRes.json as { plant_id?: string }) : {};
  const plantsRes = await request('/plants', { headers: auth });
  if (!plantsRes.res.ok) {
    console.error('pm-wizard-api: plants failed', plantsRes.json);
    process.exit(1);
  }
  const plants = plantsRes.json as { id: string }[];
  const plantId = me.plant_id || plants[0]?.id;
  if (!plantId) {
    console.log('pm-wizard-api: no plant — unit OK; skipped');
    return;
  }

  // Lookups used by wizard
  const depts = await request(`/departments?plant_id=${encodeURIComponent(plantId)}`, {
    headers: auth,
  });
  if (depts.res.status !== 200) {
    console.error('pm-wizard-api: departments failed', depts.res.status, depts.json);
    process.exit(1);
  }
  const assets = await request(`/foundation/assets?plant_id=${encodeURIComponent(plantId)}`, {
    headers: auth,
  });
  if (assets.res.status !== 200) {
    console.error('pm-wizard-api: foundation assets failed', assets.res.status, assets.json);
    process.exit(1);
  }

  const created = await request('/maintenance/pm/programs', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      plant_id: plantId,
      name: `Mobile PM wizard smoke ${Date.now()}`,
      category: 'equipment',
      priority: 'medium',
      status: 'draft',
      auto_generate_work_orders: true,
    }),
  });
  if (created.res.status !== 201 && created.res.status !== 200) {
    console.error('pm-wizard-api: create failed', created.res.status, created.json);
    process.exit(1);
  }
  const program = created.json as { id: string };

  const trigger = await request(`/maintenance/pm/programs/${program.id}/triggers`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ trigger_type: 'time', interval_days: 30 }),
  });
  if (trigger.res.status !== 201 && trigger.res.status !== 200) {
    console.error('pm-wizard-api: trigger failed', trigger.res.status, trigger.json);
    process.exit(1);
  }

  const task = await request(`/maintenance/pm/programs/${program.id}/tasks`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name: 'Wizard smoke task',
      checklist: [{ label: 'Check OK', type: 'checkbox' }],
      sort_order: 0,
    }),
  });
  if (task.res.status !== 201 && task.res.status !== 200) {
    console.error('pm-wizard-api: task failed', task.res.status, task.json);
    process.exit(1);
  }

  const notif = await request(`/maintenance/pm/programs/${program.id}/notifications`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ offset_days: 7, recipient_role: 'maintenance' }),
  });
  if (notif.res.status !== 201 && notif.res.status !== 200) {
    console.error('pm-wizard-api: notification failed', notif.res.status, notif.json);
    process.exit(1);
  }

  const auto = await request(`/maintenance/pm/programs/${program.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ auto_generate_work_orders: true }),
  });
  if (auto.res.status !== 200) {
    console.error('pm-wizard-api: auto WO patch failed', auto.res.status, auto.json);
    process.exit(1);
  }

  const finish = await request(`/maintenance/pm/programs/${program.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'active' }),
  });
  if (finish.res.status !== 200) {
    console.error('pm-wizard-api: finish active failed', finish.res.status, finish.json);
    process.exit(1);
  }
  const finished = finish.json as { status: string };
  if (finished.status !== 'active') {
    console.error('pm-wizard-api: expected active', finished);
    process.exit(1);
  }

  const detail = await request(`/maintenance/pm/programs/${program.id}`, { headers: auth });
  if (detail.res.status !== 200) {
    console.error('pm-wizard-api: detail failed', detail.res.status, detail.json);
    process.exit(1);
  }
  const body = detail.json as {
    program?: { id: string; status: string };
    triggers?: unknown[];
    task_templates?: unknown[];
    notification_rules?: unknown[];
  };
  if (!body.program?.id) {
    console.error('pm-wizard-api: detail missing program', body);
    process.exit(1);
  }
  if (!Array.isArray(body.triggers) || body.triggers.length < 1) {
    console.error('pm-wizard-api: detail missing triggers', body);
    process.exit(1);
  }
  if (!Array.isArray(body.task_templates) || body.task_templates.length < 1) {
    console.error('pm-wizard-api: detail missing tasks', body);
    process.exit(1);
  }
  if (!Array.isArray(body.notification_rules) || body.notification_rules.length < 1) {
    console.error('pm-wizard-api: detail missing notifications', body);
    process.exit(1);
  }

  console.log(
    `pm-wizard-api: OK (program active; ${body.triggers.length} trigger(s), ${body.task_templates.length} task(s))`
  );
}

console.log('pm-wizard-api: unit OK (6 steps + finish gates + edit load)');
await apiSmoke();
