import { useEffect, useState } from 'react';
import { fetchOrganisations, fetchUsers } from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import type { Organisation, User } from '../../types';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchUsers(), fetchOrganisations()])
      .then(([u, o]) => {
        setUsers(u);
        setOrganisations(o);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const orgName = (id?: string | null) => organisations.find((o) => o.id === id)?.name ?? '—';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">Platform users and their roles across organisations.</p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card>
        <Table
          data={users}
          emptyMessage="No users found."
          columns={[
            { key: 'name', header: 'Name', render: (u) => u.full_name },
            { key: 'email', header: 'Email', render: (u) => u.email },
            {
              key: 'role',
              header: 'Role',
              render: (u) => <span className="capitalize">{u.role.replace(/_/g, ' ')}</span>,
            },
            { key: 'org', header: 'Organisation', render: (u) => orgName(u.organisation_id) },
          ]}
        />
      </Card>
    </div>
  );
}
