import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { fetchDepartments, fetchPlants } from '../../api/platform';
import {
  fetchAttendance,
  fetchContractorAttendance,
  fetchContractors,
  fetchWorkforceShifts,
  saveAttendanceBulk,
  saveContractorAttendance,
} from '../../api/workforce';
import { useAuth } from '../../contexts/AuthContext';
import type { AttendanceRecord, AttendanceStatus, Contractor, Shift } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'leave', 'half_day'];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceEntryPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayIso());
  const [departmentId, setDepartmentId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [contractorId, setContractorId] = useState('');
  const [workersPresent, setWorkersPresent] = useState(0);
  const [workersAbsent, setWorkersAbsent] = useState(0);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    fetchDepartments().then((d) => {
      setDepartments(d);
      const defaultDept = user?.department_id ?? d[0]?.id ?? '';
      setDepartmentId(defaultDept);
    });
    fetchPlants().then((p) => {
      if (p[0]) fetchWorkforceShifts(p[0].id).then(setShifts);
    });
  }, [user?.department_id]);

  useEffect(() => {
    if (!departmentId) {
      setContractors([]);
      setContractorId('');
      return;
    }
    fetchContractors(departmentId)
      .then((c) => {
        setContractors(c);
        setContractorId(c[0]?.id ?? '');
        setWorkersPresent(0);
        setWorkersAbsent(0);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [departmentId]);

  useEffect(() => {
    if (!departmentId || !shiftId) return;
    fetchAttendance(date, departmentId, shiftId)
      .then(setRecords)
      .catch((e) => setError(getErrorMessage(e)));
    fetchContractorAttendance(date, departmentId, shiftId)
      .then((rows) => {
        const row = contractorId ? rows.find((r) => r.contractor_id === contractorId) : rows[0];
        if (row) {
          if (!contractorId) setContractorId(row.contractor_id);
          setWorkersPresent(row.workers_present);
          setWorkersAbsent(row.workers_absent);
        } else {
          setWorkersPresent(0);
          setWorkersAbsent(0);
        }
      })
      .catch(() => {});
  }, [date, departmentId, shiftId, contractorId]);

  const setStatus = (userId: string, status: AttendanceStatus) => {
    setRecords((prev) => prev.map((r) => (r.user_id === userId ? { ...r, status } : r)));
  };

  const saveEmployeeAttendance = async () => {
    try {
      setError('');
      setSaved('');
      await saveAttendanceBulk({
        attendance_date: date,
        department_id: departmentId,
        shift_id: shiftId,
        entries: records.map((r) => ({
          user_id: r.user_id,
          status: r.status,
          remarks: r.remarks ?? undefined,
        })),
      });
      setSaved('Employee attendance saved.');
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const saveContractor = async () => {
    if (!contractorId) return;
    try {
      setError('');
      await saveContractorAttendance({
        attendance_date: date,
        contractor_id: contractorId,
        department_id: departmentId,
        shift_id: shiftId,
        workers_present: workersPresent,
        workers_absent: workersAbsent,
      });
      setSaved('Contractor attendance saved.');
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const dept = departments.find((d) => d.id === departmentId);
  const shift = shifts.find((s) => s.id === shiftId);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
        <p className="mt-1 text-sm text-slate-500">Mark daily employee and contractor attendance.</p>
      </div>

      <div className="mb-6">
        <Card>
        <div className="flex flex-wrap gap-4">
          <label className="text-sm">
            <span className="text-slate-600">Date</span>
            <input
              type="date"
              className="ml-2 rounded-lg border border-slate-300 px-3 py-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Department</span>
            <select
              className="ml-2 rounded-lg border border-slate-300 px-3 py-2"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Shift</span>
            <select
              className="ml-2 rounded-lg border border-slate-300 px-3 py-2"
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
            >
              <option value="">Select</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>Shift {s.code}</option>
              ))}
            </select>
          </label>
        </div>
        </Card>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {saved && <p className="mb-4 text-sm text-green-600">{saved}</p>}

      {departmentId && shiftId && (
        <>
          <Card>
            <h2 className="mb-3 font-semibold text-slate-900">
              {dept?.name} — Shift {shift?.code}
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2">Employee</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.user_id} className="border-b border-slate-100">
                    <td className="py-2">{r.user_name}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        {STATUSES.map((s) => (
                          <label key={s} className="inline-flex items-center gap-1 capitalize">
                            <input
                              type="radio"
                              name={`status-${r.user_id}`}
                              checked={r.status === s}
                              onChange={() => setStatus(r.user_id, s)}
                            />
                            {s.replace(/_/g, ' ')}
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {records.length === 0 && (
              <p className="text-sm text-slate-500">No employees assigned to this shift.</p>
            )}
            <div className="mt-4">
              <Button onClick={saveEmployeeAttendance}>Save employee attendance</Button>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-slate-900">Contractor attendance</h2>
            {contractors.length === 0 ? (
              <p className="text-sm text-slate-500">
                No contractors linked to this department. Add contract workers under Workforce → Contractors.
              </p>
            ) : (
            <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-slate-600">Contractor</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={contractorId}
                  onChange={(e) => setContractorId(e.target.value)}
                >
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <Input
                label="Workers present"
                type="number"
                min={0}
                value={String(workersPresent)}
                onChange={(e) => setWorkersPresent(Number(e.target.value))}
              />
              <Input
                label="Workers absent"
                type="number"
                min={0}
                value={String(workersAbsent)}
                onChange={(e) => setWorkersAbsent(Number(e.target.value))}
              />
            </div>
            <div className="mt-4">
              <Button variant="secondary" onClick={saveContractor}>Save contractor attendance</Button>
            </div>
            </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
