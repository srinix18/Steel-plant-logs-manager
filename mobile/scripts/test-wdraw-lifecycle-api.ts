/**
 * Smoke: WDRAW — ensure completed coil via WFURN, then drawing input/output with
 * condition + lubricant + dual inlet_coil_ref.
 * Login: worker.wire@chandansteel.com / wire123
 */
const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(
  /\/$/,
  ''
);

const CONDITION_OPTIONS = ['Normal', 'Rusty', 'Damaged', 'Wet', 'Surface Defect'];
const LUBRICANT_OPTIONS = ['Soap', 'Drawing Powder', 'Oil'];

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
    console.log(`wdraw-lifecycle: API unreachable at ${API_URL} — skipped (${String(err)})`);
    process.exit(0);
  }

  if (!login.res.ok) {
    console.log('wdraw-lifecycle: wire worker login failed — skipped');
    process.exit(0);
  }

  const token = (login.json as { access_token: string }).access_token;
  const user = (login.json as { user: { id: string; plant_id?: string } }).user;
  const auth = { Authorization: `Bearer ${token}` };

  const processesRes = await request('/processes', { headers: auth });
  if (!processesRes.res.ok) {
    console.error('wdraw-lifecycle: processes failed', processesRes.json);
    process.exit(1);
  }
  const processes = processesRes.json as { id: string; code: string }[];
  const wfurn = processes.find((p) => p.code === 'WFURN');
  const wdraw = processes.find((p) => p.code === 'WDRAW');
  if (!wdraw) {
    console.log('wdraw-lifecycle: WDRAW not in scoped processes — skipped');
    process.exit(0);
  }

  const shiftsRes = await request(
    user.plant_id ? `/shifts?plant_id=${user.plant_id}` : '/shifts',
    { headers: auth }
  );
  const shifts = shiftsRes.res.ok ? (shiftsRes.json as { id: string; code: string }[]) : [];
  const gradesRes = await request('/steel-grades', { headers: auth });
  const grades = gradesRes.res.ok ? (gradesRes.json as { id: string }[]) : [];

  // Produce a completed coil via WFURN when available
  let completedCoil: { id: string; coil_no: string } | null = null;
  if (wfurn && user.plant_id) {
    const instRes = await request(`/process-instances?process_id=${wfurn.id}`, {
      headers: auth,
    });
    const instances = instRes.res.ok ? (instRes.json as { id: string }[]) : [];
    if (instances[0]) {
      const createBody: Record<string, string> = { run_type: 'shift' };
      if (shifts[0]) createBody.shift_id = shifts[0].id;
      const create = await request(`/process-instances/${instances[0].id}/runs`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify(createBody),
      });
      if (create.res.ok) {
        const run = create.json as { id: string };
        const coilNo = `WD-SRC-${Date.now().toString().slice(-6)}`;
        await request(`/process-runs/${run.id}`, {
          method: 'PATCH',
          headers: auth,
          body: JSON.stringify({
            section_data: [
              {
                section_key: 'input_coils',
                data: {
                  rows: [
                    {
                      values: {
                        work_order_no: 'WO-WD',
                        grade_id: grades[0]?.id ?? '',
                        size_mm: 8,
                        coil_no: coilNo,
                      },
                    },
                  ],
                },
              },
            ],
          }),
        });
        const coilsRes = await request(
          `/coils?plant_id=${user.plant_id}&run_id=${run.id}`,
          { headers: auth }
        );
        const coils = coilsRes.res.ok
          ? (coilsRes.json as { id: string; coil_no: string }[])
          : [];
        const matched = coils.find((c) => c.coil_no === coilNo);
        if (matched) {
          await request(`/process-runs/${run.id}`, {
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
                          weight_kg: 400,
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          });
          completedCoil = matched;
        }
      }
    }
  }

  const wdrawInst = await request(`/process-instances?process_id=${wdraw.id}`, {
    headers: auth,
  });
  if (!wdrawInst.res.ok) {
    console.error('wdraw-lifecycle: WDRAW instances failed', wdrawInst.json);
    process.exit(1);
  }
  const wdrawInstances = wdrawInst.json as { id: string }[];
  if (!wdrawInstances.length) {
    console.log('wdraw-lifecycle: no WDRAW instances — skipped');
    process.exit(0);
  }

  const createBody: Record<string, string> = { run_type: 'shift' };
  if (shifts[0]) createBody.shift_id = shifts[0].id;
  const create = await request(`/process-instances/${wdrawInstances[0].id}/runs`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify(createBody),
  });
  if (!create.res.ok) {
    console.error('wdraw-lifecycle: create failed', create.json);
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
    console.error('wdraw-lifecycle: template failed', tmpl.json);
    process.exit(1);
  }

  const template = tmpl.json as {
    sections: {
      key: string;
      config: {
        coil_picker_purpose?: string;
        columns?: { key: string; type: string; options?: string[] }[];
      };
    }[];
  };

  const keys = template.sections.map((s) => s.key);
  for (const expected of [
    'shift_details',
    'input_material',
    'output_material',
    'approvals',
  ]) {
    if (!keys.includes(expected)) {
      console.error(`wdraw-lifecycle: missing section ${expected}`, keys);
      process.exit(1);
    }
  }

  const inputSec = template.sections.find((s) => s.key === 'input_material');
  const outputSec = template.sections.find((s) => s.key === 'output_material');
  if (inputSec?.config.coil_picker_purpose !== 'drawing') {
    console.error('wdraw-lifecycle: input_material missing coil_picker_purpose=drawing');
    process.exit(1);
  }
  if (outputSec?.config.coil_picker_purpose !== 'drawing') {
    console.error('wdraw-lifecycle: output_material missing coil_picker_purpose=drawing');
    process.exit(1);
  }

  const conditionCol = inputSec?.config.columns?.find((c) => c.key === 'condition');
  const lubricantCol = outputSec?.config.columns?.find((c) => c.key === 'lubricant');
  if (JSON.stringify(conditionCol?.options) !== JSON.stringify(CONDITION_OPTIONS)) {
    console.error('wdraw-lifecycle: condition options mismatch', conditionCol?.options);
    process.exit(1);
  }
  if (JSON.stringify(lubricantCol?.options) !== JSON.stringify(LUBRICANT_OPTIONS)) {
    console.error('wdraw-lifecycle: lubricant options mismatch', lubricantCol?.options);
    process.exit(1);
  }

  const inletIn = inputSec?.config.columns?.find((c) => c.key === 'inlet_coil_ref');
  const inletOut = outputSec?.config.columns?.find((c) => c.key === 'inlet_coil_ref');
  if (inletIn?.type !== 'coil_ref' || inletOut?.type !== 'coil_ref') {
    console.error('wdraw-lifecycle: dual inlet_coil_ref missing');
    process.exit(1);
  }

  if (!user.plant_id) {
    console.log('wdraw-lifecycle: template options OK (no plant_id for coil save)');
    process.exit(0);
  }

  const drawingCoilsRes = await request(
    `/coils?plant_id=${user.plant_id}&run_id=${run.id}&purpose=drawing`,
    { headers: auth }
  );
  if (!drawingCoilsRes.res.ok) {
    console.error('wdraw-lifecycle: drawing coils failed', drawingCoilsRes.json);
    process.exit(1);
  }
  const drawingCoils = drawingCoilsRes.json as {
    id: string;
    coil_no: string;
    status: string;
  }[];

  const pick =
    (completedCoil && drawingCoils.find((c) => c.id === completedCoil.id)) ||
    drawingCoils.find((c) => c.status === 'completed') ||
    drawingCoils[0];

  if (!pick) {
    console.log(
      'wdraw-lifecycle: template options OK — no completed coils for picker (run WFURN first)'
    );
    process.exit(0);
  }

  const finishNo = `FIN-${Date.now().toString().slice(-6)}`;
  const patch = await request(`/process-runs/${run.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      field_values: [
        { field_key: 'date', value: '2026-07-25' },
        { field_key: 'shift', value: shifts[0]?.code ?? 'A' },
        { field_key: 'operator', value: user.id },
      ],
      section_data: [
        {
          section_key: 'input_material',
          data: {
            rows: [
              {
                values: {
                  work_order_no: 'WO-DRAW',
                  grade_id: grades[0]?.id ?? '',
                  heat_no: { run_id: '', heat_no: 'H-D' },
                  inlet_size_mm: 8,
                  inlet_coil_ref: { coil_id: pick.id, coil_no: pick.coil_no },
                  condition: 'Normal',
                },
              },
            ],
          },
        },
        {
          section_key: 'output_material',
          data: {
            rows: [
              {
                values: {
                  inlet_coil_ref: { coil_id: pick.id, coil_no: pick.coil_no },
                  outlet_size_mm: 5.5,
                  lubricant: 'Soap',
                  finish_coil_no: finishNo,
                  weight_kg: 380,
                  remark: 'smoke',
                },
              },
            ],
          },
        },
      ],
    }),
  });
  if (!patch.res.ok) {
    console.error('wdraw-lifecycle: PATCH failed', patch.json);
    process.exit(1);
  }

  const detail = await request(`/process-runs/${run.id}`, { headers: auth });
  if (!detail.res.ok) {
    console.error('wdraw-lifecycle: GET failed', detail.json);
    process.exit(1);
  }
  const saved = detail.json as {
    section_data: {
      section_key: string;
      data: {
        rows?: {
          values: {
            condition?: string;
            lubricant?: string;
            inlet_coil_ref?: { coil_id: string };
            finish_coil_no?: string;
          };
        }[];
      };
    }[];
  };

  const inRow = saved.section_data.find((s) => s.section_key === 'input_material')?.data
    ?.rows?.[0];
  const outRow = saved.section_data.find((s) => s.section_key === 'output_material')?.data
    ?.rows?.[0];

  if (inRow?.values?.condition !== 'Normal') {
    console.error('wdraw-lifecycle: condition not intact', inRow?.values);
    process.exit(1);
  }
  if (outRow?.values?.lubricant !== 'Soap') {
    console.error('wdraw-lifecycle: lubricant not intact', outRow?.values);
    process.exit(1);
  }
  if (inRow?.values?.inlet_coil_ref?.coil_id !== pick.id) {
    console.error('wdraw-lifecycle: input inlet_coil_ref not intact', inRow?.values);
    process.exit(1);
  }
  if (outRow?.values?.inlet_coil_ref?.coil_id !== pick.id) {
    console.error('wdraw-lifecycle: output inlet_coil_ref not intact', outRow?.values);
    process.exit(1);
  }
  if (outRow?.values?.finish_coil_no !== finishNo) {
    console.error('wdraw-lifecycle: finish_coil_no not intact', outRow?.values);
    process.exit(1);
  }

  console.log(
    `wdraw-lifecycle: OK run=${run.run_number} coil=${pick.coil_no} condition+lubricant+dual inlet_coil_ref`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
