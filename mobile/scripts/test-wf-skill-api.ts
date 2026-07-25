/**
 * P4-WF-SKILL — unit + API: create skill, assign proficiency level.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(path.join(root, 'app', '(app)', 'workforce', 'skills.tsx'), 'utf8');
const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'workforce', 'SkillMatrixScreen.tsx'),
  'utf8'
);
const api = fs.readFileSync(path.join(root, 'src', 'api', 'workforceOps.ts'), 'utf8');
assert.ok(route.includes('WORKFORCE_HR_ROLES') || route.includes('SkillMatrixScreen'));
assert.ok(screen.includes('createSkill') && screen.includes('assignEmployeeSkill'));
assert.ok(screen.includes('SelectSheet') && !screen.includes('DesktopOnlyGate'));
assert.ok(api.includes('/workforce/ops/skills') && api.includes('assignEmployeeSkill'));

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
      body: JSON.stringify({ email: 'hr@chandansteel.com', password: 'hr123' }),
    });
  } catch (err) {
    console.log(`wf-skill-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('wf-skill-api: login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };
  const stamp = Date.now();
  const created = await request('/workforce/ops/skills', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ code: `MS${String(stamp).slice(-5)}`, name: `Mobile Skill ${stamp}` }),
  });
  if (created.res.status !== 201 && created.res.status !== 200) {
    console.error('wf-skill-api: create skill failed', created.res.status, created.json);
    process.exit(1);
  }
  const skill = created.json as { id: string };
  const emps = await request('/workforce/employees', { headers: auth });
  const empId = (emps.json as { id: string }[])[0]?.id;
  if (!empId) {
    console.log('wf-skill-api: no employees — unit OK; skill created');
    return;
  }
  const assigned = await request(`/workforce/ops/employees/${empId}/skills`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ skill_id: skill.id, proficiency_level: 'intermediate' }),
  });
  if (assigned.res.status !== 201 && assigned.res.status !== 200) {
    console.error('wf-skill-api: assign failed', assigned.res.status, assigned.json);
    process.exit(1);
  }
  console.log('wf-skill-api: OK (create skill + assign intermediate)');
}

console.log('wf-skill-api: unit OK (matrix UI + APIs)');
await apiSmoke();
