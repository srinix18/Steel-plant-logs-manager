/** Process code → admin log-sheet shortcut (parity with web AdminDepartmentsPage). */
export const PROCESS_LOG_SHEETS: Record<string, { doc: string; label: string }> = {
  EAF: { doc: 'F/PRD/02', label: 'Furnace Log F/PRD/02' },
  IAF: { doc: 'F/PRD/02', label: 'Furnace Log F/PRD/02' },
  AOD: { doc: 'F/PRD/03', label: 'AOD Log F/PRD/03' },
  CCM: { doc: 'F/PRD/04', label: 'Concast Log F/PRD/04' },
  RMILL: { doc: 'F/PRD/05', label: 'Rolling Mill F/PRD/05' },
  WFURN: { doc: 'F/PRD/06', label: 'Wire Furnace F/PRD/06' },
  WDRAW: { doc: 'F/PRD/07', label: 'Wire Drawing F/PRD/07' },
  BBAR: { doc: 'F51 PR 39/005/01-13', label: 'Bright Bar Production Register' },
};
