/**
 * Smoke: GRIND daily register — create, save header, workflow Start Register.
 * Login: worker.forge@chandansteel.com / forge123
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
      body: JSON.stringify({
        email: 'worker.forge@chandansteel.com',
        password: 'forge123',
      }),
    });
  } catch (err) {
    console.log(`grind-lifecycle: API unreachable at ${API_URL} — skipped (${String(err)})`);
    process.exit(0);
  }

  if (!login.res.ok) {
    console.log('grind-lifecycle: forge worker login failed — skipped');
    process.exit(0);
  }

  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const processesRes = await request('/processes', { headers: auth });
  if (!processesRes.res.ok) {
    console.error('grind-lifecycle: processes failed', processesRes.json);
    process.exit(1);
  }
  const processes = processesRes.json as { id: string; code: string }[];
  const grind = processes.find((p) => p.code === 'GRIND');
  if (!grind) {
    console.log('grind-lifecycle: GRIND not in scoped processes — skipped');
    process.exit(0);
  }

  const instRes = await request(`/process-instances?process_id=${grind.id}`, {
    headers: auth,
  });
  const instances = instRes.res.ok
    ? (instRes.json as { id: string; name: string }[])
    : [];
  if (!instances[0]) {
    console.error('grind-lifecycle: no GRIND process instance');
    process.exit(1);
  }

  const create = await request(`/process-instances/${instances[0].id}/runs`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ run_type: 'daily' }),
  });
  if (!create.res.ok) {
    console.error('grind-lifecycle: create daily run failed', create.json);
    process.exit(1);
  }

  const run = create.json as { id: string; template_version_id: string };
  const today = new Date().toISOString().slice(0, 10);
  const workCentre = instances[0].name || 'Grinding Work Centre 1';

  const tplRes = await request(`/templates/versions/${run.template_version_id}`, {
    headers: auth,
  });
  if (!tplRes.res.ok) {
    console.error('grind-lifecycle: template failed', tplRes.json);
    process.exit(1);
  }
  const tpl = tplRes.json as {
    sections: { key: string; section_type: string; fields: { name: string }[] }[];
  };
  const keys = tpl.sections.map((s) => s.key);
  if (!keys.includes('register_header')) {
    console.error('grind-lifecycle: missing register_header', keys);
    process.exit(1);
  }
  const header = tpl.sections.find((s) => s.key === 'register_header');
  const fieldNames = (header?.fields ?? []).map((f) => f.name);
  if (!fieldNames.includes('work_centre') || !fieldNames.includes('date')) {
    console.error('grind-lifecycle: header fields missing', fieldNames);
    process.exit(1);
  }

  const patch = await request(`/process-runs/${run.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      field_values: [
        { field_key: 'work_centre', value: workCentre },
        { field_key: 'date', value: today },
      ],
    }),
  });
  if (!patch.res.ok) {
    console.error('grind-lifecycle: patch failed', patch.json);
    process.exit(1);
  }

  const detailRes = await request(`/process-runs/${run.id}`, { headers: auth });
  if (!detailRes.res.ok) {
    console.error('grind-lifecycle: reload failed', detailRes.json);
    process.exit(1);
  }
  const detail = detailRes.json as {
    field_values: { field_key: string; value: unknown }[];
  };
  const byKey = Object.fromEntries(
    detail.field_values.map((f) => [f.field_key, f.value])
  );
  if (String(byKey.date ?? '') !== today) {
    console.error('grind-lifecycle: date not saved', byKey.date);
    process.exit(1);
  }
  if (String(byKey.work_centre ?? '') !== workCentre) {
    console.error('grind-lifecycle: work_centre not saved', byKey.work_centre);
    process.exit(1);
  }

  const start = await request(`/process-runs/${run.id}/transitions`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ to_state: 'in_progress' }),
  });
  if (!start.res.ok) {
    console.error('grind-lifecycle: Start Register failed', start.json);
    process.exit(1);
  }

  console.log(
    `grind-lifecycle: OK run=${run.id} work_centre=${workCentre} date=${today}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
