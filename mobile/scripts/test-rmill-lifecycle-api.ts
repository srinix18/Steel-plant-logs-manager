/**
 * Smoke: RMILL shift — create run, save delay + batch + all 12 hourly hours, reopen.
 * Login: worker.rolling@chandansteel.com / rolling123
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
        email: 'worker.rolling@chandansteel.com',
        password: 'rolling123',
      }),
    });
  } catch (err) {
    console.log(`rmill-lifecycle: API unreachable at ${API_URL} — skipped (${String(err)})`);
    process.exit(0);
  }

  if (!login.res.ok) {
    console.log('rmill-lifecycle: rolling worker login failed — skipped');
    process.exit(0);
  }

  const token = (login.json as { access_token: string }).access_token;
  const user = (login.json as { user: { id: string; plant_id?: string } }).user;
  const auth = { Authorization: `Bearer ${token}` };

  const processesRes = await request('/processes', { headers: auth });
  if (!processesRes.res.ok) {
    console.error('rmill-lifecycle: processes failed', processesRes.json);
    process.exit(1);
  }
  const processes = processesRes.json as { id: string; code: string }[];
  const rmill = processes.find((p) => p.code === 'RMILL');
  if (!rmill) {
    console.log('rmill-lifecycle: RMILL not in scoped processes — skipped');
    process.exit(0);
  }

  const instRes = await request(`/process-instances?process_id=${rmill.id}`, { headers: auth });
  if (!instRes.res.ok) {
    console.error('rmill-lifecycle: instances failed', instRes.json);
    process.exit(1);
  }
  const instances = instRes.json as { id: string }[];
  if (!instances.length) {
    console.log('rmill-lifecycle: no RMILL instances — skipped');
    process.exit(0);
  }

  const shiftsRes = await request(
    user.plant_id ? `/shifts?plant_id=${user.plant_id}` : '/shifts',
    { headers: auth }
  );
  const shifts = shiftsRes.res.ok ? (shiftsRes.json as { id: string; code: string }[]) : [];

  const createBody: Record<string, string> = { run_type: 'shift' };
  if (shifts[0]) createBody.shift_id = shifts[0].id;

  const create = await request(`/process-instances/${instances[0].id}/runs`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify(createBody),
  });
  if (!create.res.ok) {
    console.error('rmill-lifecycle: create failed', create.json);
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
    console.error('rmill-lifecycle: template failed', tmpl.json);
    process.exit(1);
  }

  const template = tmpl.json as {
    sections: {
      key: string;
      section_type: string;
      config: {
        hours?: string[];
        rows?: { key: string }[];
        columns?: { key: string; type: string }[];
      };
    }[];
  };

  const keys = template.sections.map((s) => s.key);
  for (const expected of [
    'shift_details',
    'delay_register',
    'production_batches',
    'hourly_matrix',
    'approvals',
  ]) {
    if (!keys.includes(expected)) {
      console.error(`rmill-lifecycle: missing section ${expected}`, keys);
      process.exit(1);
    }
  }

  const hourly = template.sections.find((s) => s.key === 'hourly_matrix');
  const hours = hourly?.config.hours ?? [];
  if (hours.length !== 12) {
    console.error('rmill-lifecycle: expected 12 hours, got', hours.length, hours);
    process.exit(1);
  }

  let delayCodeId = '';
  if (user.plant_id) {
    const codesRes = await request(`/delay-codes?plant_id=${user.plant_id}`, { headers: auth });
    if (codesRes.res.ok) {
      const codes = codesRes.json as { id: string; code: string }[];
      delayCodeId = codes[0]?.id ?? '';
    }
  }

  const gradesRes = await request('/steel-grades', { headers: auth });
  const grades = gradesRes.res.ok ? (gradesRes.json as { id: string }[]) : [];

  const hoursPayload: Record<string, Record<string, number | string | null>> = {};
  for (const h of hours) {
    hoursPayload[h] = {
      delay_minutes: h === 'I' ? 5 : 0,
      cobble: 0,
      hot_out: h === 'VI' ? 12 : 0,
      rolled: h === 'XII' ? 20 : 1,
      remarks: h === 'I' ? 'smoke' : '',
    };
  }

  const patch = await request(`/process-runs/${run.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      field_values: [
        { field_key: 'date', value: '2026-07-24' },
        { field_key: 'shift', value: shifts[0]?.code ?? 'A' },
        { field_key: 'mill_section', value: 'Bar' },
      ],
      section_data: [
        {
          section_key: 'delay_register',
          data: {
            rows: [
              {
                id: 'delay-smoke-1',
                time_from: '08:00',
                time_to: '08:25',
                time_lost_minutes: 25,
                delay_code_id: delayCodeId,
                reason: 'Roll change',
                action_taken: 'Changed',
                assigned_to: user.id,
                status: 'open',
              },
            ],
          },
        },
        {
          section_key: 'production_batches',
          data: {
            rows: [
              {
                values: {
                  time_start: '2026-07-24T08:30:00.000Z',
                  heat_no: { run_id: '', heat_no: 'RM-SMOKE-1' },
                  grade_id: grades[0]?.id ?? '',
                  charged: 10,
                  rolled: 9,
                  hot_out: 0,
                  cobble: 1,
                  section_shape: 'Round',
                  furnace: {
                    heat_zone_1: 1100,
                    heat_zone_2: 1120,
                    soak_zone_1: 1150,
                    soak_zone_2: 1160,
                  },
                },
              },
            ],
          },
        },
        {
          section_key: 'hourly_matrix',
          data: { hours: hoursPayload },
        },
      ],
    }),
  });
  if (!patch.res.ok) {
    console.error('rmill-lifecycle: PATCH failed', patch.json);
    process.exit(1);
  }

  const detail = await request(`/process-runs/${run.id}`, { headers: auth });
  if (!detail.res.ok) {
    console.error('rmill-lifecycle: GET failed', detail.json);
    process.exit(1);
  }

  const saved = detail.json as {
    section_data: { section_key: string; data: Record<string, unknown> }[];
  };

  const delaySaved = saved.section_data.find((s) => s.section_key === 'delay_register');
  const delayRows = (delaySaved?.data as { rows?: { time_lost_minutes: number; reason: string }[] })
    ?.rows;
  if (!delayRows?.[0] || delayRows[0].time_lost_minutes !== 25 || delayRows[0].reason !== 'Roll change') {
    console.error('rmill-lifecycle: delay not intact', delayRows?.[0]);
    process.exit(1);
  }

  const batchSaved = saved.section_data.find((s) => s.section_key === 'production_batches');
  const batchRow = (batchSaved?.data as { rows?: { values: Record<string, unknown> }[] })?.rows?.[0];
  const heat = batchRow?.values?.heat_no as { heat_no?: string } | undefined;
  if (heat?.heat_no !== 'RM-SMOKE-1') {
    console.error('rmill-lifecycle: batch heat_ref not intact', heat);
    process.exit(1);
  }

  const hourlySaved = saved.section_data.find((s) => s.section_key === 'hourly_matrix');
  const hourMap = (hourlySaved?.data as { hours?: Record<string, Record<string, unknown>> })?.hours;
  if (!hourMap) {
    console.error('rmill-lifecycle: hourly missing');
    process.exit(1);
  }
  for (const h of hours) {
    if (!(h in hourMap)) {
      console.error(`rmill-lifecycle: missing hour ${h}`);
      process.exit(1);
    }
  }
  if (hourMap.I?.delay_minutes !== 5 || hourMap.XII?.rolled !== 20) {
    console.error('rmill-lifecycle: hourly values not intact', hourMap.I, hourMap.XII);
    process.exit(1);
  }

  console.log(
    `rmill-lifecycle: OK run=${run.run_number} delay+batch+${hours.length} hours intact` +
      (delayCodeId ? ' (with delay code)' : '')
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
