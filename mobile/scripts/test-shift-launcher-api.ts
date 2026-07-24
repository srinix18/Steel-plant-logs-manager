/**
 * Smoke: create IAF (melter) + BBAR (bbd worker) + RMILL (rolling worker).
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
    label: 'BBAR daily',
    email: 'worker.bbd@chandansteel.com',
    password: 'bbd123',
    code: 'BBAR',
    payload: { run_type: 'daily' },
  },
  {
    label: 'RMILL shift',
    email: 'worker.rolling@chandansteel.com',
    password: 'rolling123',
    code: 'RMILL',
    payload: { run_type: 'shift', includeShift: true, includeGrade: true },
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
    console.log(`shift-launcher-api: ok (IAF + BBAR + RMILL)`);
  }
}

main();
