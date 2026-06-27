import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getErrorMessage } from '../../api/client';
import { fetchEnergyPlant } from '../../api/energy';
import { fetchPlants } from '../../api/platform';
import { PulseMetricCard } from '../../components/pulse/PulseMetricCard';
import { Card } from '../../components/ui/Card';

export function EnergyDashboardPage() {
  const [plantId, setPlantId] = useState('');
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchEnergyPlant>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlants().then((p) => p[0] && setPlantId(p[0].id)).catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    if (!plantId) return;
    fetchEnergyPlant(plantId).then(setData).catch((e) => setError(getErrorMessage(e)));
  }, [plantId]);

  const chartData = (data?.departments ?? []).map((d) => ({ name: d.code, kwh: d.kwh }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Energy</h1>
        <p className="text-sm text-slate-500">Plant, department, and asset consumption</p>
        <div className="mt-3 flex gap-2 text-sm">
          <Link to="/energy" className="font-medium text-brand-700">Plant</Link>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">Departments & Assets (below)</span>
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {data && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PulseMetricCard label="Today" value={data.today_kwh.toFixed(0)} unit="kWh" />
            <PulseMetricCard label="This Week" value={data.week_kwh.toFixed(0)} unit="kWh" />
            <PulseMetricCard label="This Month" value={data.month_kwh.toFixed(0)} unit="kWh" />
            <PulseMetricCard label="Today's Cost" value={`₹${data.today_cost.toLocaleString('en-IN')}`} />
            <PulseMetricCard label="Peak Load" value={data.peak_load_kw?.toFixed(0) ?? '—'} unit="kW" />
            <PulseMetricCard label="Avg Load" value={data.avg_load_kw?.toFixed(0) ?? '—'} unit="kW" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Energy by Department">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="kwh" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Top Asset Consumers">
              <ul className="divide-y divide-slate-100 text-sm">
                {[...(data.assets ?? [])].sort((a, b) => b.kwh - a.kwh).slice(0, 8).map((a) => (
                  <li key={a.asset_id} className="flex justify-between py-2">
                    <Link to={`/assets/${a.asset_id}/workspace`} className="text-brand-700 hover:underline">{a.name}</Link>
                    <span>{a.kwh.toFixed(0)} kWh</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <Card title="Consumption History" className="mt-6">
            <ul className="divide-y divide-slate-100 text-sm">
              {data.history.map((h, i) => (
                <li key={i} className="flex justify-between py-2">
                  <span>{new Date(h.reading_at).toLocaleString()}</span>
                  <span>{h.kwh.toFixed(0)} kWh</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
