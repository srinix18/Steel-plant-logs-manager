import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchActiveRuns, createProcessRun } from '../../api/processRuns';
import { fetchPlants, fetchProcessInstances, fetchProcesses, fetchShifts, fetchSteelGrades } from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import type { ProcessInstance, ProcessRun, Shift, SteelGrade } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export function ShiftDashboard() {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [activeRuns, setActiveRuns] = useState<ProcessRun[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [grades, setGrades] = useState<SteelGrade[]>([]);
  const [, setPlantId] = useState('');
  const [selectedInstance, setSelectedInstance] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetchPlants().then((plants) => {
      if (plants[0]) {
        setPlantId(plants[0].id);
        fetchShifts(plants[0].id).then(setShifts);
        fetchActiveRuns(plants[0].id).then(setActiveRuns).catch(() => {});
      }
    });
    fetchProcesses().then((procs) => {
      const eaf = procs.find((p) => p.code === 'EAF');
      if (eaf) fetchProcessInstances(eaf.id).then(setInstances);
    });
    fetchSteelGrades().then(setGrades);
  }, []);

  const handleStartHeat = async () => {
    if (!selectedInstance) return;
    setStarting(true);
    setError('');
    try {
      const run = await createProcessRun(selectedInstance, {
        run_type: 'heat',
        shift_id: selectedShift || undefined,
        grade_id: selectedGrade || undefined,
      });
      navigate(`/heat/${run.id}`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Shift Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500">SMS — Electric Arc Furnace Operations</p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Start New Heat</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">Furnace</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
              value={selectedInstance}
              onChange={(e) => setSelectedInstance(e.target.value)}
            >
              <option value="">Select furnace</option>
              {instances.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Shift</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
            >
              <option value="">Select shift</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Grade</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
            >
              <option value="">Select grade</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.code}</option>
              ))}
            </select>
          </div>
        </div>
        <Button className="mt-4 w-full py-3 text-base" onClick={handleStartHeat} disabled={!selectedInstance || starting}>
          {starting ? 'Starting...' : 'Start Heat'}
        </Button>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Active Heats</h2>
      <div className="space-y-3">
        {activeRuns.length === 0 && <p className="text-sm text-slate-500">No active heats on this plant.</p>}
        {activeRuns.map((run) => (
          <Link key={run.id} to={`/heat/${run.id}`}>
            <Card>
              <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold text-slate-900">{run.run_number}</p>
                <p className="text-sm text-slate-500">{run.run_type}</p>
              </div>
              <Badge color="blue">{run.current_state.replace(/_/g, ' ')}</Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
