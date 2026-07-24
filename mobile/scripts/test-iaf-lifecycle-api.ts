/**
 * Smoke: IAF heat lifecycle — create → fill heat_info → start heat → power-on transition.
 * Skips if API unreachable or melter / IAF not available.
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
        email: 'melter@chandansteel.com',
        password: 'worker123',
      }),
    });
  } catch (err) {
    console.log(`iaf-lifecycle: API unreachable at ${API_URL} — skipped (${String(err)})`);
    process.exit(0);
  }

  if (!login.res.ok) {
    console.log('iaf-lifecycle: melter login failed — skipped');
    process.exit(0);
  }

  const token = (login.json as { access_token: string }).access_token;
  const user = (login.json as { user: { id: string; plant_id?: string } }).user;
  const auth = { Authorization: `Bearer ${token}` };

  const processesRes = await request('/processes', { headers: auth });
  if (!processesRes.res.ok) {
    console.error('iaf-lifecycle: processes failed', processesRes.json);
    process.exit(1);
  }
  const processes = processesRes.json as { id: string; code: string }[];
  const iaf = processes.find((p) => p.code === 'IAF');
  if (!iaf) {
    console.log('iaf-lifecycle: IAF not in scoped processes — skipped');
    process.exit(0);
  }

  const instRes = await request(`/process-instances?process_id=${iaf.id}`, { headers: auth });
  if (!instRes.res.ok) {
    console.error('iaf-lifecycle: instances failed', instRes.json);
    process.exit(1);
  }
  const instances = instRes.json as { id: string }[];
  if (!instances.length) {
    console.log('iaf-lifecycle: no IAF instances — skipped');
    process.exit(0);
  }

  const shiftsRes = await request(
    user.plant_id ? `/shifts?plant_id=${user.plant_id}` : '/shifts',
    { headers: auth }
  );
  const shifts = shiftsRes.res.ok ? (shiftsRes.json as { id: string; code: string }[]) : [];
  const gradesRes = await request('/steel-grades', { headers: auth });
  const grades = gradesRes.res.ok
    ? (gradesRes.json as { id: string; code: string }[])
    : [];

  const createBody: Record<string, string> = { run_type: 'heat' };
  if (shifts[0]) createBody.shift_id = shifts[0].id;
  if (grades[0]) createBody.grade_id = grades[0].id;

  const create = await request(`/process-instances/${instances[0].id}/runs`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify(createBody),
  });
  if (!create.res.ok) {
    console.error('iaf-lifecycle: create run failed', create.json);
    process.exit(1);
  }

  const run = create.json as {
    id: string;
    current_state: string;
    template_version_id: string;
    run_number: string;
  };
  if (run.current_state !== 'created') {
    console.error('iaf-lifecycle: expected created, got', run.current_state);
    process.exit(1);
  }

  const tmpl = await request(`/templates/versions/${run.template_version_id}`, {
    headers: auth,
  });
  if (!tmpl.res.ok) {
    console.error('iaf-lifecycle: template failed', tmpl.json);
    process.exit(1);
  }
  const template = tmpl.json as {
    sections: { key: string; fields: { name: string; field_type: string }[] }[];
  };
  const keys = template.sections.map((s) => s.key);
  if (!keys.includes('heat_info') || !keys.includes('charge_mix')) {
    console.error('iaf-lifecycle: template missing IAF sections', keys);
    process.exit(1);
  }

  const usersRes = user.plant_id
    ? await request(`/plants/${user.plant_id}/users`, { headers: auth })
    : { res: { ok: false }, json: null };
  const plantUsers = usersRes.res.ok ? (usersRes.json as { id: string }[]) : [];
  const melterId = plantUsers[0]?.id ?? user.id;

  const patch = await request(`/process-runs/${run.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      grade_id: grades[0]?.id,
      field_values: [
        { field_key: 'date', value: new Date().toISOString().slice(0, 10) },
        { field_key: 'heat_no', value: run.run_number.split('-').pop() ?? 'T1' },
        { field_key: 'grade', value: grades[0]?.id ?? '' },
        { field_key: 'shift', value: shifts[0]?.code ?? 'A' },
        { field_key: 'melter', value: melterId },
      ],
    }),
  });
  if (!patch.res.ok) {
    console.error('iaf-lifecycle: PATCH heat_info failed', patch.json);
    process.exit(1);
  }

  const detail = await request(`/process-runs/${run.id}`, { headers: auth });
  if (!detail.res.ok) {
    console.error('iaf-lifecycle: GET run failed', detail.json);
    process.exit(1);
  }
  const workflow = (detail.json as {
    workflow?: { available_transitions: { to_state: string; label: string }[] };
  }).workflow;
  const start = workflow?.available_transitions?.find((t) => t.to_state === 'in_progress');
  if (!start) {
    console.error('iaf-lifecycle: no created→in_progress transition', workflow);
    process.exit(1);
  }

  const tr1 = await request(`/process-runs/${run.id}/transitions`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ to_state: 'in_progress' }),
  });
  if (!tr1.res.ok) {
    console.error('iaf-lifecycle: transition to in_progress failed', tr1.json);
    process.exit(1);
  }

  const powerOn = new Date().toISOString();
  const patchTiming = await request(`/process-runs/${run.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      field_values: [{ field_key: 'power_on_time', value: powerOn }],
    }),
  });
  if (!patchTiming.res.ok) {
    console.error('iaf-lifecycle: PATCH power_on_time failed', patchTiming.json);
    process.exit(1);
  }

  const tr2 = await request(`/process-runs/${run.id}/transitions`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ to_state: 'waiting_for_sample' }),
  });
  if (!tr2.res.ok) {
    console.error('iaf-lifecycle: transition to waiting_for_sample failed', tr2.json);
    process.exit(1);
  }

  const after = await request(`/process-runs/${run.id}`, { headers: auth });
  const state = (after.json as { current_state: string }).current_state;
  if (state !== 'waiting_for_sample') {
    console.error('iaf-lifecycle: expected waiting_for_sample, got', state);
    process.exit(1);
  }

  // Lookups used by phone pickers
  if (user.plant_id) {
    const groups = await request(`/asset-groups?plant_id=${user.plant_id}`, { headers: auth });
    const assets = await request(`/assets?plant_id=${user.plant_id}`, { headers: auth });
    if (!groups.res.ok || !assets.res.ok) {
      console.error('iaf-lifecycle: asset lookups failed', groups.json, assets.json);
      process.exit(1);
    }
  }

  console.log(
    `iaf-lifecycle: OK run=${run.run_number} → waiting_for_sample (heat_info + power-on)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
