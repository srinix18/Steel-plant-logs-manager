/**
 * Smoke: CCM cast — create run, add casting row with mould_tube + time_range + zone_strand, reopen.
 * Login: ccm.supervisor@chandansteel.com / ccm123
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
        email: 'ccm.supervisor@chandansteel.com',
        password: 'ccm123',
      }),
    });
  } catch (err) {
    console.log(`ccm-lifecycle: API unreachable at ${API_URL} — skipped (${String(err)})`);
    process.exit(0);
  }

  if (!login.res.ok) {
    console.log('ccm-lifecycle: CCM supervisor login failed — skipped');
    process.exit(0);
  }

  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const processesRes = await request('/processes', { headers: auth });
  if (!processesRes.res.ok) {
    console.error('ccm-lifecycle: processes failed', processesRes.json);
    process.exit(1);
  }
  const processes = processesRes.json as { id: string; code: string }[];
  const ccm = processes.find((p) => p.code === 'CCM');
  if (!ccm) {
    console.log('ccm-lifecycle: CCM not in scoped processes — skipped');
    process.exit(0);
  }

  const instRes = await request(`/process-instances?process_id=${ccm.id}`, { headers: auth });
  if (!instRes.res.ok) {
    console.error('ccm-lifecycle: instances failed', instRes.json);
    process.exit(1);
  }
  const instances = instRes.json as { id: string }[];
  if (!instances.length) {
    console.log('ccm-lifecycle: no CCM instances — skipped');
    process.exit(0);
  }

  const create = await request(`/process-instances/${instances[0].id}/runs`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ run_type: 'cast' }),
  });
  if (!create.res.ok) {
    console.error('ccm-lifecycle: create failed', create.json);
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
    console.error('ccm-lifecycle: template failed', tmpl.json);
    process.exit(1);
  }

  const template = tmpl.json as {
    sections: {
      key: string;
      section_type: string;
      config: { columns?: { key: string; type: string; subtype?: string }[] };
      fields: { name: string }[];
    }[];
  };

  const keys = template.sections.map((s) => s.key);
  for (const expected of ['shift_header', 'casting_entries', 'remarks', 'approvals']) {
    if (!keys.includes(expected)) {
      console.error(`ccm-lifecycle: missing section ${expected}`, keys);
      process.exit(1);
    }
  }

  const casting = template.sections.find((s) => s.key === 'casting_entries');
  if (casting?.section_type !== 'production_log_table') {
    console.error('ccm-lifecycle: casting_entries wrong type', casting?.section_type);
    process.exit(1);
  }
  const colTypes = Object.fromEntries(
    (casting.config.columns ?? []).map((c) => [c.key, c.type])
  );
  for (const key of ['mould_tube', 'purging_time', 'water_flow_secondary', 'cast_start', 'cast_end']) {
    if (!colTypes[key]) {
      console.error(`ccm-lifecycle: missing column ${key}`);
      process.exit(1);
    }
  }
  if (colTypes.cast_end !== 'strand_pair') {
    console.error('ccm-lifecycle: cast_end should be strand_pair');
    process.exit(1);
  }

  const start = '2026-07-24T08:00:00.000Z';
  const end = '2026-07-24T08:45:00.000Z';
  const castStart = '2026-07-24T09:00:00.000Z';
  const castEnd = '2026-07-24T10:30:00.000Z';

  const row = {
    values: {
      heat_no: 'CCM-TEST-1',
      start_pouring: start,
      purging_time: {
        start,
        end,
        total_minutes: 45,
      },
      cast_start: { strand_1: castStart, strand_2: castStart },
      cast_end: { strand_1: castEnd, strand_2: castEnd },
      water_flow_secondary: {
        zone_1: { strand_1: 10, strand_2: 11 },
        zone_2: { strand_1: 12, strand_2: 13 },
      },
      mould_tube: {
        strand_1: { no: 'MT-01', life: 42 },
        strand_2: { no: 'MT-02', life: 17 },
      },
      billets_count: 24,
    },
  };

  const patch = await request(`/process-runs/${run.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      field_values: [
        { field_key: 'date', value: '2026-07-24' },
        { field_key: 'shift', value: 'A' },
      ],
      section_data: [{ section_key: 'casting_entries', data: { rows: [row] } }],
    }),
  });
  if (!patch.res.ok) {
    console.error('ccm-lifecycle: PATCH failed', patch.json);
    process.exit(1);
  }

  const detail = await request(`/process-runs/${run.id}`, { headers: auth });
  if (!detail.res.ok) {
    console.error('ccm-lifecycle: GET failed', detail.json);
    process.exit(1);
  }

  const saved = detail.json as {
    section_data: { section_key: string; data: { rows?: typeof row[] } }[];
  };
  const castingSaved = saved.section_data.find((s) => s.section_key === 'casting_entries');
  const first = castingSaved?.data?.rows?.[0];
  if (!first) {
    console.error('ccm-lifecycle: casting row missing after save');
    process.exit(1);
  }

  const mould = first.values.mould_tube as {
    strand_1: { no: string; life: number };
    strand_2: { no: string; life: number };
  };
  if (mould?.strand_1?.no !== 'MT-01' || mould?.strand_1?.life !== 42) {
    console.error('ccm-lifecycle: mould_tube not intact', mould);
    process.exit(1);
  }

  const purging = first.values.purging_time as {
    start: string;
    end: string;
    total_minutes: number;
  };
  if (purging?.total_minutes !== 45 || purging?.start !== start) {
    console.error('ccm-lifecycle: time_range not intact', purging);
    process.exit(1);
  }

  const zone = first.values.water_flow_secondary as {
    zone_1: { strand_1: number };
    zone_2: { strand_2: number };
  };
  if (zone?.zone_1?.strand_1 !== 10 || zone?.zone_2?.strand_2 !== 13) {
    console.error('ccm-lifecycle: zone_strand not intact', zone);
    process.exit(1);
  }

  const castEndSaved = first.values.cast_end as { strand_1: string };
  if (castEndSaved?.strand_1 !== castEnd) {
    console.error('ccm-lifecycle: cast_end datetime not intact', castEndSaved);
    process.exit(1);
  }

  // Add a second empty-ish row (acceptance: Add row)
  const patch2 = await request(`/process-runs/${run.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      section_data: [
        {
          section_key: 'casting_entries',
          data: {
            rows: [
              first,
              {
                values: {
                  heat_no: 'CCM-TEST-2',
                  mould_tube: {
                    strand_1: { no: 'MT-03', life: 1 },
                    strand_2: { no: '', life: null },
                  },
                },
              },
            ],
          },
        },
      ],
    }),
  });
  if (!patch2.res.ok) {
    console.error('ccm-lifecycle: add row PATCH failed', patch2.json);
    process.exit(1);
  }

  const again = await request(`/process-runs/${run.id}`, { headers: auth });
  const rows = (
    (again.json as typeof saved).section_data.find((s) => s.section_key === 'casting_entries')
      ?.data as { rows: unknown[] }
  )?.rows;
  if (!rows || rows.length < 2) {
    console.error('ccm-lifecycle: expected ≥2 rows after add', rows?.length);
    process.exit(1);
  }

  console.log(
    `ccm-lifecycle: OK run=${run.run_number} rows=${rows.length} mould+time_range+zone_strand intact`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
