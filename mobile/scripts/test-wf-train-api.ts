/**
 * P4-WF-TRAIN — unit + API: create training with near expiry (Soon highlight).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(path.join(root, 'app', '(app)', 'workforce', 'training.tsx'), 'utf8');
const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'TrainingScreen.tsx'),
  'utf8'
);
const api = fs.readFileSync(path.join(root, 'src', 'api', 'workforceOps.ts'), 'utf8');
assert.ok(route.includes('TrainingScreen'));
assert.ok(screen.includes('Soon') && screen.includes('createTrainingRecord'));
assert.ok(api.includes('/workforce/ops/training'));

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

function isoPlusDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function apiSmoke() {
  let login;
  try {
    login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'hr@chandansteel.com', password: 'hr123' }),
    });
  } catch (err) {
    console.log(`wf-train-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('wf-train-api: login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };
  const emps = await request('/workforce/employees', { headers: auth });
  const empId = (emps.json as { id: string }[])[0]?.id;
  if (!empId) {
    console.log('wf-train-api: no employees — unit OK; skipped');
    return;
  }
  const expiry = isoPlusDays(14);
  const stamp = Date.now();
  const created = await request('/workforce/ops/training', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      user_id: empId,
      name: `Mobile Training ${stamp}`,
      certification: 'Forklift',
      issue_date: isoPlusDays(-30),
      expiry_date: expiry,
    }),
  });
  if (created.res.status !== 201 && created.res.status !== 200) {
    console.error('wf-train-api: create failed', created.res.status, created.json);
    process.exit(1);
  }
  const list = await request('/workforce/ops/training', { headers: auth });
  if (list.res.status !== 200) {
    console.error('wf-train-api: list failed', list.json);
    process.exit(1);
  }
  const found = (list.json as { id: string; expiry_date?: string; name: string }[]).find((r) =>
    r.name.includes(String(stamp))
  );
  if (!found || found.expiry_date !== expiry) {
    console.error('wf-train-api: record missing', found);
    process.exit(1);
  }
  console.log(`wf-train-api: OK (create; expiry=${expiry} Soon-eligible)`);
}

console.log('wf-train-api: unit OK (create + Soon wiring)');
await apiSmoke();
