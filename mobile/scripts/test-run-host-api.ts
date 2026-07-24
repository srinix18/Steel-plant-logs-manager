/**
 * Smoke: login → find a run → load template → PATCH field_values → verify round-trip.
 * Skips if API unreachable or no runs exist.
 */
const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(
  /\/$/,
  ''
);

async function request(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
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

async function main() {
  let login;
  try {
    login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@logbook.app', password: 'admin123' }),
    });
  } catch (err) {
    console.log(`run-host-api: API unreachable at ${API_URL} — skipped (${String(err)})`);
    process.exit(0);
  }

  if (!login.res.ok) {
    console.error('run-host-api: login failed', login.json);
    process.exit(1);
  }

  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const list = await request('/process-runs?active_only=false', { headers: auth });
  if (!list.res.ok) {
    console.error('run-host-api: list runs failed', list.json);
    process.exit(1);
  }

  const runs = list.json as { id: string; run_number: string; template_version_id: string }[];
  if (!Array.isArray(runs) || runs.length === 0) {
    console.log('run-host-api: no runs in DB — skipped (create a run to exercise host)');
    process.exit(0);
  }

  const runId = runs[0].id;
  const detail = await request(`/process-runs/${runId}`, { headers: auth });
  if (!detail.res.ok) {
    console.error('run-host-api: GET run failed', detail.json);
    process.exit(1);
  }

  const run = detail.json as {
    id: string;
    template_version_id: string;
    field_values: { field_key: string; value: unknown }[];
  };

  const tmpl = await request(`/templates/versions/${run.template_version_id}`, { headers: auth });
  if (!tmpl.res.ok) {
    console.error('run-host-api: GET template version failed', tmpl.json);
    process.exit(1);
  }

  const template = tmpl.json as {
    sections: {
      key: string;
      section_type: string;
      fields: { name: string; field_type: string }[];
    }[];
  };

  const fieldsSection = template.sections.find((s) => s.section_type === 'fields');
  if (!fieldsSection || fieldsSection.fields.length === 0) {
    console.log('run-host-api: ok (load run + template; no fields section to PATCH)');
    process.exit(0);
  }

  const editable = fieldsSection.fields.find(
    (f) => f.field_type === 'text' || f.field_type === 'textarea' || f.field_type === 'signature'
  );
  const target = editable ?? fieldsSection.fields.find((f) => f.field_type !== 'calculated');
  if (!target) {
    console.log('run-host-api: ok (load only; no editable field)');
    process.exit(0);
  }

  const previous =
    run.field_values.find((fv) => fv.field_key === target.name)?.value ?? '';
  const marker = `P2E01-${Date.now().toString().slice(-8)}`;

  const patch = await request(`/process-runs/${runId}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      field_values: [{ field_key: target.name, value: marker }],
    }),
  });
  if (!patch.res.ok) {
    console.error('run-host-api: PATCH failed', patch.json);
    process.exit(1);
  }

  const again = await request(`/process-runs/${runId}`, { headers: auth });
  if (!again.res.ok) {
    console.error('run-host-api: GET after PATCH failed', again.json);
    process.exit(1);
  }

  const againRun = again.json as { field_values: { field_key: string; value: unknown }[] };
  const saved = againRun.field_values.find((fv) => fv.field_key === target.name)?.value;
  if (String(saved) !== marker) {
    console.error('run-host-api: round-trip mismatch', { expected: marker, saved });
    process.exit(1);
  }

  // Restore previous value when it was a string (best-effort, non-fatal)
  if (typeof previous === 'string' || previous == null) {
    await request(`/process-runs/${runId}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({
        field_values: [{ field_key: target.name, value: previous ?? '' }],
      }),
    });
  }

  const events = await request(`/process-runs/${runId}/events`, { headers: auth });
  if (!events.res.ok) {
    console.error('run-host-api: GET events failed', events.json);
    process.exit(1);
  }

  const remarks = await request(`/process-runs/${runId}/remarks`, { headers: auth });
  if (!remarks.res.ok) {
    console.error('run-host-api: GET remarks failed', remarks.json);
    process.exit(1);
  }

  console.log(
    `run-host-api: ok (run ${runs[0].run_number}, field ${target.name}, events+remarks)`
  );
}

main();
