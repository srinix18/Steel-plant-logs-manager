import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { fetchWorkforceMe } from '../../api/workforce';
import type { WorkforceMeResponse } from '../../types';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

export function MyAttendancePage() {
  const [data, setData] = useState<WorkforceMeResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWorkforceMe()
      .then(setData)
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Attendance</h1>
        <p className="mt-1 text-sm text-slate-500">Your shift assignment and attendance history.</p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {data?.shift_assignment && (
        <Card>
          <p className="text-xs font-medium uppercase text-slate-500">Current shift assignment</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {data.shift_assignment.department_code} — Shift {data.shift_assignment.shift_code}
          </p>
          <p className="text-sm text-slate-500">Effective from {data.shift_assignment.effective_date}</p>
        </Card>
      )}

      <Card>
        <Table
          data={(data?.recent_attendance ?? []).map((r, i) => ({
            ...r,
            id: r.id ?? `${r.attendance_date}-${r.user_id}-${i}`,
          }))}
          emptyMessage="No attendance records yet."
          columns={[
            { key: 'date', header: 'Date', render: (r) => r.attendance_date },
            { key: 'status', header: 'Status', render: (r) => r.status.replace(/_/g, ' ') },
            { key: 'remarks', header: 'Remarks', render: (r) => r.remarks ?? '—' },
          ]}
        />
      </Card>
    </div>
  );
}
