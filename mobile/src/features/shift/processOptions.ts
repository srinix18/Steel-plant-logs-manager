import type { ProcessOption } from '@/src/types/platform';

/** Shop-floor processes launched from Shift Dashboard (P2-ENGINE-04). */
export const PROCESS_OPTIONS: ProcessOption[] = [
  { code: 'IAF', label: 'IAF — Induction Furnace', instanceLabel: 'Furnace', runType: 'heat' },
  {
    code: 'AOD',
    label: 'AOD — Argon Oxygen Decarburization',
    instanceLabel: 'AOD Vessel',
    runType: 'ladle_metallurgy',
  },
  { code: 'CCM', label: 'CCM — Continuous Casting', instanceLabel: 'Caster Line', runType: 'cast' },
  { code: 'RMILL', label: 'Rolling Mill Production', instanceLabel: 'Mill Line', runType: 'shift' },
  {
    code: 'WFURN',
    label: 'Wire Furnace Production',
    instanceLabel: 'Annealing Furnace',
    runType: 'shift',
  },
  {
    code: 'WDRAW',
    label: 'Wire Drawing Production',
    instanceLabel: 'Drawing Machine',
    runType: 'shift',
  },
  {
    code: 'BBAR',
    label: 'Bright Bar Production Register',
    instanceLabel: 'Production Line',
    runType: 'daily',
  },
  {
    code: 'GRIND',
    label: 'Forge Shop — Grinding Material Details',
    instanceLabel: 'Work Centre',
    runType: 'daily',
  },
];

export function filterProcessOptions(
  availableCodes: string[],
  options: ProcessOption[] = PROCESS_OPTIONS
): ProcessOption[] {
  const allowed = new Set(availableCodes);
  return options.filter((p) => allowed.has(p.code));
}

export function isDailyRunType(runType: string | undefined): boolean {
  return runType === 'daily';
}

export function showsGradeField(processCode: string, runType: string | undefined): boolean {
  if (isDailyRunType(runType)) return false;
  if (processCode === 'CCM') return false;
  return true;
}

export function showsShiftField(runType: string | undefined): boolean {
  return !isDailyRunType(runType);
}

export function startButtonLabel(processCode: string, runType: string | undefined): string {
  if (isDailyRunType(runType)) return 'Start Daily Register';
  if (processCode === 'CCM') return 'Start Shift Log';
  if (processCode === 'AOD') return 'Start AOD Run';
  if (runType === 'shift') return 'Start Shift Report';
  return 'Start Heat';
}

export function buildCreateRunPayload(opts: {
  runType: string;
  shiftId?: string;
  gradeId?: string;
  isDaily: boolean;
  showGrade: boolean;
}): { run_type: string; shift_id?: string; grade_id?: string } {
  const payload: { run_type: string; shift_id?: string; grade_id?: string } = {
    run_type: opts.runType,
  };
  if (!opts.isDaily && opts.shiftId) payload.shift_id = opts.shiftId;
  if (opts.showGrade && opts.gradeId) payload.grade_id = opts.gradeId;
  return payload;
}
