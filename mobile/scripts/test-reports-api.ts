/**
 * Unit + API smoke: P2-REPORTS meta + route wiring + load run/template when API up.
 * (HTML builder covered via file presence + meta; full buildReportHtml uses Metro @ aliases.)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEDICATED_REPORT_DOC_NOS,
  formatReportDate,
  reportSheetLabel,
} from '../src/features/reports/reportMeta.ts';

assert.ok(DEDICATED_REPORT_DOC_NOS.has('F/PRD/02'));
assert.ok(DEDICATED_REPORT_DOC_NOS.has('F51 PR 39/005/01-13'));
assert.equal(reportSheetLabel('F/PRD/02'), 'IAF heat log');
assert.equal(reportSheetLabel('F51 PR 39/005/01-13'), 'Bright bar production register');
assert.equal(formatReportDate('2026-07-25T12:00:00.000Z'), '2026-07-25');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.ok(fs.existsSync(path.join(root, 'app', '(app)', 'reports', '[runId].tsx')));
assert.ok(fs.existsSync(path.join(root, 'src', 'features', 'reports', 'buildReportHtml.ts')));
assert.ok(fs.existsSync(path.join(root, 'src', 'features', 'reports', 'RunReportScreen.tsx')));

const myRuns = fs.readFileSync(
  path.join(root, 'src', 'features', 'my-runs', 'MyRunsScreen.tsx'),
  'utf8'
);
assert.ok(myRuns.includes('/(app)/reports/'));
assert.ok(myRuns.includes('Report'));

const htmlBuilder = fs.readFileSync(
  path.join(root, 'src', 'features', 'reports', 'buildReportHtml.ts'),
  'utf8'
);
assert.ok(htmlBuilder.includes('buildReportHtml'));
assert.ok(htmlBuilder.includes('<!DOCTYPE html>'));

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
        email: 'worker.bbd@chandansteel.com',
        password: 'bbd123',
      }),
    });
  } catch (err) {
    console.log(`reports-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('reports-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const mine = await request('/process-runs/mine', { headers: auth });
  if (!mine.res.ok) {
    console.error('reports-api: /mine failed', mine.json);
    process.exit(1);
  }
  let runs = mine.json as { id: string; template_version_id: string }[];
  if (!runs.length) {
    const procs = await request('/processes', { headers: auth });
    const list = procs.res.ok ? (procs.json as { id: string; code: string }[]) : [];
    const bbar = list.find((p) => p.code === 'BBAR');
    if (bbar) {
      const inst = await request(`/process-instances?process_id=${bbar.id}`, { headers: auth });
      const instances = inst.res.ok ? (inst.json as { id: string }[]) : [];
      if (instances[0]) {
        const created = await request(`/process-instances/${instances[0].id}/runs`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({ run_type: 'daily' }),
        });
        if (created.res.ok) {
          runs = [created.json as { id: string; template_version_id: string }];
        }
      }
    }
  }
  if (!runs[0]) {
    console.log('reports-api: no BBAR run available — unit OK; skipped');
    return;
  }

  const detail = await request(`/process-runs/${runs[0].id}`, { headers: auth });
  if (!detail.res.ok) {
    console.error('reports-api: process-run failed', detail.json);
    process.exit(1);
  }
  const run = detail.json as { id: string; template_version_id: string; run_number: string };
  const tpl = await request(`/templates/versions/${run.template_version_id}`, { headers: auth });
  if (!tpl.res.ok) {
    console.error('reports-api: template version failed', tpl.json);
    process.exit(1);
  }
  const version = tpl.json as { template_id: string; sections: unknown[] };
  assert.ok(Array.isArray(version.sections));

  const meta = await request(`/templates/${version.template_id}`, { headers: auth });
  if (meta.res.ok) {
    const t = meta.json as { doc_no: string };
    assert.ok(t.doc_no);
  }

  console.log(`reports-api: OK run=${run.run_number} sections=${version.sections.length}`);
}

await apiSmoke();
console.log('reports: OK');
