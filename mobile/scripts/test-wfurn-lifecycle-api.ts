/**
 * Smoke: WFURN shift — create run, save input coil, list coils, save furnace_output with coil_ref.
 * Login: worker.wire@chandansteel.com / wire123
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
        email: 'worker.wire@chandansteel.com',
        password: 'wire123',
      }),
    });
  } catch (err) {
    console.log(`wfurn-lifecycle: API unreachable at ${API_URL} — skipped (${String(err)})`);
    process.exit(0);
  }

  if (!login.res.ok) {
    console.log('wfurn-lifecycle: wire worker login failed — skipped');
    process.exit(0);
  }

  const token = (login.json as { access_token: string }).access_token;
  const user = (login.json as { user: { id: string; plant_id?: string } }).user;
  const auth = { Authorization: `Bearer ${token}` };

  const processesRes = await request('/processes', { headers: auth });
  if (!processesRes.res.ok) {
    console.error('wfurn-lifecycle: processes failed', processesRes.json);
    process.exit(1);
  }
  const processes = processesRes.json as { id: string; code: string }[];
  const wfurn = processes.find((p) => p.code === 'WFURN');
  if (!wfurn) {
    console.log('wfurn-lifecycle: WFURN not in scoped processes — skipped');
    process.exit(0);
  }

  const instRes = await request(`/process-instances?process_id=${wfurn.id}`, { headers: auth });
  if (!instRes.res.ok) {
    console.error('wfurn-lifecycle: instances failed', instRes.json);
    process.exit(1);
  }
  const instances = instRes.json as { id: string }[];
  if (!instances.length) {
    console.log('wfurn-lifecycle: no WFURN instances — skipped');
    process.exit(0);
  }

  const shiftsRes = await request(
    user.plant_id ? `/shifts?plant_id=${user.plant_id}` : '/shifts',
    { headers: auth }
  );
  const shifts = shiftsRes.res.ok ? (shiftsRes.json as { id: string; code: string }[]) : [];
  const gradesRes = await request('/steel-grades', { headers: auth });
  const grades = gradesRes.res.ok ? (gradesRes.json as { id: string }[]) : [];

  const createBody: Record<string, string> = { run_type: 'shift' };
  if (shifts[0]) createBody.shift_id = shifts[0].id;

  const create = await request(`/process-instances/${instances[0].id}/runs`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify(createBody),
  });
  if (!create.res.ok) {
    console.error('wfurn-lifecycle: create failed', create.json);
    process.exit(1);
  }

  const run = create.json as {
    id: string;
    run_number: string;
    template_version_id: string;
  };

  const tmpl = await request(`/templates/versions/${run.template_version_id}`, {
    headers: auth,
  });
  if (!tmpl.res.ok) {
    console.error('wfurn-lifecycle: template failed', tmpl.json);
    process.exit(1);
  }

  const template = tmpl.json as { sections: { key: string; section_type: string }[] };
  const keys = template.sections.map((s) => s.key);
  for (const expected of ['shift_details', 'input_coils', 'furnace_output', 'approvals']) {
    if (!keys.includes(expected)) {
      console.error(`wfurn-lifecycle: missing section ${expected}`, keys);
      process.exit(1);
    }
  }

  const coilNo = `WF-SMOKE-${Date.now().toString().slice(-6)}`;

  const patchInput = await request(`/process-runs/${run.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      field_values: [
        { field_key: 'date', value: '2026-07-24' },
        { field_key: 'shift', value: shifts[0]?.code ?? 'A' },
        { field_key: 'operator', value: user.id },
      ],
      section_data: [
        {
          section_key: 'input_coils',
          data: {
            rows: [
              {
                values: {
                  work_order_no: 'WO-SMOKE',
                  grade_id: grades[0]?.id ?? '',
                  heat_no: { run_id: '', heat_no: 'H-SMOKE' },
                  size_mm: 6.5,
                  coil_no: coilNo,
                },
              },
            ],
          },
        },
      ],
    }),
  });
  if (!patchInput.res.ok) {
    console.error('wfurn-lifecycle: PATCH input_coils failed', patchInput.json);
    process.exit(1);
  }

  if (!user.plant_id) {
    console.log('wfurn-lifecycle: no plant_id — skip coil list check');
    process.exit(0);
  }

  const coilsRes = await request(
    `/coils?plant_id=${user.plant_id}&run_id=${run.id}`,
    { headers: auth }
  );
  if (!coilsRes.res.ok) {
    console.error('wfurn-lifecycle: GET /coils failed', coilsRes.json);
    process.exit(1);
  }
  const coils = coilsRes.json as { id: string; coil_no: string; status: string }[];
  const matched = coils.find((c) => c.coil_no === coilNo);
  if (!matched) {
    console.error('wfurn-lifecycle: coil not upserted after input save', coils);
    process.exit(1);
  }
  if (matched.status === 'completed' || matched.status === 'consumed') {
    console.error('wfurn-lifecycle: unexpected coil status before output', matched.status);
    process.exit(1);
  }

  const patchOut = await request(`/process-runs/${run.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      section_data: [
        {
          section_key: 'furnace_output',
          data: {
            rows: [
              {
                values: {
                  coil_ref: { coil_id: matched.id, coil_no: matched.coil_no },
                  tube_head_no: 'T1',
                  speed_m_min: 12,
                  weight_kg: 550,
                  remark: 'smoke',
                },
              },
            ],
          },
        },
      ],
    }),
  });
  if (!patchOut.res.ok) {
    console.error('wfurn-lifecycle: PATCH furnace_output failed', patchOut.json);
    process.exit(1);
  }

  const coilsAfter = await request(
    `/coils?plant_id=${user.plant_id}&run_id=${run.id}`,
    { headers: auth }
  );
  const afterList = coilsAfter.json as { id: string; coil_no: string; status: string }[];
  const after = afterList.find((c) => c.id === matched.id);
  // Furnace output may mark completed — either still listed with completed or filtered out of furnace picker
  const detail = await request(`/process-runs/${run.id}`, { headers: auth });
  const saved = detail.json as {
    section_data: { section_key: string; data: { rows?: { values: { coil_ref?: { coil_id: string } } }[] } }[];
  };
  const outRow = saved.section_data.find((s) => s.section_key === 'furnace_output')?.data
    ?.rows?.[0];
  if (outRow?.values?.coil_ref?.coil_id !== matched.id) {
    console.error('wfurn-lifecycle: coil_ref not intact', outRow);
    process.exit(1);
  }

  console.log(
    `wfurn-lifecycle: OK run=${run.run_number} coil=${coilNo} status=${after?.status ?? 'n/a'} coil_ref saved`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
