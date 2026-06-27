import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { fetchPlants } from '../../api/platform';
import { fetchSafetyDashboard, fetchSafetyIncidents, fetchSafetyInspections, fetchSafetySops } from '../../api/safety';
import { PulseMetricCard } from '../../components/pulse/PulseMetricCard';
import { Card } from '../../components/ui/Card';

export function SafetyDashboardPage() {
  const [plantId, setPlantId] = useState('');
  const [dash, setDash] = useState<Awaited<ReturnType<typeof fetchSafetyDashboard>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlants().then((p) => p[0] && setPlantId(p[0].id)).catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    if (!plantId) return;
    fetchSafetyDashboard(plantId).then(setDash).catch((e) => setError(getErrorMessage(e)));
  }, [plantId]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Safety</h1>
          <p className="text-sm text-slate-500">Inspections, incidents, and compliance</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link to="/safety/scan" className="rounded-lg bg-brand-600 px-3 py-2 font-medium text-white">Scan Asset</Link>
          <Link to="/safety/inspections" className="rounded-lg border px-3 py-2">Inspections</Link>
          <Link to="/safety/sops" className="rounded-lg border px-3 py-2">SOP Library</Link>
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {dash && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PulseMetricCard label="Under Maintenance" value={dash.assets_under_maintenance} />
            <PulseMetricCard label="Unsafe Assets" value={dash.unsafe_assets} accent="text-red-600" />
            <PulseMetricCard label="Expired Certs" value={dash.expired_certifications} />
            <PulseMetricCard label="Inspection Due" value={dash.inspection_due} accent="text-amber-600" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Recent Incidents">
              {(dash.recent_incidents ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No incidents.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {dash.recent_incidents.map((i) => (
                    <li key={i.id} className="py-2">{i.title} — {i.severity}</li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Emergency Contacts">
              <ul className="space-y-2 text-sm">
                {dash.emergency_contacts.map((c) => (
                  <li key={c.phone}><strong>{c.name}</strong> — {c.phone}</li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export function SafetyInspectionsPage() {
  const [rows, setRows] = useState<{ id: string; inspection_type: string; inspected_at: string }[]>([]);
  useEffect(() => {
    fetchPlants().then((p) => p[0] && fetchSafetyInspections(p[0].id).then(setRows));
  }, []);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Inspections</h1>
      <Card>
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r.id} className="py-2">{r.inspection_type} — {new Date(r.inspected_at).toLocaleString()}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function SafetySopsPage() {
  const [rows, setRows] = useState<{ id: string; title: string; category: string }[]>([]);
  useEffect(() => {
    fetchPlants().then((p) => p[0] && fetchSafetySops(p[0].id).then(setRows));
  }, []);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">SOP Library</h1>
      <Card>
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r.id} className="py-2">{r.title} <span className="text-slate-400">({r.category})</span></li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function SafetyIncidentsPage() {
  const [rows, setRows] = useState<{ id: string; title: string; severity: string }[]>([]);
  useEffect(() => {
    fetchPlants().then((p) => p[0] && fetchSafetyIncidents(p[0].id).then(setRows));
  }, []);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Incident Reports</h1>
      <Card>
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r.id} className="py-2">{r.title} — {r.severity}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
