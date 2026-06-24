import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchActiveRuns, createProcessRun } from '../../api/processRuns';
import { fetchPlants, fetchProcessInstances, fetchProcesses, fetchShifts, fetchSteelGrades } from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import { fetchPreviousHandover } from '../../api/workforce';
import { useAuth } from '../../contexts/AuthContext';
import type { Process, ProcessInstance, ProcessRun, Shift, ShiftHandoverNote, SteelGrade } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

const PROCESS_OPTIONS = [
  { code: 'IAF', label: 'IAF — Induction Furnace', instanceLabel: 'Furnace', runType: 'heat' as const },
  { code: 'AOD', label: 'AOD — Argon Oxygen Decarburization', instanceLabel: 'AOD Vessel', runType: 'ladle_metallurgy' as const },
  { code: 'CCM', label: 'CCM — Continuous Casting', instanceLabel: 'Caster Line', runType: 'cast' as const },
  { code: 'RMILL', label: 'Rolling Mill Production', instanceLabel: 'Mill Line', runType: 'shift' as const },
  { code: 'WFURN', label: 'Wire Furnace Production', instanceLabel: 'Annealing Furnace', runType: 'shift' as const },
  { code: 'WDRAW', label: 'Wire Drawing Production', instanceLabel: 'Drawing Machine', runType: 'shift' as const },
  {
    code: 'BBAR',
    label: 'Bright Bar Production Register',
    instanceLabel: 'Production Line',
    runType: 'daily' as const,
  },
  {
    code: 'GRIND',
    label: 'Forge Shop — Grinding Material Details',
    instanceLabel: 'Work Centre',
    runType: 'daily' as const,
  },
];

export function ShiftDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [processCode, setProcessCode] = useState('');
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [activeRuns, setActiveRuns] = useState<ProcessRun[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [grades, setGrades] = useState<SteelGrade[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [previousHandover, setPreviousHandover] = useState<ShiftHandoverNote | null>(null);

  const allowedProcessOptions = useMemo(() => {
    if (!processes.length) return [];
    const allowedCodes = new Set(processes.map((p) => p.code));
    return PROCESS_OPTIONS.filter((p) => allowedCodes.has(p.code));
  }, [processes]);

  const processMeta = allowedProcessOptions.find((p) => p.code === processCode) ?? allowedProcessOptions[0];

  useEffect(() => {
    if (!allowedProcessOptions.length) return;
    if (!allowedProcessOptions.some((p) => p.code === processCode)) {
      setProcessCode(allowedProcessOptions[0].code);
    }
  }, [allowedProcessOptions, processCode]);

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

  useEffect(() => {
    if (!user?.department_id || !selectedShift) {
      setPreviousHandover(null);
      return;
    }
    fetchPreviousHandover(user.department_id, selectedShift)
      .then(setPreviousHandover)
      .catch(() => setPreviousHandover(null));
  }, [user?.department_id, selectedShift]);

  const isConcast = processCode === 'CCM';
  const isDaily = processMeta?.runType === 'daily';

  const handleStartRun = async () => {
    if (!selectedInstance || !processMeta) return;
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
      
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {previousHandover && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-amber-900">
            Previous shift handover (Shift {previousHandover.shift_code}, {previousHandover.note_date})
          </p>
          <p className="mt-2 text-sm text-amber-950">{previousHandover.note}</p>
          {previousHandover.author_name && (
            <p className="mt-2 text-xs text-amber-800">— {previousHandover.author_name}</p>
          )}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Start New Run</h2>
        {!allowedProcessOptions.length ? (
          <p className="text-sm text-slate-500">No processes available for your department.</p>
        ) : (
        <>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Process</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
              value={processCode}
              onChange={(e) => setProcessCode(e.target.value)}
            >
              {allowedProcessOptions.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">{processMeta?.instanceLabel}</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
              value={selectedInstance}
              onChange={(e) => setSelectedInstance(e.target.value)}
            >
              <option value="">Select {processMeta?.instanceLabel.toLowerCase()}</option>
              {instances.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          {!isDaily && (
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
          )}
          {!isConcast && !isDaily && (
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
        <Button
          className="mt-4 w-full py-3 text-base"
          onClick={handleStartRun}
          disabled={!selectedInstance || starting || !processMeta}
        >
          {starting
            ? 'Starting...'
            : isDaily
              ? 'Start Daily Register'
              : isConcast
                ? 'Start Shift Log'
                : processCode === 'AOD'
                  ? 'Start AOD Run'
                  : processMeta?.runType === 'shift'
                    ? 'Start Shift Report'
                    : 'Start Heat'}
        </Button>
        </>
        )}
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
