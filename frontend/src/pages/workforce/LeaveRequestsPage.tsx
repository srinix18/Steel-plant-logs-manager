import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import {
  approveLeaveRequest,
  fetchLeaveRequests,
  rejectLeaveRequest,
} from '../../api/workforceOps';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

export function LeaveRequestsPage() {
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof fetchLeaveRequests>>>([]);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    const data = await fetchLeaveRequests(tab === 'all' ? undefined : tab);
    setRequests(data);
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, [tab]);

  const handleApprove = async (id: string) => {
    setActing(id);
    try {
      await approveLeaveRequest(id);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: string) => {
    setActing(id);
    try {
      await rejectLeaveRequest(id);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Leave Requests</h1>
        <p className="mt-1 text-sm text-slate-500">Review and approve employee leave applications.</p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
              tab === t ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <Card>
        <Table
          data={requests}
          emptyMessage="No leave requests."
          columns={[
            { key: 'employee', header: 'Employee', render: (r) => r.user_name ?? r.user_id },
            { key: 'type', header: 'Type', render: (r) => r.leave_type_name ?? '—' },
            { key: 'from', header: 'From', render: (r) => r.from_date },
            { key: 'to', header: 'To', render: (r) => r.to_date },
            {
              key: 'status',
              header: 'Status',
              render: (r) => (
                <Badge color={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'purple' : 'gray'}>
                  {r.status}
                </Badge>
              ),
            },
            { key: 'remarks', header: 'Remarks', render: (r) => r.remarks ?? '—' },
            {
              key: 'actions',
              header: '',
              render: (r) =>
                r.status === 'pending' ? (
                  <div className="flex gap-1">
                    <Button size="sm" disabled={acting === r.id} onClick={() => handleApprove(r.id)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="danger" disabled={acting === r.id} onClick={() => handleReject(r.id)}>
                      Reject
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      </Card>
    </div>
  );
}
