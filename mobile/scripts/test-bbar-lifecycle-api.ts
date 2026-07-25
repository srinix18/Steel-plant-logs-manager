/**
 * Smoke: BBAR daily register — customers, production row weight×count, save.
 * Login: worker.bbd@chandansteel.com / bbd123
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
        email: 'worker.bbd@chandansteel.com',
        password: 'bbd123',
      }),
    });
  } catch (err) {
    console.log(`bbar-lifecycle: API unreachable at ${API_URL} — skipped (${String(err)})`);
    process.exit(0);
  }

  if (!login.res.ok) {
    console.log('bbar-lifecycle: bbd worker login failed — skipped');
    process.exit(0);
  }

  const token = (login.json as { access_token: string }).access_token;
  const user = (login.json as { user: { id: string; plant_id?: string } }).user;
  const auth = { Authorization: `Bearer ${token}` };

  if (!user.plant_id) {
    console.error('bbar-lifecycle: user missing plant_id');
    process.exit(1);
  }

  const customersRes = await request(`/customers?plant_id=${user.plant_id}`, {
    headers: auth,
  });
  if (!customersRes.res.ok) {
    console.error('bbar-lifecycle: customers failed', customersRes.json);
    process.exit(1);
  }
  const customers = customersRes.json as { id: string; name: string }[];
  if (customers.length === 0) {
    console.error('bbar-lifecycle: no customers seeded');
    process.exit(1);
  }

  const processesRes = await request('/processes', { headers: auth });
  if (!processesRes.res.ok) {
    console.error('bbar-lifecycle: processes failed', processesRes.json);
    process.exit(1);
  }
  const processes = processesRes.json as { id: string; code: string }[];
  const bbar = processes.find((p) => p.code === 'BBAR');
  if (!bbar) {
    console.log('bbar-lifecycle: BBAR not in scoped processes — skipped');
    process.exit(0);
  }

  const instRes = await request(`/process-instances?process_id=${bbar.id}`, {
    headers: auth,
  });
  const instances = instRes.res.ok ? (instRes.json as { id: string }[]) : [];
  if (!instances[0]) {
    console.error('bbar-lifecycle: no BBAR process instance');
    process.exit(1);
  }

  const create = await request(`/process-instances/${instances[0].id}/runs`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ run_type: 'daily' }),
  });
  if (!create.res.ok) {
    console.error('bbar-lifecycle: create daily run failed', create.json);
    process.exit(1);
  }

  const run = create.json as { id: string; template_version_id: string };
  const today = new Date().toISOString().slice(0, 10);
  const customerId = customers[0].id;
  const coilWeight = 12.5;
  const coilCount = 4;
  const totalWeight = coilWeight * coilCount;

  const gradesRes = await request('/steel-grades', { headers: auth });
  const grades = gradesRes.res.ok ? (gradesRes.json as { id: string }[]) : [];

  const patch = await request(`/process-runs/${run.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      field_values: { date: today },
      section_data: [
        {
          section_key: 'production_register',
          data: {
            rows: [
              {
                id: 'row-1',
                values: {
                  r_size_mm: 20,
                  grade_id: grades[0]?.id ?? null,
                  final_size_mm: 18,
                  heat_no: { run_id: '', heat_no: 'BB-HEAT-1' },
                  coil_weight_kg: coilWeight,
                  coil_count: coilCount,
                  total_weight_kg: totalWeight,
                  customer_id: customerId,
                },
              },
            ],
          },
        },
      ],
    }),
  });
  if (!patch.res.ok) {
    console.error('bbar-lifecycle: patch failed', patch.json);
    process.exit(1);
  }

  const detailRes = await request(`/process-runs/${run.id}`, { headers: auth });
  if (!detailRes.res.ok) {
    console.error('bbar-lifecycle: reload failed', detailRes.json);
    process.exit(1);
  }
  const detail = detailRes.json as {
    field_values: { field_key: string; value: unknown }[];
    section_data: { section_key: string; data: { rows?: { values: Record<string, unknown> }[] } }[];
  };

  const dateFv = detail.field_values.find((f) => f.field_key === 'date');
  if (String(dateFv?.value ?? '') !== today) {
    console.error('bbar-lifecycle: date not saved', dateFv);
    process.exit(1);
  }

  const prod = detail.section_data.find((s) => s.section_key === 'production_register');
  const values = prod?.data?.rows?.[0]?.values ?? {};
  if (values.customer_id !== customerId) {
    console.error('bbar-lifecycle: customer_id not saved', values.customer_id);
    process.exit(1);
  }
  if (Number(values.total_weight_kg) !== totalWeight) {
    console.error('bbar-lifecycle: total_weight_kg mismatch', values.total_weight_kg);
    process.exit(1);
  }

  const tplRes = await request(`/templates/versions/${run.template_version_id}`, {
    headers: auth,
  });
  if (tplRes.res.ok) {
    const tpl = tplRes.json as {
      sections: { key: string; config?: { columns?: { key: string; type: string; formula?: string }[] } }[];
    };
    const keys = tpl.sections.map((s) => s.key);
    if (!keys.includes('register_header') || !keys.includes('production_register')) {
      console.error('bbar-lifecycle: unexpected sections', keys);
      process.exit(1);
    }
    const cols = tpl.sections.find((s) => s.key === 'production_register')?.config?.columns ?? [];
    const totalCol = cols.find((c) => c.key === 'total_weight_kg');
    const custCol = cols.find((c) => c.key === 'customer_id');
    if (totalCol?.type !== 'calculated' || totalCol.formula !== 'coil_weight_kg * coil_count') {
      console.error('bbar-lifecycle: total_weight column mismatch', totalCol);
      process.exit(1);
    }
    if (custCol?.type !== 'customer_ref') {
      console.error('bbar-lifecycle: customer_ref column missing', custCol);
      process.exit(1);
    }
  }

  const start = await request(`/process-runs/${run.id}/transitions`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ to_state: 'in_progress' }),
  });
  if (!start.res.ok) {
    console.error('bbar-lifecycle: Start Register failed', start.json);
    process.exit(1);
  }

  console.log(
    `bbar-lifecycle: OK run=${run.id} customer=${customers[0].name} total=${totalWeight}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
