/**
 * P5-ADM-SHEETS — unit + API: template/version select; section preview; ?doc= support.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(path.join(root, 'app', '(app)', 'admin', 'sheets.tsx'), 'utf8');
assert.ok(route.includes('PLATFORM_ADMIN_ROLES'));
assert.ok(route.includes('AdminLogSheetsScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));
assert.ok(!route.includes('DesktopOnlyGate'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'admin', 'AdminLogSheetsScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('useLocalSearchParams'));
assert.ok(screen.includes('docParam'));
assert.ok(screen.includes('fetchTemplates'));
assert.ok(screen.includes('fetchTemplateVersion'));
assert.ok(screen.includes('buildCardSteps'));
assert.ok(screen.includes('CardStepBody'));
assert.ok(screen.includes('disabled: true'));
assert.ok(screen.includes('selectedVersionId'));
assert.ok(screen.includes('fetchSteelGrades'));
assert.ok(screen.includes("fetchMaterials('alloy')"));

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

type TemplateDetail = {
  id: string;
  doc_no: string;
  name: string;
  versions?: { id: string; rev_no: string; status: string }[];
};

async function loadTemplates(token: string): Promise<TemplateDetail[]> {
  const list = await request('/templates', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (list.res.ok && Array.isArray(list.json) && (list.json as unknown[]).length > 0) {
    return list.json as TemplateDetail[];
  }
  return [];
}

async function apiSmoke() {
  let login;
  try {
    login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@logbook.app', password: 'admin123' }),
    });
  } catch (err) {
    console.log(`admin-sheets-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('admin-sheets-api: admin login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token?: string }).access_token;
  if (!token) {
    console.log('admin-sheets-api: no token — unit OK; skipped');
    return;
  }
  const headers = { Authorization: `Bearer ${token}` };

  const templates = await loadTemplates(token);
  if (templates.length === 0) {
    console.log('admin-sheets-api: no templates — unit OK; skipped');
    return;
  }

  const preferred =
    templates.find((t) => t.doc_no === 'F/PRD/02') ??
    templates.find((t) => (t.versions ?? []).some((v) => v.status === 'published')) ??
    templates[0];
  const version =
    (preferred.versions ?? []).find((v) => v.status === 'published') ??
    (preferred.versions ?? [])[0];
  assert.ok(version, 'template has a version');

  const detail = await request(`/templates/versions/${version.id}`, { headers });
  assert.equal(detail.res.status, 200, `version detail ${detail.res.status}`);
  const body = detail.json as { sections?: { key: string; title: string; section_type: string }[] };
  assert.ok(Array.isArray(body.sections));
  assert.ok(body.sections!.length > 0, 'version has sections for preview');

  const grades = await request('/steel-grades', { headers });
  assert.equal(grades.res.status, 200);

  console.log(
    `admin-sheets-api: OK (doc=${preferred.doc_no} rev=${version.rev_no} sections=${body.sections!.length})`
  );
}

await apiSmoke();
console.log('test-admin-sheets-api: OK');
