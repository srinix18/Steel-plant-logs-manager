import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { fetchDepartmentPulse, type DepartmentPulse } from '../../api/pulse';
import { fetchDepartments } from '../../api/platform';
import { OeeBreakdown, OeeTrendChart } from '../../components/pulse/OeeTrendChart';
import { PulseMetricCard } from '../../components/pulse/PulseMetricCard';
import { StatusBadge } from '../../components/pulse/StatusBadge';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { fetchOee } from '../../api/oee';

function DeptSpecificCards({ pulse }: { pulse: DepartmentPulse }) {
  const code = pulse.department_code.toUpperCase();
  const m = pulse.metrics;

  if (code === 'IAF' || code === 'SMS') {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <PulseMetricCard label="Current Heat" value={(m.current_heat as string) ?? pulse.current_run_label ?? '—'} />
        <PulseMetricCard label="Today's Heats" value={pulse.production?.toFixed(0) ?? '—'} unit="t" />
        <PulseMetricCard label="Current Operators" value="—" />
      </div>
    );
  }
  if (code === 'ROLLING') {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <PulseMetricCard label="Current Mill" value={(m.current_mill as string) ?? pulse.current_run_label ?? '—'} />
        <PulseMetricCard label="Current Speed" value="12.5" unit="m/min" />
        <PulseMetricCard label="Current Product" value="—" />
      </div>
    );
  }
  if (code === 'WIRE') {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <PulseMetricCard label="Drawing Speed" value="180" unit="m/min" />
        <PulseMetricCard label="Current Coil" value={pulse.current_run_label ?? '—'} />
        <PulseMetricCard label="Output" value={pulse.production?.toFixed(1) ?? '—'} unit="t" />
      </div>
    );
  }
  return null;
}

export function DepartmentPulsePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [departments, setDepartments] = useState<{ id: string; code: string; name: string }[]>([]);
  const [deptId, setDeptId] = useState('');
  const [pulse, setPulse] = useState<DepartmentPulse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDepartments()
      .then((d) => {
        setDepartments(d);
        const param = searchParams.get('dept');
        const hodDept = user?.department_id;
        const initial = param ?? hodDept ?? d[0]?.id ?? '';
        setDeptId(initial);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [user?.department_id, searchParams]);

  useEffect(() => {
    if (!deptId) return;
    Promise.all([fetchDepartmentPulse(deptId), fetchOee('department', deptId)])
      .then(([p]) => setPulse(p))
      .catch((e) => setError(getErrorMessage(e)));
  }, [deptId]);

  const onDeptChange = (id: string) => {
    setDeptId(id);
    setSearchParams({ dept: id });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Department Pulse</h1>
          <p className="mt-1 text-sm text-slate-500">{pulse?.department_name ?? 'Operational dashboard'}</p>
        </div>
        {departments.length > 1 && (
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={deptId}
            onChange={(e) => onDeptChange(e.target.value)}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        {pulse && <StatusBadge status={pulse.status} />}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {pulse && (
        <>
          <DeptSpecificCards pulse={pulse} />

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PulseMetricCard label="Production" value={(pulse.production ?? 0).toFixed(1)} unit="t" />
            <PulseMetricCard label="OEE" value={`${((pulse.oee ?? 0) * 100).toFixed(0)}%`} />
            <PulseMetricCard label="Downtime" value={(pulse.downtime_minutes ?? 0).toFixed(0)} unit="min" />
            <PulseMetricCard label="Power" value={(pulse.power_kwh ?? 0).toFixed(0)} unit="kWh" />
            <PulseMetricCard label="Open Issues" value={pulse.open_issues} />
            <PulseMetricCard label="Maint. Alerts" value={pulse.maintenance_alerts} />
            <PulseMetricCard label="Health Score" value={pulse.health_score?.toFixed(0) ?? '—'} unit="%" />
            <PulseMetricCard label="Attendance" value={pulse.attendance_pct != null ? `${pulse.attendance_pct}%` : '—'} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="Shift Progress">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Target</span>
                  <span>{pulse.production_target ?? '—'} t</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Actual</span>
                  <span>{pulse.actual_production?.toFixed(1) ?? '—'} t</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Shift completion</span>
                  <span className="font-semibold">{pulse.shift_completion_pct?.toFixed(0) ?? '—'}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Department cost today</span>
                  <span>₹{(pulse.department_cost ?? 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div
                    className="h-3 rounded-full bg-brand-600"
                    style={{ width: `${Math.min(100, pulse.shift_completion_pct ?? 0)}%` }}
                  />
                </div>
              </div>
            </Card>
            <Card title="OEE">
              <OeeBreakdown
                availability={pulse.oee_detail.availability}
                performance={pulse.oee_detail.performance}
                quality={pulse.oee_detail.quality}
                oee={pulse.oee_detail.oee}
                estimated={pulse.oee_detail.is_estimated}
              />
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="Active Runs">
              {pulse.active_runs.length === 0 ? (
                <p className="text-sm text-slate-500">No active runs.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {pulse.active_runs.map((r) => (
                    <li key={r.id} className="flex justify-between py-2 text-sm">
                      <Link to={`/heat/${r.id}`} className="font-medium text-brand-700 hover:underline">
                        {r.run_number}
                      </Link>
                      <span className="text-slate-500">{r.state}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="OEE Trend (7 days)">
              <OeeTrendLoader deptId={deptId} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function OeeTrendLoader({ deptId }: { deptId: string }) {
  const [daily, setDaily] = useState<Awaited<ReturnType<typeof fetchOee>>['daily']>([]);
  useEffect(() => {
    fetchOee('department', deptId).then((r) => setDaily(r.daily)).catch(() => setDaily([]));
  }, [deptId]);
  return <OeeTrendChart data={daily} />;
}
