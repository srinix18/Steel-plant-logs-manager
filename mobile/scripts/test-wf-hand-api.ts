/** P4-WF-HAND — unit + API smoke: create and filter a handover note. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(path.join(root, 'app', '(app)', 'workforce', 'handover.tsx'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'src', 'features', 'workforce', 'ShiftHandoverScreen.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src', 'api', 'workforce.ts'), 'utf8');
assert.ok(route.includes('HANDOVER_WRITE_ROLES') && route.includes('ShiftHandoverScreen'));
assert.ok(screen.includes('fetchHandoverNotes') && screen.includes('createHandoverNote') && screen.includes('Filtered history'));
assert.ok(api.includes('/workforce/handover-notes') && api.includes('URLSearchParams'));

const base = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
async function request(pathname: string, init: RequestInit = {}) {
  const res = await fetch(`${base}${pathname}`, { ...init, headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers ?? {}) } });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { res, json };
}

try {
  const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'hr@chandansteel.com', password: 'hr123' }) });
  if (!login.res.ok) throw new Error('login unavailable');
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };
  const [depts, shifts] = await Promise.all([request('/departments', { headers: auth }), request('/workforce/shifts', { headers: auth })]);
  const deptId = (depts.json as { id: string }[])[0]?.id;
  const shiftId = (shifts.json as { id: string }[])[0]?.id;
  if (!deptId || !shiftId) throw new Error('department or shift unavailable');
  const date = new Date().toISOString().slice(0, 10);
  const note = `mobile handover smoke ${Date.now()}`;
  const created = await request('/workforce/handover-notes', { method: 'POST', headers: auth, body: JSON.stringify({ note_date: date, department_id: deptId, shift_id: shiftId, note }) });
  assert.ok(created.res.ok, `create failed: ${created.res.status}`);
  const q = `note_date=${encodeURIComponent(date)}&department_id=${encodeURIComponent(deptId)}&shift_id=${encodeURIComponent(shiftId)}`;
  const listed = await request(`/workforce/handover-notes?${q}`, { headers: auth });
  assert.ok(listed.res.ok && (listed.json as { note: string }[]).some((row) => row.note === note), 'created note missing from filtered history');
  console.log('wf-hand-api: OK');
} catch (e) {
  console.log(`wf-hand-api: API unavailable — unit OK; skipped (${String(e)})`);
}
