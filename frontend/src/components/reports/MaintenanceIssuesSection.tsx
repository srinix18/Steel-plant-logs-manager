import { useEffect, useState } from 'react';
import { fetchRunMaintenanceIssues, type MaintenanceIssue } from '../../api/maintenance';
import { getErrorMessage } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';

interface Props {
  runId: string;
}

export function MaintenanceIssuesSection({ runId }: Props) {
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRunMaintenanceIssues(runId)
      .then(setIssues)
      .catch((e) => setError(getErrorMessage(e)));
  }, [runId]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 print:break-inside-avoid">
    <Card title="Maintenance issues">
      <Table
        data={issues}
        emptyMessage="No maintenance issues for this run."
        columns={[
          { key: 'title', header: 'Title', render: (i) => i.title },
          {
            key: 'category',
            header: 'Category',
            render: (i) => <span className="capitalize">{i.category}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (i) => <Badge color={i.status === 'closed' ? 'green' : 'blue'}>{i.status.replace(/_/g, ' ')}</Badge>,
          },
          {
            key: 'raised',
            header: 'Raised by',
            render: (i) => i.raised_by_user?.full_name ?? '—',
          },
          {
            key: 'closed',
            header: 'Closed by',
            render: (i) =>
              i.closed_by_user
                ? `${i.closed_by_user.full_name}${i.closed_at ? ` (${new Date(i.closed_at).toLocaleDateString()})` : ''}`
                : '—',
          },
        ]}
      />
    </Card>
    </div>
  );
}
