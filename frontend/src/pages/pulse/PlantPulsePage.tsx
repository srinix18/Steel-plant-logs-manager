import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import {
  fetchPlantPulse,
  fetchPulseAlerts,
  fetchPulseFeed,
  refreshPulse,
  type PlantPulse,
  type PulseAlert,
  type PulseEvent,
} from '../../api/pulse';
import { fetchPlants } from '../../api/platform';
import { DepartmentPulseCardView } from '../../components/pulse/DepartmentPulseCard';
import { LiveEventFeed } from '../../components/pulse/LiveEventFeed';
import { OeeBreakdown } from '../../components/pulse/OeeTrendChart';
import { PulseMetricCard } from '../../components/pulse/PulseMetricCard';
import { StatusBadge } from '../../components/pulse/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export function PlantPulsePage() {
  const [plantId, setPlantId] = useState('');
  const [pulse, setPulse] = useState<PlantPulse | null>(null);
  const [feed, setFeed] = useState<PulseEvent[]>([]);
  const [alerts, setAlerts] = useState<PulseAlert[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    if (!plantId) return Promise.resolve();
    return Promise.all([
      fetchPlantPulse(plantId),
      fetchPulseFeed(plantId),
      fetchPulseAlerts(plantId),
    ]).then(([p, f, a]) => {
      setPulse(p);
      setFeed(f);
      setAlerts(a);
    });
  }, [plantId]);

  useEffect(() => {
    fetchPlants()
      .then((p) => {
        if (p[0]) setPlantId(p[0].id);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
    const t = setInterval(() => {
      load().catch(() => undefined);
    }, 30000);
    return () => clearInterval(t);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshPulse(plantId);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plant Pulse</h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time operational snapshot — {pulse?.plant_name ?? 'loading…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pulse && <StatusBadge status={pulse.plant_status} label={`Plant ${pulse.plant_status}`} />}
          <Button variant="secondary" disabled={refreshing || !plantId} onClick={onRefresh}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Link to="/inventory-pulse" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Inventory
          </Link>
          <Link to="/energy" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Energy
          </Link>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {pulse && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <PulseMetricCard label="Overall OEE" value={`${((pulse.overall_oee ?? 0) * 100).toFixed(0)}%`} />
            <PulseMetricCard
              label="Today's Production"
              value={(pulse.today_production ?? 0).toFixed(1)}
              unit="t"
            />
            <PulseMetricCard
              label="Today's Cost"
              value={`₹${(pulse.today_cost ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            />
            <PulseMetricCard
              label="Power"
              value={(pulse.power_consumption_kwh ?? 0).toFixed(0)}
              unit="kWh"
            />
            <PulseMetricCard label="Downtime" value={(pulse.downtime_minutes ?? 0).toFixed(0)} unit="min" />
            <PulseMetricCard label="Active Alerts" value={pulse.active_alerts} accent="text-red-600" />
            <PulseMetricCard label="Pending Maint." value={pulse.pending_maintenance} />
            <PulseMetricCard label="Current Shift" value={pulse.current_shift_code ?? '—'} />
            <PulseMetricCard
              label="Attendance"
              value={pulse.attendance_pct != null ? `${pulse.attendance_pct.toFixed(0)}%` : '—'}
            />
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            <Card title="Department Pulse" className="lg:col-span-2">
              <div className="grid gap-3 sm:grid-cols-2">
                {pulse.departments.map((d) => (
                  <DepartmentPulseCardView key={d.department_id} dept={d} />
                ))}
              </div>
            </Card>
            <Card title="OEE Breakdown">
              <OeeBreakdown
                availability={pulse.oee.availability}
                performance={pulse.oee.performance}
                quality={pulse.oee.quality}
                oee={pulse.oee.oee}
                estimated={pulse.oee.is_estimated}
              />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Live Production Feed">
              <LiveEventFeed events={feed} />
            </Card>
            <Card title="Critical Alerts">
              {alerts.length === 0 ? (
                <p className="text-sm text-emerald-600">No unresolved critical issues.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {alerts.map((a) => (
                    <li key={a.id} className="py-3">
                      <p className="text-sm font-medium text-slate-900">{a.title}</p>
                      <p className="text-xs text-slate-500">{a.message}</p>
                      <p className="mt-1 text-xs text-slate-400">{new Date(a.occurred_at).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
