import type { TemplateSummary, TemplateVersionSummary } from '../../types';
import { formatDocDate } from './reportFieldUtils';

interface ReportDocHeaderProps {
  companyLine?: string;
  divisionLine?: string;
  sheetTitle: string;
  templateMeta: TemplateSummary | null;
  versionMeta: TemplateVersionSummary | null;
}

export function ReportDocHeader({
  companyLine = 'CHANDAN STEEL LTD.',
  divisionLine = '( SMS DIVISION )',
  sheetTitle,
  templateMeta,
  versionMeta,
}: ReportDocHeaderProps) {
  return (
    <table className="report-table-compact report-no-print-break mb-1 w-full text-[8px]">
      <tbody>
        <tr>
          <td className="w-[72%] align-top border-black p-1">
            <p className="whitespace-nowrap text-[10px] font-bold leading-tight">{companyLine}</p>
            <p className="whitespace-nowrap text-[9px] font-semibold leading-tight">{divisionLine}</p>
            <p className="mt-1 whitespace-nowrap text-[11px] font-bold uppercase">{sheetTitle}</p>
          </td>
          <td className="w-[28%] align-top border-black p-0">
            <table className="report-table-compact w-full border-0">
              <tbody>
                <tr>
                  <td className="bg-neutral-100 font-semibold whitespace-nowrap">Doc. No.</td>
                  <td className="text-center">{templateMeta?.doc_no ?? '—'}</td>
                </tr>
                <tr>
                  <td className="bg-neutral-100 font-semibold whitespace-nowrap">Rev. No.</td>
                  <td className="text-center">{versionMeta?.rev_no ?? '—'}</td>
                </tr>
                <tr>
                  <td className="bg-neutral-100 font-semibold whitespace-nowrap">Date</td>
                  <td className="text-center">{formatDocDate(versionMeta)}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
