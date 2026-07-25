/**
 * P4-WF-PLAN — unit + API smoke: create draft roster → publish → reload entries.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'workforce', 'shift-planning.tsx'),
  'utf8'
);
assert.ok(route.includes('WORKFORCE_HR_ROLES'));
assert.ok(route.includes('ShiftPlanningScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'ShiftPlanningScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('createShiftRoster'));
assert.ok(screen.includes('updateShiftRoster'));
assert.ok(screen.includes('publishShiftRoster'));
assert.ok(screen.includes('New roster'));
assert.ok(screen.includes('Save roster'));
assert.ok(screen.includes('Publish'));
assert.ok(!screen.includes('DesktopOnlyGate'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'workforceOps.ts'), 'utf8');
assert.ok(api.includes('/workforce/ops/rosters'));
assert.ok(api.includes('/publish'));

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

function weekStartIso(d = new Date()) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.getFullYear(), d.getMonth(), diff);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const dayNum = String(start.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

function weekDates(startIso: string) {
  const [y, m, d] = startIso.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const yy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    dates.push(`${yy}-${mm}-${dd}`);
  }
  return dates;
}

async function apiSmoke() {
  let login;
  try {
    login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'hr@chandansteel.com',
        password: 'hr123',
      }),
    });
  } catch (err) {
    console.log(`roster-publish-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('roster-publish-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const depts = await request('/departments', { headers: auth });
  if (depts.res.status !== 200) {
    console.error('roster-publish-api: departments failed', depts.json);
    process.exit(1);
  }
  const deptId = (depts.json as { id: string }[])[0]?.id;
  if (!deptId) {
    console.log('roster-publish-api: no dept — unit OK; skipped');
    return;
  }

  const [emps, shiftsRes] = await Promise.all([
    request(`/workforce/employees?department_id=${encodeURIComponent(deptId)}`, {
      headers: auth,
    }),
    request('/workforce/shifts', { headers: auth }),
  ]);
  if (emps.res.status !== 200 || shiftsRes.res.status !== 200) {
    console.error('roster-publish-api: employees/shifts failed');
    process.exit(1);
  }
  const employees = emps.json as { id: string }[];
  const shifts = shiftsRes.json as { id: string }[];
  if (!employees[0] || !shifts[0]) {
    console.log('roster-publish-api: missing emp/shift — unit OK; skipped');
    return;
  }

  // Use a far-future unique week so we don't collide with seeded drafts.
  const start = weekStartIso(new Date(Date.UTC(2030, 0, 7)));
  const dates = weekDates(start);
  const end = dates[dates.length - 1]!;
  const entries = employees.slice(0, 2).flatMap((emp) =>
    dates.slice(0, 2).map((roster_date) => ({
      user_id: emp.id,
      shift_id: shifts[0]!.id,
      roster_date,
    }))
  );

  const created = await request('/workforce/ops/rosters', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      department_id: deptId,
      period_start: start,
      period_end: end,
      period_type: 'weekly',
      entries,
    }),
  });
  if (created.res.status !== 201 && created.res.status !== 200) {
    console.error('roster-publish-api: create failed', created.res.status, created.json);
    process.exit(1);
  }
  const roster = created.json as { id: string; status: string; entries: unknown[] };
  if (roster.status !== 'draft') {
    console.error('roster-publish-api: expected draft', roster);
    process.exit(1);
  }

  const patched = await request(`/workforce/ops/rosters/${roster.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      period_start: start,
      period_end: end,
      entries: [
        ...entries,
        {
          user_id: employees[0]!.id,
          shift_id: shifts[0]!.id,
          roster_date: dates[2]!,
        },
      ],
    }),
  });
  if (patched.res.status !== 200) {
    console.error('roster-publish-api: patch failed', patched.res.status, patched.json);
    process.exit(1);
  }

  const published = await request(`/workforce/ops/rosters/${roster.id}/publish`, {
    method: 'POST',
    headers: auth,
  });
  if (published.res.status !== 200) {
    console.error('roster-publish-api: publish failed', published.res.status, published.json);
    process.exit(1);
  }
  if ((published.json as { status: string }).status !== 'published') {
    console.error('roster-publish-api: not published', published.json);
    process.exit(1);
  }

  const list = await request(
    `/workforce/ops/rosters?department_id=${encodeURIComponent(deptId)}`,
    { headers: auth }
  );
  if (list.res.status !== 200) {
    console.error('roster-publish-api: list failed', list.json);
    process.exit(1);
  }
  const found = (list.json as { id: string; entries: unknown[]; status: string }[]).find(
    (r) => r.id === roster.id
  );
  if (!found || found.status !== 'published' || !Array.isArray(found.entries) || found.entries.length < 1) {
    console.error('roster-publish-api: reload missing entries', found);
    process.exit(1);
  }

  console.log(
    `roster-publish-api: OK (draft→publish; entries=${found.entries.length})`
  );
}

console.log('roster-publish-api: unit OK (planning UI + roster APIs)');
await apiSmoke();
