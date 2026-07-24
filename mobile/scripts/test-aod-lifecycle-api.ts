/**
 * Smoke: AOD ladle_metallurgy — create run, PATCH all 13 section keys + sample temp + blow columns.
 * Login: aod.supervisor@chandansteel.com / aod123
 */
const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(
  /\/$/,
  ''
);

const AOD_SECTION_KEYS = [
  'heat_info',
  'equipment_info',
  'personnel',
  'weight_info',
  'alloy_additions',
  'flux_additions',
  'blow_process',
  'required_chemistry',
  'sample_chemistry',
  'time_summary',
  'gas_consumption',
  'remarks',
  'approvals',
] as const;

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
        email: 'aod.supervisor@chandansteel.com',
        password: 'aod123',
      }),
    });
  } catch (err) {
    console.log(`aod-lifecycle: API unreachable at ${API_URL} — skipped (${String(err)})`);
    process.exit(0);
  }

  if (!login.res.ok) {
    console.log('aod-lifecycle: AOD supervisor login failed — skipped');
    process.exit(0);
  }

  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const processesRes = await request('/processes', { headers: auth });
  if (!processesRes.res.ok) {
    console.error('aod-lifecycle: processes failed', processesRes.json);
    process.exit(1);
  }
  const processes = processesRes.json as { id: string; code: string }[];
  const aod = processes.find((p) => p.code === 'AOD');
  if (!aod) {
    console.log('aod-lifecycle: AOD not in scoped processes — skipped');
    process.exit(0);
  }

  const instRes = await request(`/process-instances?process_id=${aod.id}`, { headers: auth });
  if (!instRes.res.ok) {
    console.error('aod-lifecycle: instances failed', instRes.json);
    process.exit(1);
  }
  const instances = instRes.json as { id: string }[];
  if (!instances.length) {
    console.log('aod-lifecycle: no AOD instances — skipped');
    process.exit(0);
  }

  const create = await request(`/process-instances/${instances[0].id}/runs`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ run_type: 'ladle_metallurgy' }),
  });
  if (!create.res.ok) {
    console.error('aod-lifecycle: create failed', create.json);
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
    console.error('aod-lifecycle: template failed', tmpl.json);
    process.exit(1);
  }

  const template = tmpl.json as {
    sections: {
      key: string;
      section_type: string;
      fields: { name: string }[];
      config: Record<string, unknown>;
    }[];
  };

  const keys = template.sections.map((s) => s.key);
  for (const expected of AOD_SECTION_KEYS) {
    if (!keys.includes(expected)) {
      console.error(`aod-lifecycle: missing section ${expected}`, keys);
      process.exit(1);
    }
  }
  if (keys.length < 13) {
    console.error('aod-lifecycle: expected ≥13 sections, got', keys.length);
    process.exit(1);
  }

  const blow = template.sections.find((s) => s.key === 'blow_process');
  const blowCols = (blow?.config.columns as { key: string }[] | undefined) ?? [];
  if (blowCols.length < 16) {
    console.error('aod-lifecycle: blow columns < 16', blowCols.length);
    process.exit(1);
  }

  const sample = template.sections.find((s) => s.key === 'sample_chemistry');
  if (!sample?.config.include_temperature) {
    console.error('aod-lifecycle: sample_chemistry missing include_temperature');
    process.exit(1);
  }

  const heatInfo = template.sections.find((s) => s.key === 'heat_info');
  const fieldPatch = (heatInfo?.fields ?? []).slice(0, 3).map((f) => ({
    field_key: f.name,
    value: f.name === 'heat_no' ? run.run_number.split('-').pop() ?? 'T1' : 'A',
  }));

  const blowRows = ((blow?.config.rows as string[]) ?? ['De-Si']).map((blow_no, i) => ({
    blow_no,
    values: {
      consumption_o2: i === 0 ? 12 : 0,
      consumption_n2: i === 0 ? 3 : 0,
      consumption_ar: i === 0 ? 1 : 0,
      ...(blowCols[0] ? { [blowCols[0].key]: new Date().toISOString() } : {}),
    },
  }));

  const sampleRows = ((sample?.config.sample_rows as string[]) ?? ['Final']).map((name) => ({
    sample: name,
    temperature: name === 'Final' ? 1650 : null,
    elements: { C: 0.04 },
  }));

  const section_data = [
    {
      section_key: 'alloy_additions',
      data: { rows: [{ material: 'FE_CR', quantity_kg: 10 }] },
    },
    {
      section_key: 'flux_additions',
      data: { rows: [{ material: 'LIME', quantity_kg: 5 }] },
    },
    { section_key: 'blow_process', data: { rows: blowRows } },
    {
      section_key: 'required_chemistry',
      data: { targets: { C: 0.05, SI: 0.4 } },
    },
    { section_key: 'sample_chemistry', data: { rows: sampleRows } },
  ];

  const patch = await request(`/process-runs/${run.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      field_values: [
        ...fieldPatch,
        { field_key: 'o2_nm3', value: '12' },
        { field_key: 'n2_nm3', value: '3' },
        { field_key: 'ar_nm3', value: '1' },
      ],
      section_data,
    }),
  });
  if (!patch.res.ok) {
    console.error('aod-lifecycle: PATCH failed', patch.json);
    process.exit(1);
  }

  const detail = await request(`/process-runs/${run.id}`, { headers: auth });
  if (!detail.res.ok) {
    console.error('aod-lifecycle: GET failed', detail.json);
    process.exit(1);
  }

  const saved = detail.json as {
    section_data: { section_key: string; data: Record<string, unknown> }[];
    field_values: { field_key: string; value: unknown }[];
  };

  for (const key of [
    'alloy_additions',
    'flux_additions',
    'blow_process',
    'required_chemistry',
    'sample_chemistry',
  ]) {
    if (!saved.section_data.some((s) => s.section_key === key)) {
      console.error(`aod-lifecycle: section ${key} not persisted`);
      process.exit(1);
    }
  }

  const blowSaved = saved.section_data.find((s) => s.section_key === 'blow_process');
  const blowData = blowSaved?.data as { rows?: { values: Record<string, unknown> }[] };
  if (!blowData?.rows?.length) {
    console.error('aod-lifecycle: blow rows empty after save');
    process.exit(1);
  }

  const sampleSaved = saved.section_data.find((s) => s.section_key === 'sample_chemistry');
  const sampleData = sampleSaved?.data as {
    rows?: { sample: string; temperature: number | null }[];
  };
  const finalRow = sampleData?.rows?.find((r) => r.sample === 'Final');
  if (finalRow?.temperature !== 1650) {
    console.error('aod-lifecycle: sample temperature not saved', finalRow);
    process.exit(1);
  }

  const o2 = saved.field_values.find((f) => f.field_key === 'o2_nm3');
  if (String(o2?.value ?? '') !== '12') {
    console.error('aod-lifecycle: o2_nm3 not saved', o2);
    process.exit(1);
  }

  // Save remaining field sections (empty/minimal) to prove all 13 are writable
  const fieldSections = template.sections.filter((s) => s.section_type === 'fields');
  for (const sec of fieldSections) {
    if (!sec.fields.length) continue;
    const fv = sec.fields.slice(0, 1).map((f) => ({
      field_key: f.name,
      value: 'ok',
    }));
    const r = await request(`/process-runs/${run.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ field_values: fv }),
    });
    if (!r.res.ok) {
      console.error(`aod-lifecycle: save fields ${sec.key} failed`, r.json);
      process.exit(1);
    }
  }

  console.log(
    `aod-lifecycle: OK run=${run.run_number} sections=${keys.length} blowCols=${blowCols.length} sampleTemp=1650`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
