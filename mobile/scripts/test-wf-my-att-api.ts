/**
 * P4-WF-MY-ATT — unit + API smoke: GET /workforce/me is self-only for worker.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'workforce', 'my-attendance.tsx'),
  'utf8'
);
assert.ok(route.includes('WORKER_ROLES'));
assert.ok(route.includes('MyAttendanceScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'MyAttendanceScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchWorkforceMe'));
assert.ok(screen.includes('Current shift assignment'));
assert.ok(screen.includes('Recent attendance'));
assert.ok(screen.includes('remarks'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'workforce.ts'), 'utf8');
assert.ok(api.includes('/workforce/me'));
assert.ok(api.includes('fetchWorkforceMe'));

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
    console.log(`wf-my-att-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('wf-my-att-api: worker login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };
  const meUser = (login.json as { user: { id: string; role: string } }).user;

  const me = await request('/workforce/me', { headers: auth });
  if (me.res.status !== 200) {
    console.error('wf-my-att-api: /workforce/me failed', me.res.status, me.json);
    process.exit(1);
  }
  const body = me.json as {
    shift_assignment?: { user_id?: string; department_code?: string; shift_code?: string } | null;
    recent_attendance?: { user_id: string; attendance_date: string; status: string }[];
  };
  if (!Array.isArray(body.recent_attendance)) {
    console.error('wf-my-att-api: recent_attendance not array', body);
    process.exit(1);
  }
  for (const row of body.recent_attendance) {
    if (row.user_id !== meUser.id) {
      console.error('wf-my-att-api: attendance row not self', row.user_id, meUser.id);
      process.exit(1);
    }
  }
  if (body.shift_assignment && body.shift_assignment.user_id && body.shift_assignment.user_id !== meUser.id) {
    console.error('wf-my-att-api: assignment not self', body.shift_assignment);
    process.exit(1);
  }

  // HR must not use worker self endpoint
  const hrLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'hr@chandansteel.com', password: 'hr123' }),
  });
  if (hrLogin.res.ok) {
    const hrAuth = {
      Authorization: `Bearer ${(hrLogin.json as { access_token: string }).access_token}`,
    };
    const hrMe = await request('/workforce/me', { headers: hrAuth });
    if (hrMe.res.status === 200) {
      console.error('wf-my-att-api: HR unexpectedly allowed on /workforce/me');
      process.exit(1);
    }
  }

  console.log(
    `wf-my-att-api: OK (self; assignment=${body.shift_assignment ? 'yes' : 'none'}; attendance=${body.recent_attendance.length})`
  );
}

console.log('wf-my-att-api: unit OK (My Attendance self screen)');
await apiSmoke();
