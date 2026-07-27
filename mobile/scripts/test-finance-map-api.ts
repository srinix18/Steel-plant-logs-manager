/**
 * P5-FIN-MAP — unit + API: template select, add/delete rule, context reloads.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(
  path.join(root, 'app', '(app)', 'finance', 'mappings.tsx'),
  'utf8'
);
assert.ok(route.includes('FINANCE_MAPPING_WRITE_ROLES'));
assert.ok(route.includes('CostMappingBuilderScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));
assert.ok(!route.includes('DesktopOnlyGate'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'finance', 'CostMappingBuilderScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchTemplates'));
assert.ok(screen.includes('fetchMappingContext'));
assert.ok(screen.includes('createMappingRule'));
assert.ok(screen.includes('deleteMappingRule'));
assert.ok(screen.includes('cost_category'));
assert.ok(screen.includes('previewQty'));
assert.ok(screen.includes('canWrite'));
assert.ok(screen.includes('section_row'));
assert.ok(screen.includes('scalar_field'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'finance.ts'), 'utf8');
assert.ok(api.includes('/finance/mappings/template-versions/'));
assert.ok(api.includes('/finance/mappings/rules'));
assert.ok(api.includes('fetchMappingContext'));
assert.ok(api.includes('createMappingRule'));
assert.ok(api.includes('deleteMappingRule'));

const templatesApi = fs.readFileSync(path.join(root, 'src', 'api', 'processRuns.ts'), 'utf8');
assert.ok(templatesApi.includes('fetchTemplatesViaProcess'));

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

type MappingContext = {
  template_version_id: string;
  available_fields: {
    section_key: string;
    field_name: string;
    section_type: string;
  }[];
  rules: { id: string; source_key: string }[];
};

async function loadTemplates(token: string): Promise<TemplateDetail[]> {
  const list = await request('/templates', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (list.res.ok && Array.isArray(list.json) && (list.json as unknown[]).length > 0) {
    return list.json as TemplateDetail[];
  }

  const procs = await request('/processes', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!procs.res.ok || !Array.isArray(procs.json)) return [];
  const out: TemplateDetail[] = [];
  for (const p of procs.json as { default_template_id?: string | null }[]) {
    if (!p.default_template_id) continue;
    if (out.some((t) => t.id === p.default_template_id)) continue;
    const t = await request(`/templates/${p.default_template_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (t.res.ok && t.json && typeof t.json === 'object') {
      out.push(t.json as TemplateDetail);
    }
  }
  return out;
}

async function apiSmoke() {
  let login;
  try {
    login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'ceo@chandansteel.com', password: 'ceo123' }),
    });
  } catch (err) {
    console.log(`finance-map-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('finance-map-api: CEO login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token?: string }).access_token;
  if (!token) {
    console.log('finance-map-api: no token — unit OK; skipped');
    return;
  }

  const templates = await loadTemplates(token);
  const published = templates.flatMap((t) =>
    (t.versions ?? []).filter((v) => v.status === 'published').map((v) => v.id)
  );
  if (published.length === 0) {
    console.log('finance-map-api: no published templates — unit OK; skipped');
    return;
  }
  const versionId = published[0];

  const ctxRes = await request(`/finance/mappings/template-versions/${versionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(ctxRes.res.status, 200, `mapping context ${ctxRes.res.status}`);
  const ctx = ctxRes.json as MappingContext;
  assert.ok(Array.isArray(ctx.available_fields));
  assert.ok(Array.isArray(ctx.rules));

  if (ctx.available_fields.length === 0) {
    console.log('finance-map-api: no fields to map — context OK; skipped mutate');
    return;
  }

  const field = ctx.available_fields[0];
  const isSection = field.section_type !== 'fields';
  const create = await request('/finance/mappings/rules', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      template_version_id: versionId,
      source_type: isSection ? 'section_row' : 'scalar_field',
      source_key: isSection ? field.section_key : field.field_name,
      cost_category: 'other',
      item_label_override: `mobile-smoke-${Date.now()}`,
      sort_order: (ctx.rules.length || 0) + 1,
      ...(isSection ? { child_key: 'quantity_kg' } : {}),
    }),
  });
  assert.ok(create.res.ok, `create rule ${create.res.status} ${JSON.stringify(create.json)}`);
  const ruleId = (create.json as { id?: string }).id;
  assert.ok(ruleId);

  const reloaded = await request(`/finance/mappings/template-versions/${versionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(reloaded.res.status, 200);
  const rulesAfter = (reloaded.json as MappingContext).rules;
  assert.ok(rulesAfter.some((r) => r.id === ruleId));

  const del = await request(`/finance/mappings/rules/${ruleId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.ok(del.res.status === 204 || del.res.ok, `delete ${del.res.status}`);

  const afterDel = await request(`/finance/mappings/template-versions/${versionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(afterDel.res.status, 200);
  assert.ok(!(afterDel.json as MappingContext).rules.some((r) => r.id === ruleId));

  console.log('finance-map-api: OK (add/delete rule + context reload)');
}

await apiSmoke();
console.log('test-finance-map-api: OK');
