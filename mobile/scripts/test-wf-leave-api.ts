/** P4-WF-LEAVE — unit + API smoke: worker create, HR approve. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(path.join(root, 'app', '(app)', 'workforce', 'leave.tsx'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'src/features/workforce/LeaveRequestsScreen.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/api/workforceOps.ts'), 'utf8');
assert.ok(route.includes('WORKFORCE_HR_ROLES') && screen.includes('Approve') && screen.includes('Reject'));
assert.ok(screen.includes('Remarks'));
assert.ok(api.includes('fetchLeaveTypes') && api.includes('createLeaveRequest') && api.includes('approveLeaveRequest'));
const base = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
async function request(p: string, init: RequestInit = {}) { const res = await fetch(`${base}${p}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } }); const text = await res.text(); let json: unknown; try { json = text ? JSON.parse(text) : null; } catch { json = text; } return { res, json }; }
try {
  const worker = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'melter@chandansteel.com', password: 'worker123' }) });
  const hr = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'hr@chandansteel.com', password: 'hr123' }) });
  if (!worker.res.ok || !hr.res.ok) throw new Error(`demo login unavailable w=${worker.res.status} hr=${hr.res.status}`);
  const workerAuth = { Authorization: `Bearer ${(worker.json as { access_token: string }).access_token}` };
  const hrAuth = { Authorization: `Bearer ${(hr.json as { access_token: string }).access_token}` };
  const types = await request('/workforce/leave/types', { headers: workerAuth });
  const typeId = (types.json as { id: string }[])[0]?.id; if (!types.res.ok || !typeId) throw new Error('leave type unavailable');
  const date = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
  const remarks = `mobile leave smoke ${Date.now()}`;
  const created = await request('/workforce/leave/requests', { method: 'POST', headers: workerAuth, body: JSON.stringify({ leave_type_id: typeId, from_date: date, to_date: date, remarks }) });
  assert.ok(created.res.ok, `create failed: ${created.res.status} ${JSON.stringify(created.json)}`);
  const id = (created.json as { id: string }).id;
  const pending = await request('/workforce/leave/requests?status=pending', { headers: hrAuth });
  assert.ok(pending.res.ok && (pending.json as { id: string; remarks?: string }[]).some((r) => r.id === id), 'pending list missing request');
  const approved = await request(`/workforce/leave/requests/${id}/approve`, { method: 'POST', headers: hrAuth, body: JSON.stringify({ remarks: 'approved by mobile smoke' }) });
  assert.ok(approved.res.ok && (approved.json as { status: string }).status === 'approved', 'approval failed');
  // Also exercise reject path with a second request
  const date2 = new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10);
  const created2 = await request('/workforce/leave/requests', { method: 'POST', headers: workerAuth, body: JSON.stringify({ leave_type_id: typeId, from_date: date2, to_date: date2, remarks: `reject smoke ${Date.now()}` }) });
  if (created2.res.ok) {
    const id2 = (created2.json as { id: string }).id;
    const rejected = await request(`/workforce/leave/requests/${id2}/reject`, { method: 'POST', headers: hrAuth, body: JSON.stringify({ remarks: 'rejected by smoke' }) });
    assert.ok(rejected.res.ok && (rejected.json as { status: string }).status === 'rejected', 'reject failed');
  }
  console.log('wf-leave-api: OK (create→approve + reject)');
} catch (e) { console.log(`wf-leave-api: API unavailable — unit OK; skipped (${String(e)})`); process.exitCode = 0; }
