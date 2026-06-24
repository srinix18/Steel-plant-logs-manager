import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { fetchDepartments, fetchPlants } from '../../api/platform';
import { createHandoverNote, fetchHandoverNotes, fetchWorkforceShifts } from '../../api/workforce';
import { useAuth } from '../../contexts/AuthContext';
import type { Shift, ShiftHandoverNote } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ShiftHandoverPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayIso());
  const [departmentId, setDepartmentId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<ShiftHandoverNote[]>([]);
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    fetchDepartments().then((d) => {
      setDepartments(d);
      setDepartmentId(user?.department_id ?? d[0]?.id ?? '');
    });
    fetchPlants().then((p) => {
      if (p[0]) fetchWorkforceShifts(p[0].id).then(setShifts);
    });
  }, [user?.department_id]);

  useEffect(() => {
    fetchHandoverNotes({ note_date: date, department_id: departmentId || undefined, shift_id: shiftId || undefined })
      .then(setNotes)
      .catch((e) => setError(getErrorMessage(e)));
  }, [date, departmentId, shiftId]);

  const submit = async () => {
    if (!departmentId || !shiftId || !note.trim()) return;
    try {
      setError('');
      await createHandoverNote({
        note_date: date,
        department_id: departmentId,
        shift_id: shiftId,
        note: note.trim(),
      });
      setNote('');
      setSaved('Handover note submitted.');
      const updated = await fetchHandoverNotes({
        note_date: date,
        department_id: departmentId,
        shift_id: shiftId,
      });
      setNotes(updated);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Shift Handover Notes</h1>
        <p className="mt-1 text-sm text-slate-500">Digitize shift-to-shift communication for the next crew.</p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {saved && <p className="mb-4 text-sm text-green-600">{saved}</p>}

      <Card>
        <div className="mb-4 flex flex-wrap gap-4">
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
        <label className="block text-sm">
          <span className="text-slate-600">Handover note</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Equipment status, pending jobs, safety items…"
          />
        </label>
        <div className="mt-4">
          <Button onClick={submit}>Submit note</Button>
        </div>
      </Card>

      <Card>
        <Table
          data={notes}
          emptyMessage="No handover notes for this filter."
          columns={[
            {
              key: 'when',
              header: 'When',
              render: (n) => `${n.note_date} · Shift ${n.shift_code ?? ''}`,
            },
            { key: 'dept', header: 'Department', render: (n) => n.department_code ?? '—' },
            { key: 'author', header: 'Author', render: (n) => n.author_name ?? '—' },
            { key: 'note', header: 'Note', render: (n) => n.note },
          ]}
        />
      </Card>
    </div>
  );
}
