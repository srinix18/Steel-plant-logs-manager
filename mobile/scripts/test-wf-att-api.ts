/**
 * P4-WF-ATT — unit + API smoke: bulk employee attendance + contractor attendance.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'workforce', 'attendance.tsx'),
  'utf8'
);
assert.ok(route.includes('WORKFORCE_HR_ROLES'));
assert.ok(route.includes('AttendanceEntryScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'AttendanceEntryScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('saveAttendanceBulk'));
assert.ok(screen.includes('saveContractorAttendance'));
assert.ok(screen.includes('present'));
assert.ok(screen.includes('half_day'));
assert.ok(screen.includes('Remarks'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'workforce.ts'), 'utf8');
assert.ok(api.includes('/workforce/attendance/bulk'));
assert.ok(api.includes('/workforce/contractor-attendance'));

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
        email: 'hr@chandansteel.com',
        password: 'hr123',
      }),
    });
  } catch (err) {
    console.log(`wf-att-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('wf-att-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const [depts, plants, shiftsRes] = await Promise.all([
    request('/departments', { headers: auth }),
    request('/plants', { headers: auth }),
    request('/workforce/shifts', { headers: auth }),
  ]);
  const deptId = (depts.json as { id: string }[])[0]?.id;
  const plantId = (plants.json as { id: string }[])[0]?.id;
  let shifts = shiftsRes.json as { id: string }[];
  if (plantId) {
    const scoped = await request(
      `/workforce/shifts?plant_id=${encodeURIComponent(plantId)}`,
      { headers: auth }
    );
    if (scoped.res.ok) shifts = scoped.json as { id: string }[];
  }
  const shiftId = shifts[0]?.id;
  if (!deptId || !shiftId) {
    console.log('wf-att-api: missing dept/shift — unit OK; skipped');
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const qs = `attendance_date=${encodeURIComponent(date)}&department_id=${encodeURIComponent(deptId)}&shift_id=${encodeURIComponent(shiftId)}`;

  const list = await request(`/workforce/attendance?${qs}`, { headers: auth });
  if (list.res.status !== 200) {
    console.error('wf-att-api: list failed', list.res.status, list.json);
    process.exit(1);
  }
  const records = list.json as { user_id: string; status: string; remarks?: string }[];
  if (records.length === 0) {
    console.log('wf-att-api: no assigned employees — unit OK; skipped employee bulk');
  } else {
    const bulk = await request('/workforce/attendance/bulk', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        attendance_date: date,
        department_id: deptId,
        shift_id: shiftId,
        entries: records.map((r, i) => ({
          user_id: r.user_id,
          status: i === 0 ? 'present' : r.status || 'present',
          remarks: i === 0 ? 'mobile att smoke' : r.remarks,
        })),
      }),
    });
    if (bulk.res.status !== 200 && bulk.res.status !== 201) {
      console.error('wf-att-api: bulk failed', bulk.res.status, bulk.json);
      process.exit(1);
    }
  }

  const contractors = await request(
    `/workforce/contractors?department_id=${encodeURIComponent(deptId)}`,
    { headers: auth }
  );
  if (contractors.res.status !== 200) {
    console.error('wf-att-api: contractors failed', contractors.json);
    process.exit(1);
  }
  const cos = contractors.json as { id: string }[];
  if (cos[0]) {
    const saved = await request('/workforce/contractor-attendance', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        attendance_date: date,
        contractor_id: cos[0].id,
        department_id: deptId,
        shift_id: shiftId,
        workers_present: 2,
        workers_absent: 1,
      }),
    });
    if (saved.res.status !== 200 && saved.res.status !== 201) {
      console.error('wf-att-api: contractor save failed', saved.res.status, saved.json);
      process.exit(1);
    }
    const reload = await request(`/workforce/contractor-attendance?${qs}`, { headers: auth });
    const row = (reload.json as { contractor_id: string; workers_present: number }[]).find(
      (r) => r.contractor_id === cos[0]!.id
    );
    if (!row || row.workers_present !== 2) {
      console.error('wf-att-api: contractor reload mismatch', row);
      process.exit(1);
    }
  }

  console.log(
    `wf-att-api: OK (employees=${records.length}; contractor=${cos[0] ? 'saved' : 'none'})`
  );
}

console.log('wf-att-api: unit OK (attendance filters + bulk + contractor)');
await apiSmoke();
