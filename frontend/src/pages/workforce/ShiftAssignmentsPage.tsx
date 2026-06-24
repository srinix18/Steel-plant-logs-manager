import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { fetchDepartments, fetchPlants } from '../../api/platform';
import {
  createShiftAssignment,
  fetchShiftAssignments,
  fetchWorkforceEmployees,
  fetchWorkforceShifts,
} from '../../api/workforce';
import type { Shift, ShiftAssignment, User } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

export function ShiftAssignmentsPage() {
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    user_id: '',
    department_id: '',
    shift_id: '',
    effective_date: new Date().toISOString().slice(0, 10),
  });

  const load = async () => {
    const [a, e, d, plants] = await Promise.all([
      fetchShiftAssignments(),
      fetchWorkforceEmployees(),
      fetchDepartments(),
      fetchPlants(),
    ]);
    setAssignments(a);
    setEmployees(e);
    setDepartments(d);
    if (plants[0]) {
      const s = await fetchWorkforceShifts(plants[0].id);
      setShifts(s);
    }
  };

  useEffect(() => {
    load().catch((err) => setError(getErrorMessage(err)));
  }, []);

  const save = async () => {
    try {
      setError('');
      await createShiftAssignment(form);
      setShowModal(false);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shift Assignments</h1>
          <p className="mt-1 text-sm text-slate-500">Assign employees to department shifts.</p>
        </div>
        <Button onClick={() => setShowModal(true)}>Add assignment</Button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card>
        <Table
          data={assignments}
          emptyMessage="No shift assignments yet."
          columns={[
            { key: 'employee', header: 'Employee', render: (a) => a.user_name ?? '—' },
            { key: 'uid', header: 'ID', render: (a) => a.employee_uid ?? '—' },
            { key: 'dept', header: 'Department', render: (a) => a.department_code ?? '—' },
            { key: 'shift', header: 'Shift', render: (a) => a.shift_code ?? '—' },
            { key: 'date', header: 'Effective', render: (a) => a.effective_date },
          ]}
        />
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New shift assignment</h2>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-slate-600">Employee</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.user_id}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                >
                  <option value="">Select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_uid ?? emp.email})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Department</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Shift</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.shift_id}
                  onChange={(e) => setForm({ ...form, shift_id: e.target.value })}
                >
                  <option value="">Select shift</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>Shift {s.code} — {s.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Effective date</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.effective_date}
                  onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
