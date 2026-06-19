import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRecords, deleteRecord } from '../../api/records';
import { fetchTemplates } from '../../api/templates';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { Record as LogRecord, Template } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';

export function RecordListPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<LogRecord[]>([]);
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [recs, tmpls] = await Promise.all([fetchRecords(), fetchTemplates()]);
      setRecords(recs);
      setTemplates(Object.fromEntries(tmpls.map((t) => [t.id, t])));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this record?')) return;
    try {
      await deleteRecord(id);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Records</h1>
        <Link to="/records/new"><Button>New Entry</Button></Link>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <Card>
        <Table
          data={records}
          columns={[
            {
              key: 'template',
              header: 'Template',
              render: (r) => templates[r.template_id]?.name || r.template_id.slice(0, 8),
            },
            {
              key: 'preview',
              header: 'Preview',
              render: (r) =>
                r.values
                  .slice(0, 2)
                  .map((v) => `${v.field_name}: ${String(v.value)}`)
                  .join(' · ') || '—',
            },
            { key: 'status', header: 'Status', render: (r) => <Badge color="blue">{r.status}</Badge> },
            { key: 'date', header: 'Created', render: (r) => new Date(r.created_at).toLocaleString() },
            {
              key: 'actions',
              header: 'Actions',
              render: (r) =>
                user?.role !== 'member' ? (
                  <Button size="sm" variant="danger" onClick={() => handleDelete(r.id)}>Delete</Button>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
