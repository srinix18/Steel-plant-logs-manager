import { useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { fetchDepartments } from '../../api/platform';
import { fetchWorkforceEmployees, fetchWorkforceShifts } from '../../api/workforce';
import {
  createShiftRoster,
  fetchShiftRosters,
  publishShiftRoster,
  updateShiftRoster,
} from '../../api/workforceOps';
import { DesktopOnlyGate } from '../../components/layout/DesktopOnlyGate';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';

function weekStart(d = new Date()) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d);
  start.setDate(diff);
  return start.toISOString().slice(0, 10);
}

function weekDates(start: string): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  for (let i = 0; i < 7; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function weekEnd(start: string) {
  const dates = weekDates(start);
  return dates[dates.length - 1];
}

type GridCell = Record<string, Record<string, string>>;

export function ShiftPlanningPage() {
  const [error, setError] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [rosters, setRosters] = useState<Awaited<ReturnType<typeof fetchShiftRosters>>>([]);
  const [employees, setEmployees] = useState<Awaited<ReturnType<typeof fetchWorkforceEmployees>>>([]);
  const [shifts, setShifts] = useState<Awaited<ReturnType<typeof fetchWorkforceShifts>>>([]);
  const [periodStart, setPeriodStart] = useState(weekStart());
  const [saving, setSaving] = useState(false);
  const [editingRosterId, setEditingRosterId] = useState<string | null>(null);
  const [grid, setGrid] = useState<GridCell>({});

  const dates = useMemo(() => weekDates(periodStart), [periodStart]);

  useEffect(() => {
    fetchDepartments().then((d) => {
      setDepartments(d);
      if (d[0]) setDepartmentId(d[0].id);
    });
    fetchWorkforceShifts().then(setShifts);
  }, []);

  useEffect(() => {
    if (!departmentId) return;
    Promise.all([fetchShiftRosters(departmentId), fetchWorkforceEmployees(departmentId)])
      .then(([r, e]) => {
        setRosters(r);
        setEmployees(e);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [departmentId]);

  const startNewRoster = () => {
    setEditingRosterId(null);
    const empty: GridCell = {};
    for (const emp of employees) {
      empty[emp.id] = {};
      for (const dt of dates) {
        empty[emp.id][dt] = shifts[0]?.id ?? '';
      }
    }
    setGrid(empty);
  };

  const loadRosterToGrid = (rosterId: string) => {
    const roster = rosters.find((r) => r.id === rosterId);
    if (!roster) return;
    setEditingRosterId(rosterId);
    setPeriodStart(roster.period_start);
    const next: GridCell = {};
    for (const emp of employees) {
      next[emp.id] = {};
      for (const dt of weekDates(roster.period_start)) {
        next[emp.id][dt] = '';
      }
    }
    for (const entry of roster.entries) {
      if (!next[entry.user_id]) next[entry.user_id] = {};
      next[entry.user_id][entry.roster_date] = entry.shift_id;
    }
    setGrid(next);
  };

  const setCell = (userId: string, rosterDate: string, shiftId: string) => {
    setGrid((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [rosterDate]: shiftId },
    }));
  };

  const buildEntries = () => {
    const entries: { user_id: string; shift_id: string; roster_date: string }[] = [];
    for (const emp of employees) {
      for (const dt of dates) {
        const shiftId = grid[emp.id]?.[dt];
        if (shiftId) {
          entries.push({ user_id: emp.id, shift_id: shiftId, roster_date: dt });
        }
      }
    }
    return entries;
  };

  const saveRoster = async () => {
    if (!departmentId || shifts.length === 0) return;
    setSaving(true);
    setError('');
    try {
      const entries = buildEntries();
      const payload = {
        department_id: departmentId,
        period_start: periodStart,
        period_end: weekEnd(periodStart),
        period_type: 'weekly' as const,
        entries,
      };
      if (editingRosterId) {
        await updateShiftRoster(editingRosterId, {
          period_start: periodStart,
          period_end: weekEnd(periodStart),
          entries,
        });
      } else {
        const roster = await createShiftRoster(payload);
        setEditingRosterId(roster.id);
      }
      setRosters(await fetchShiftRosters(departmentId));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const publishRoster = async (rosterId: string) => {
    try {
      await publishShiftRoster(rosterId);
      setRosters(await fetchShiftRosters(departmentId));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const gridDates = editingRosterId
    ? weekDates(rosters.find((r) => r.id === editingRosterId)?.period_start ?? periodStart)
    : dates;

  return (
    <DesktopOnlyGate featureLabel="Shift Planning">
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shift Planning</h1>
          <p className="mt-1 text-sm text-slate-500">
            Build a weekly roster: pick shifts per employee per day, then save and publish.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-slate-600">Department</span>
            <select
              className="ml-2 rounded-lg border px-3 py-2"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Week start"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
          <Button variant="secondary" onClick={startNewRoster}>
            New roster
          </Button>
          <Button onClick={saveRoster} disabled={saving || employees.length === 0}>
            {saving ? 'Saving…' : 'Save roster'}
          </Button>
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {Object.keys(grid).length > 0 && (
        <Card className="mb-4 overflow-x-auto">
          <h2 className="mb-3 font-semibold">Weekly grid</h2>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-2 py-2 font-medium">Employee</th>
                {gridDates.map((dt) => (
                  <th key={dt} className="px-2 py-2 font-medium">
                    {new Date(dt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b">
                  <td className="px-2 py-2 font-medium">{emp.full_name}</td>
                  {gridDates.map((dt) => (
                    <td key={dt} className="px-2 py-2">
                      <select
                        className="w-full rounded border px-1 py-0.5 text-xs"
                        value={grid[emp.id]?.[dt] ?? ''}
                        onChange={(e) => setCell(emp.id, dt, e.target.value)}
                      >
                        <option value="">—</option>
                        {shifts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <Table
          data={rosters}
          emptyMessage="No rosters for this department. Click New roster to start."
          columns={[
            {
              key: 'period',
              header: 'Period',
              render: (r) => `${r.period_start} — ${r.period_end}`,
            },
            { key: 'type', header: 'Type', render: (r) => r.period_type },
            { key: 'status', header: 'Status', render: (r) => r.status },
            { key: 'entries', header: 'Entries', render: (r) => String(r.entries.length) },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => loadRosterToGrid(r.id)}>
                    Edit
                  </Button>
                  {r.status === 'draft' && (
                    <Button size="sm" variant="secondary" onClick={() => publishRoster(r.id)}>
                      Publish
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
    </DesktopOnlyGate>
  );
}
