import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchActiveRuns, createProcessRun } from '../../api/processRuns';
import { fetchPlants, fetchProcessInstances, fetchProcesses, fetchShifts, fetchSteelGrades } from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import type { Process, ProcessInstance, ProcessRun, Shift, SteelGrade } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

const PROCESS_OPTIONS = [
  { code: 'EAF', label: 'EAF — Electric Arc Furnace', instanceLabel: 'Furnace', runType: 'heat' as const },
  { code: 'AOD', label: 'AOD — Argon Oxygen Decarburization', instanceLabel: 'AOD Vessel', runType: 'ladle_metallurgy' as const },
  { code: 'CCM', label: 'CCM — Continuous Casting', instanceLabel: 'Caster Line', runType: 'cast' as const },
];

export function ShiftDashboard() {
  const navigate = useNavigate();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [processCode, setProcessCode] = useState('EAF');
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [activeRuns, setActiveRuns] = useState<ProcessRun[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [grades, setGrades] = useState<SteelGrade[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  const processMeta = PROCESS_OPTIONS.find((p) => p.code === processCode) ?? PROCESS_OPTIONS[0];

  useEffect(() => {
    fetchPlants().then((plants) => {
      if (plants[0]) {
        fetchShifts(plants[0].id).then(setShifts);
        fetchActiveRuns(plants[0].id).then(setActiveRuns).catch(() => {});
      }
    });
    fetchProcesses().then(setProcesses);
    fetchSteelGrades().then(setGrades);
  }, []);

  useEffect(() => {
    const proc = processes.find((p) => p.code === processCode);
    setSelectedInstance('');
    if (proc) {
      fetchProcessInstances(proc.id).then(setInstances);
    } else {
      setInstances([]);
    }
  }, [processCode, processes]);

  const isConcast = processCode === 'CCM';

  const handleStartRun = async () => {
    if (!selectedInstance) return;
    setStarting(true);
    setError('');
    try {
      const run = await createProcessRun(selectedInstance, {
        run_type: processMeta.runType,
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
      <p className="mb-6 text-sm text-slate-500">SMS — Start a heat, AOD run, or Concast shift log</p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Start New Run</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Process</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
              value={processCode}
              onChange={(e) => setProcessCode(e.target.value)}
            >
              {PROCESS_OPTIONS.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">{processMeta.instanceLabel}</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
              value={selectedInstance}
              onChange={(e) => setSelectedInstance(e.target.value)}
            >
              <option value="">Select {processMeta.instanceLabel.toLowerCase()}</option>
              {instances.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
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
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {!isConcast && (
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Grade</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
              >
                <option value="">Select grade</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <Button className="mt-4 w-full py-3 text-base" onClick={handleStartRun} disabled={!selectedInstance || starting}>
          {starting
            ? 'Starting...'
            : isConcast
              ? 'Start Shift Log'
              : processCode === 'AOD'
                ? 'Start AOD Run'
                : 'Start Heat'}
        </Button>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Active Runs</h2>
      <div className="space-y-3">
        {activeRuns.length === 0 && <p className="text-sm text-slate-500">No active runs on this plant.</p>}
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
