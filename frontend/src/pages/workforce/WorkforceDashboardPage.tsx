import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { fetchWorkforceSummary } from '../../api/workforce';
import { fetchWorkforceOpsSummary, formatCurrency } from '../../api/workforceOps';
import type { WorkforceDailySummary } from '../../types';
import { Badge } from '../../components/ui/Badge';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function WorkforceDashboardPage() {
  const [date, setDate] = useState(todayIso());
  const [summary, setSummary] = useState<WorkforceDailySummary | null>(null);
  const [opsSummary, setOpsSummary] = useState<Awaited<ReturnType<typeof fetchWorkforceOpsSummary>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetchWorkforceSummary(date),
      fetchWorkforceOpsSummary().catch(() => null),
    ])
      .then(([s, ops]) => {
        setSummary(s);
        setOpsSummary(ops);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [date]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workforce Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Plant-wide attendance visibility and daily summary.</p>
        </div>
        <label className="text-sm">
          <span className="text-slate-600">Date</span>
          <input
            type="date"
            className="ml-2 rounded-lg border border-slate-300 px-3 py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {opsSummary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Pending leave</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{opsSummary.pending_leave_requests}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Certs expiring soon</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{opsSummary.certifications_expiring_soon}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Latest payroll</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {opsSummary.latest_payroll_month && opsSummary.latest_payroll_year
                ? `${opsSummary.latest_payroll_month}/${opsSummary.latest_payroll_year}`
                : '—'}
            </p>
            <p className="text-xs text-slate-500">{opsSummary.latest_payroll_status ?? 'No runs'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Payroll net (latest)</p>
            <p className="mt-1 text-2xl font-bold text-brand-700">
              {opsSummary.total_payroll_net != null ? formatCurrency(opsSummary.total_payroll_net) : '—'}
            </p>
          </div>
        </div>
      )}

      {summary && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase text-slate-500">Employees present</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {summary.employees_present} / {summary.employees_expected}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase text-slate-500">Employees absent</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{summary.employees_absent}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase text-slate-500">Contract workers present (total)</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{summary.contract_workers_present}</p>
              {summary.contract_workers_absent > 0 && (
                <p className="mt-1 text-xs text-slate-500">{summary.contract_workers_absent} absent</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase text-slate-500">Shift notes</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {summary.shift_notes_submitted} submitted
                {summary.pending_shift_notes > 0 && (
                  <span className="ml-2 text-sm font-normal text-amber-600">
                    ({summary.pending_shift_notes} pending)
                  </span>
                )}
              </p>
            </div>
          </div>

          {summary.departments_understaffed.length > 0 && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="text-sm font-semibold text-amber-800">Departments understaffed</p>
              <ul className="mt-2 list-inside list-disc text-sm text-amber-900">
                {summary.departments_understaffed.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summary.departments.map((d) => (
                <div key={d.department_id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{d.department_name}</p>
                      <p className="text-xs text-slate-500">{d.department_code}</p>
                    </div>
                    {d.understaffed_by > 0 && <Badge color="purple">{`-${d.understaffed_by}`}</Badge>}
                  </div>
                  <p className="mt-3 text-lg font-bold text-brand-700">
                    Employees: {d.present} / {d.expected}
                  </p>
                  {(d.contract_workers_present > 0 || d.contract_workers_absent > 0) && (
                    <p className="mt-1 text-sm text-slate-600">
                      Contractors: {d.contract_workers_present} present
                      {d.contract_workers_absent > 0 ? `, ${d.contract_workers_absent} absent` : ''}
                    </p>
                  )}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
