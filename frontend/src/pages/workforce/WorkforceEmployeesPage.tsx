import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { fetchDepartments } from '../../api/platform';
import {
  createWorkforceEmployee,
  fetchWorkforceEmployees,
  updateWorkforceEmployee,
} from '../../api/workforce';
import { ImportWizard } from '../../components/import/ImportWizard';
import { EmployeeFormModal } from '../../components/workforce/EmployeeFormModal';
import { useAuth } from '../../contexts/AuthContext';
import type { User, WorkforceEmployeePayload, WorkforceEmployeeUpdatePayload } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { canRunImports } from '../../utils/roles';

export function WorkforceEmployeesPage() {
  const { user } = useAuth();
  const orgId = user?.organisation_id ?? '';
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const showBulkImport = user ? canRunImports(user.role) : false;

  const load = async () => {
    const [emps, depts] = await Promise.all([fetchWorkforceEmployees(), fetchDepartments()]);
    setEmployees(emps);
    setDepartments(depts);
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, []);

  const deptName = (id?: string | null) => departments.find((d) => d.id === id)?.name ?? '—';

  const handleSave = async (
    payload: WorkforceEmployeePayload | WorkforceEmployeeUpdatePayload,
    isEdit: boolean
  ) => {
    try {
      setError('');
      if (isEdit && editing) {
        await updateWorkforceEmployee(editing.id, payload as WorkforceEmployeeUpdatePayload);
      } else {
        await createWorkforceEmployee(payload as WorkforceEmployeePayload);
      }
      setShowModal(false);
      setEditing(null);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
      throw e;
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="mt-1 text-sm text-slate-500">Permanent employee master — linked to log sheet user pickers.</p>
        </div>
        <div className="flex gap-2">
          {showBulkImport && (
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              Bulk import
            </Button>
          )}
          <Button
            onClick={() => {
              setEditing(null);
              setShowModal(true);
            }}
          >
            Add employee
          </Button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card>
        <Table
          data={employees}
          emptyMessage="No employees yet."
          columns={[
            { key: 'uid', header: 'ID', render: (u) => u.employee_uid ?? '—' },
            { key: 'name', header: 'Name', render: (u) => u.full_name },
            { key: 'dept', header: 'Department', render: (u) => deptName(u.department_id) },
            { key: 'designation', header: 'Designation', render: (u) => u.designation ?? '—' },
            {
              key: 'status',
              header: 'Status',
              render: (u) => (u.employment_status ?? 'active').replace(/_/g, ' '),
            },
            {
              key: 'actions',
              header: '',
              render: (u) => (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(u);
                    setShowModal(true);
                  }}
                >
                  Edit
                </Button>
              ),
            },
          ]}
        />
      </Card>

      {showModal && orgId && (
        <EmployeeFormModal
          editing={editing}
          orgId={orgId}
          onCancel={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}

      {showImport && (
        <ImportWizard
          moduleKey="employees"
          title="Bulk import employees"
          onClose={() => setShowImport(false)}
          onComplete={() => load().catch((e) => setError(getErrorMessage(e)))}
        />
      )}
    </div>
  );
}
