/** Known log-sheet doc numbers (web SHEET_REPORTS) — used for report labels. */
export const DEDICATED_REPORT_DOC_NOS = new Set([
  'F/PRD/02',
  'F/PRD/03',
  'F/PRD/04',
  'F/PRD/05',
  'F/PRD/06',
  'F/PRD/07',
  'F51 PR 39/005/01-13',
  'F/PRD/08',
]);

export function reportSheetLabel(docNo: string | null | undefined): string {
  if (!docNo) return 'Log sheet report';
  const map: Record<string, string> = {
    'F/PRD/02': 'IAF heat log',
    'F/PRD/03': 'AOD ladle log',
    'F/PRD/04': 'CCM casting log',
    'F/PRD/05': 'Rolling mill log',
    'F/PRD/06': 'Wire furnace log',
    'F/PRD/07': 'Wire drawing log',
    'F51 PR 39/005/01-13': 'Bright bar production register',
    'F/PRD/08': 'Forge grinding register',
  };
  return map[docNo] ?? docNo;
}

export function formatReportDateTime(value: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export function formatReportDate(value: string): string {
  if (!value) return '—';
  if (value.length >= 10) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}
