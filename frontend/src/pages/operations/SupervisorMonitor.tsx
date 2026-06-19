import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchActiveRuns } from '../../api/processRuns';
import { fetchObservations, fetchOpenActions } from '../../api/operations';
import { fetchPlants } from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import type { CorrectiveAction, Observation, ProcessRun } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export function SupervisorMonitor() {
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlants().then((plants) => {
      if (!plants[0]) return;
      const pid = plants[0].id;
      fetchActiveRuns(pid).then(setRuns).catch((e) => setError(getErrorMessage(e)));
      fetchObservations(pid).then(setObservations).catch(() => {});
      fetchOpenActions(pid).then(setActions).catch(() => {});
    });
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Operations Monitor</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Active Heats">
          <div className="space-y-2">
            {runs.map((r) => (
              <Link key={r.id} to={`/heat/${r.id}`} className="block rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                <div className="flex justify-between">
                  <span className="font-medium">{r.run_number}</span>
                  <Badge color="blue">{r.current_state}</Badge>
                </div>
              </Link>
            ))}
            {runs.length === 0 && <p className="text-sm text-slate-500">No active heats.</p>}
          </div>
        </Card>

        <Card title="Observations">
          <div className="space-y-2">
            {observations.slice(0, 5).map((o) => (
              <div key={o.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <Badge color={o.severity === 'critical' ? 'purple' : 'gray'}>{o.severity}</Badge>
                <p className="mt-1 text-slate-700">{o.description}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Open Corrective Actions">
          <div className="space-y-2">
            {actions.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <p className="font-medium">{a.title}</p>
                <Badge color="purple">{a.status}</Badge>
              </div>
            ))}
            {actions.length === 0 && <p className="text-sm text-slate-500">No open actions.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
