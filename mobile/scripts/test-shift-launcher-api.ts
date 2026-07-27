/**
 * Smoke P3-OPS-SHIFT: create IAF / CCM / BBAR / RMILL / GRIND;
 * plant active runs; handover-notes/previous endpoint.
 * Skips unreachable API or missing process/instance for that role.
 */
const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(
  /\/$/,
  ''
);

type Scenario = {
  label: string;
  email: string;
  password: string;
  code: string;
  payload: { run_type: string; includeShift?: boolean; includeGrade?: boolean };
  /** When true, create body must not contain grade_id (CCM / daily). */
  forbidGrade?: boolean;
};

const SCENARIOS: Scenario[] = [
  {
    label: 'IAF heat',
    email: 'melter@chandansteel.com',
    password: 'worker123',
    code: 'IAF',
    payload: { run_type: 'heat', includeShift: true, includeGrade: true },
  },
  {
    label: 'CCM cast (no grade)',
    email: 'ccm.supervisor@chandansteel.com',
    password: 'ccm123',
    code: 'CCM',
    payload: { run_type: 'cast', includeShift: true, includeGrade: false },
    forbidGrade: true,
  },
  {
    label: 'BBAR daily',
    email: 'worker.bbd@chandansteel.com',
    password: 'bbd123',
    code: 'BBAR',
    payload: { run_type: 'daily' },
    forbidGrade: true,
  },
  {
    label: 'RMILL shift',
    email: 'worker.rolling@chandansteel.com',
    password: 'rolling123',
    code: 'RMILL',
    payload: { run_type: 'shift', includeShift: true, includeGrade: true },
  },
  {
    label: 'GRIND daily',
    email: 'worker.forge@chandansteel.com',
    password: 'forge123',
    code: 'GRIND',
    payload: { run_type: 'daily' },
    forbidGrade: true,
  },
];

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

async function runScenario(scenario: Scenario): Promise<boolean> {
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: scenario.email, password: scenario.password }),
  });
  if (!login.res.ok) {
    console.log(`skip ${scenario.label}: login failed`);
    return false;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const processesRes = await request('/processes', { headers: auth });
  if (!processesRes.res.ok) {
    console.error(`shift-launcher-api: ${scenario.label} processes failed`, processesRes.json);
    process.exit(1);
  }
  const processes = processesRes.json as { id: string; code: string }[];
  const proc = processes.find((p) => p.code === scenario.code);
  if (!proc) {
    console.log(`skip ${scenario.label}: ${scenario.code} not in scoped processes`);
    return false;
  }

  const instRes = await request(`/process-instances?process_id=${proc.id}`, { headers: auth });
  if (!instRes.res.ok) {
    console.error(`shift-launcher-api: ${scenario.label} instances failed`, instRes.json);
    process.exit(1);
  }
  const instances = instRes.json as { id: string }[];
  if (!instances.length) {
    console.log(`skip ${scenario.label}: no instances`);
    return false;
  }

  const body: { run_type: string; shift_id?: string; grade_id?: string } = {
    run_type: scenario.payload.run_type,
  };

  if (scenario.payload.includeShift || scenario.payload.includeGrade) {
    const plantsRes = await request('/plants', { headers: auth });
    const plants = plantsRes.res.ok ? (plantsRes.json as { id: string }[]) : [];
    const plantId = plants[0]?.id;
    if (scenario.payload.includeShift && plantId) {
      const shiftsRes = await request(`/shifts?plant_id=${plantId}`, { headers: auth });
      if (shiftsRes.res.ok) {
        const shifts = shiftsRes.json as { id: string }[];
        if (shifts[0]) body.shift_id = shifts[0].id;
      }
    }
    if (scenario.payload.includeGrade) {
      const gradesRes = await request('/steel-grades', { headers: auth });
      if (gradesRes.res.ok) {
        const grades = gradesRes.json as { id: string }[];
        if (grades[0]) body.grade_id = grades[0].id;
      }
    }
  }

  // Daily must not send shift/grade even if present
  if (scenario.payload.run_type === 'daily') {
    delete body.shift_id;
    delete body.grade_id;
  }

  if (scenario.forbidGrade && body.grade_id) {
    console.error(`shift-launcher-api: ${scenario.label} must not send grade_id`, body);
    process.exit(1);
  }

  const create = await request(`/process-instances/${instances[0].id}/runs`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify(body),
  });
  if (!create.res.ok) {
    console.error(`shift-launcher-api: create ${scenario.label} failed`, create.json);
    process.exit(1);
  }
  const run = create.json as { run_number: string; run_type: string };
  if (run.run_type !== scenario.payload.run_type) {
    console.error(`shift-launcher-api: ${scenario.label} type mismatch`, run);
    process.exit(1);
  }
  console.log(`ok  ${scenario.label} → ${run.run_type} ${run.run_number}`);
  return true;
}

/** Plant-scoped active runs + previous handover GET (does not require a note to exist). */
async function checkActiveRunsAndHandover(): Promise<void> {
  // `/plants/{id}/runs/active` requires SupervisorUser — not a floor worker.
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'iaf.supervisor@chandansteel.com',
      password: 'iaf123',
    }),
  });
  if (!login.res.ok) {
    console.log('skip active/handover: supervisor login failed');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const meRes = await request('/auth/me', { headers: auth });
  const me = meRes.res.ok
    ? (meRes.json as { plant_id?: string; department_id?: string })
    : {};

  const plantsRes = await request('/plants', { headers: auth });
  if (!plantsRes.res.ok) {
    console.error('shift-launcher-api: plants failed', plantsRes.json);
    process.exit(1);
  }
  const plants = plantsRes.json as { id: string }[];
  const plantId = me.plant_id || plants[0]?.id;
  if (!plantId) {
    console.log('skip active runs: no plant');
    return;
  }

  const activeRes = await request(`/plants/${plantId}/runs/active`, { headers: auth });
  if (!activeRes.res.ok) {
    console.error('shift-launcher-api: active runs failed', activeRes.json);
    process.exit(1);
  }
  if (!Array.isArray(activeRes.json)) {
    console.error('shift-launcher-api: active runs not an array', activeRes.json);
    process.exit(1);
  }
  console.log(`ok  active runs (plant) → ${activeRes.json.length} run(s)`);

  const shiftsRes = await request(`/shifts?plant_id=${plantId}`, { headers: auth });
  if (!shiftsRes.res.ok || !Array.isArray(shiftsRes.json) || !(shiftsRes.json as { id: string }[]).length) {
    console.log('skip handover: no shifts');
    return;
  }
  const shiftId = (shiftsRes.json as { id: string }[])[0].id;
  const deptId = me.department_id;
  if (!deptId) {
    console.log('skip handover: no department_id on user');
    return;
  }

  const handRes = await request(
    `/workforce/handover-notes/previous?department_id=${deptId}&shift_id=${shiftId}`,
    { headers: auth }
  );
  if (!handRes.res.ok) {
    console.error('shift-launcher-api: handover previous failed', handRes.json);
    process.exit(1);
  }
  const note = handRes.json as { note?: string } | null;
  console.log(
    note?.note
      ? `ok  handover previous → note present (${String(note.note).slice(0, 40)}…)`
      : 'ok  handover previous → null/empty (banner hidden)'
  );
}

async function main() {
  try {
    await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@logbook.app', password: 'admin123' }),
    });
  } catch (err) {
    console.log(`shift-launcher-api: API unreachable at ${API_URL} — skipped (${String(err)})`);
    process.exit(0);
  }

  let okCount = 0;
  for (const scenario of SCENARIOS) {
    if (await runScenario(scenario)) okCount += 1;
  }

  await checkActiveRunsAndHandover();

  if (okCount === 0) {
    console.log('shift-launcher-api: no create targets available — skipped');
    process.exit(0);
  }

  const missing = SCENARIOS.length - okCount;
  if (missing > 0) {
    console.log(
      `shift-launcher-api: ok (${okCount}/${SCENARIOS.length}; ${missing} skipped by role scope)`
    );
  } else {
    console.log(`shift-launcher-api: ok (IAF + CCM + BBAR + RMILL + GRIND + active/handover)`);
  }
}

main();
