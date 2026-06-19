import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTemplates } from '../../api/templates';
import { getErrorMessage } from '../../api/client';
import type { Template } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export function MemberDashboard() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTemplates().then(setTemplates).catch((e) => setError(getErrorMessage(e)));
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Member Dashboard</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <Card title="Available Templates">
        {templates.length === 0 ? (
          <p className="text-sm text-slate-500">No templates assigned to your department.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-slate-900">{t.name}</p>
                  <p className="text-sm text-slate-500">{t.description || 'No description'}</p>
                </div>
                {t.allow_member_create && (
                  <Link to={`/records/new?template=${t.id}`}>
                    <Button size="sm">New Entry</Button>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
