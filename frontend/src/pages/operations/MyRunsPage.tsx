import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyRuns } from '../../api/processRuns';
import { getErrorMessage } from '../../api/client';
import type { ProcessRun } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

const EDITABLE_STATES = new Set(['created', 'in_progress', 'waiting_for_sample', 'refining', 'ready_to_tap']);

export function MyRunsPage() {
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyRuns()
      .then(setRuns)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">My Runs</h1>
      <p className="mb-6 text-sm text-slate-500">Heats and logs you started. Open the workspace to continue editing.</p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card title="Runs you started">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <Table
            data={runs}
            emptyMessage="You have not started any runs yet. Use Shift Dashboard to start a heat."
            columns={[
              {
                key: 'run',
                header: 'Run',
                render: (r) => <span className="font-medium">{r.run_number}</span>,
              },
              {
                key: 'state',
                header: 'State',
                render: (r) => <Badge color="blue">{r.current_state.replace(/_/g, ' ')}</Badge>,
              },
              {
                key: 'started',
                header: 'Started',
                render: (r) => new Date(r.created_at).toLocaleString(),
              },
              {
                key: 'actions',
                header: '',
                render: (r) => (
                  <div className="flex gap-3 text-sm">
                    {EDITABLE_STATES.has(r.current_state) && (
                      <Link
                        to={`/heat/${r.id}`}
                        className="inline-flex min-h-[44px] items-center text-brand-600 hover:underline"
                      >
                        Edit
                      </Link>
                    )}
                    <Link
                      to={`/reports/${r.id}`}
                      className="inline-flex min-h-[44px] items-center text-slate-600 hover:text-brand-600"
                    >
                      Report
                    </Link>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
