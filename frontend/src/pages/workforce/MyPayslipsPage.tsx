import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import {
  fetchMyPayslips,
  fetchPayslipHtml,
  formatCurrency,
  formatPayrollMonth,
} from '../../api/workforceOps';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

export function MyPayslipsPage() {
  const [error, setError] = useState('');
  const [payslips, setPayslips] = useState<Awaited<ReturnType<typeof fetchMyPayslips>>>([]);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchMyPayslips()
      .then(setPayslips)
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const viewPayslip = async (lineItemId: string) => {
    try {
      const { html } = await fetchPayslipHtml(lineItemId);
      setHtmlPreview(html);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Payslips</h1>
        <p className="mt-1 text-sm text-slate-500">View and download your payslip history.</p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card>
        <p className="mb-4 text-sm text-slate-600">
          Payslips appear here after HR processes a monthly payroll run and you have a salary structure
          on file.
        </p>
        <Table
          data={payslips}
          emptyMessage="No payslips available yet."
          columns={[
            {
              key: 'period',
              header: 'Period',
              render: (p) => {
                const month = Number(p.payslip_data?.month ?? 0);
                const year = Number(p.payslip_data?.year ?? 0);
                return month && year ? formatPayrollMonth(month, year) : '—';
              },
            },
            { key: 'days', header: 'Payable days', render: (p) => String(p.payable_days) },
            { key: 'gross', header: 'Gross', render: (p) => formatCurrency(p.gross_salary) },
            { key: 'net', header: 'Net', render: (p) => formatCurrency(p.net_salary) },
            {
              key: 'actions',
              header: '',
              render: (p) => (
                <Button size="sm" variant="secondary" onClick={() => viewPayslip(p.id)}>
                  View
                </Button>
              ),
            },
          ]}
        />
      </Card>

      {htmlPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <div className="mb-4 flex justify-between">
              <h2 className="text-lg font-semibold">Payslip</h2>
              <Button variant="secondary" onClick={() => setHtmlPreview(null)}>Close</Button>
            </div>
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: htmlPreview }} />
          </Card>
        </div>
      )}
    </div>
  );
}
