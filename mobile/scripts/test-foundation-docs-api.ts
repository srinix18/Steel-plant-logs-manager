/**
 * P5-FND-DOCS — unit + API: HOD upload; list; download; non-upload roles list-only.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'foundation', 'documents.tsx'),
  'utf8'
);
assert.ok(route.includes('FoundationDocumentsScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));
assert.ok(!route.includes('HOD_TIER_ROLES')); // gate is auth-only; upload in screen

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'foundation', 'FoundationDocumentsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('canUpload'));
assert.ok(screen.includes('HOD_TIER_ROLES'));
assert.ok(screen.includes('HR_ROLES'));
assert.ok(screen.includes('fetchFoundationDocuments'));
assert.ok(screen.includes('uploadFoundationDocument'));
assert.ok(screen.includes('downloadFoundationDocument'));
assert.ok(screen.includes('DocumentPicker'));
assert.ok(screen.includes('Sharing'));
assert.ok(screen.includes('sop'));
assert.ok(screen.includes('work_instruction'));
assert.ok(screen.includes('training_material'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'foundation.ts'), 'utf8');
assert.ok(api.includes('/foundation/documents'));
assert.ok(api.includes('multipart') || api.includes('FormData'));
assert.ok(api.includes('/download'));

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(
  /\/$/,
  ''
);

async function request(p: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}${p}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
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
  return { res, json, text };
}

async function apiSmoke() {
  let login;
  try {
    login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'hod@chandansteel.com', password: 'hod123' }),
    });
  } catch (err) {
    console.log(`foundation-docs-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('foundation-docs-api: HOD login failed — unit OK; skipped');
    return;
  }
  const auth = { Authorization: `Bearer ${(login.json as { access_token: string }).access_token}` };

  const plants = await request('/plants', { headers: auth });
  if (plants.res.status !== 200 || !(plants.json as { id: string }[])[0]) {
    console.log('foundation-docs-api: no plants — unit OK; skipped');
    return;
  }
  const plantId = (plants.json as { id: string }[])[0].id;

  const depts = await request(`/departments?plant_id=${encodeURIComponent(plantId)}`, {
    headers: auth,
  });
  if (depts.res.status !== 200 || !(depts.json as { id: string }[])[0]) {
    console.log('foundation-docs-api: no departments — unit OK; skipped');
    return;
  }
  const departmentId = (depts.json as { id: string }[])[0].id;

  const stamp = Date.now().toString(36).toUpperCase();
  const title = `Mobile DOC ${stamp}`;
  const fileBlob = new Blob([`P5-FND-DOCS smoke ${stamp}\n`], { type: 'text/plain' });
  const form = new FormData();
  form.append('plant_id', plantId);
  form.append('department_id', departmentId);
  form.append('category', 'sop');
  form.append('title', title);
  form.append('version', '1.0');
  form.append('file', fileBlob, `smoke-${stamp}.txt`);

  const uploaded = await request('/foundation/documents', {
    method: 'POST',
    headers: auth,
    body: form,
  });
  if (!uploaded.res.ok) {
    console.error('foundation-docs-api: upload failed', uploaded.res.status, uploaded.json);
    process.exit(1);
  }
  const doc = uploaded.json as { id: string; title: string; file_name: string };
  assert.equal(doc.title, title);

  const list = await request(`/foundation/documents?plant_id=${encodeURIComponent(plantId)}`, {
    headers: auth,
  });
  if (list.res.status !== 200 || !Array.isArray(list.json)) {
    console.error('foundation-docs-api: list failed', list.json);
    process.exit(1);
  }
  assert.ok((list.json as { id: string }[]).some((d) => d.id === doc.id));

  const dl = await fetch(`${API_URL}/foundation/documents/${doc.id}/download`, {
    headers: auth,
  });
  if (!dl.ok) {
    console.error('foundation-docs-api: download failed', dl.status);
    process.exit(1);
  }
  const body = await dl.text();
  assert.ok(body.includes('P5-FND-DOCS smoke'));

  // Non-upload role can list (supervisor) but not upload
  const supLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'iaf.supervisor@chandansteel.com',
      password: 'iaf123',
    }),
  });
  if (supLogin.res.ok) {
    const supAuth = {
      Authorization: `Bearer ${(supLogin.json as { access_token: string }).access_token}`,
    };
    const supList = await request(`/foundation/documents?plant_id=${encodeURIComponent(plantId)}`, {
      headers: supAuth,
    });
    assert.equal(supList.res.status, 200);

    const denyForm = new FormData();
    denyForm.append('plant_id', plantId);
    denyForm.append('department_id', departmentId);
    denyForm.append('category', 'sop');
    denyForm.append('title', `Deny ${stamp}`);
    denyForm.append('version', '1.0');
    denyForm.append('file', fileBlob, `deny-${stamp}.txt`);
    const deny = await request('/foundation/documents', {
      method: 'POST',
      headers: supAuth,
      body: denyForm,
    });
    assert.ok(deny.res.status === 403 || deny.res.status === 401);
  }

  console.log(
    `foundation-docs-api: OK (upload ${title}; download ok; list=${(list.json as unknown[]).length})`
  );
}

console.log('foundation-docs-api: unit OK (upload gate + download wiring)');
await apiSmoke();
