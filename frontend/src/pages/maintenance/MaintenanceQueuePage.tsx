import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  assignMaintenanceIssue,
  closeMaintenanceIssue,
  fetchMyMaintenanceIssues,
  type MaintenanceIssue,
  type MaintenanceIssueStatus,
} from '../../api/maintenance';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const STATUS_TABS: { key: MaintenanceIssueStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

const categoryLabel = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

export function MaintenanceQueuePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [tab, setTab] = useState<MaintenanceIssueStatus | 'all'>('open');
  const [error, setError] = useState('');
  const [closeId, setCloseId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await fetchMyMaintenanceIssues();
    setIssues(data);
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'all') return issues;
    return issues.filter((i) => i.status === tab);
  }, [issues, tab]);

  const highlightId = searchParams.get('issue');

  const handleAssign = async (id: string) => {
    try {
      setError('');
      await assignMaintenanceIssue(id);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const handleClose = async () => {
    if (!closeId || !resolutionNotes.trim()) return;
    setSaving(true);
    try {
      setError('');
      await closeMaintenanceIssue(closeId, resolutionNotes.trim());
      setCloseId(null);
      setResolutionNotes('');
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Maintenance Queue</h1>
        <p className="mt-1 text-sm text-slate-500">
          Issues routed to the {user?.maintenance_division ?? 'your'} category crew.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <Button key={t.key} variant={tab === t.key ? 'primary' : 'secondary'} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((issue) => (
          <Card key={issue.id}>
            <div className={`${highlightId === issue.id ? 'ring-2 ring-brand-500 rounded-lg p-1' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{issue.title}</h3>
                  <Badge color="gray">{categoryLabel(issue.category)}</Badge>
                  <Badge color={issue.status === 'closed' ? 'green' : 'blue'}>{issue.status.replace(/_/g, ' ')}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">{issue.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Raised by {issue.raised_by_user?.full_name ?? '—'} · {new Date(issue.raised_at).toLocaleString()}
                  {issue.run_id && (
                    <>
                      {' '}
                      ·{' '}
                      <Link to={`/reports/${issue.run_id}`} className="text-brand-600 hover:underline">
                        View run
                      </Link>
                    </>
                  )}
                </p>
                {issue.status === 'closed' && issue.closed_by_user && (
                  <p className="mt-2 text-xs text-slate-600">
                    Closed by <strong>{issue.closed_by_user.full_name}</strong>
                    {issue.closed_at && ` on ${new Date(issue.closed_at).toLocaleString()}`}
                    {issue.resolution_notes && (
                      <span className="mt-1 block text-slate-500">Resolution: {issue.resolution_notes}</span>
                    )}
                  </p>
                )}
                {issue.status === 'in_progress' && issue.assigned_to_user && (
                  <p className="mt-1 text-xs text-slate-500">Assigned to {issue.assigned_to_user.full_name}</p>
                )}
              </div>
              <div className="flex gap-2">
                {issue.status === 'open' && (
                  <Button onClick={() => handleAssign(issue.id)}>Take issue</Button>
                )}
                {issue.status === 'in_progress' && (
                  <Button onClick={() => setCloseId(issue.id)}>Mark completed</Button>
                )}
              </div>
            </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card>
            <p className="text-sm text-slate-500">No issues in this queue.</p>
          </Card>
        )}
      </div>

      {closeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Complete issue</h2>
            <label className="block text-sm">
              <span className="text-slate-600">Resolution notes</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                rows={4}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCloseId(null)}>
                Cancel
              </Button>
              <Button onClick={handleClose} disabled={saving || !resolutionNotes.trim()}>
                {saving ? 'Saving…' : 'Mark completed'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
