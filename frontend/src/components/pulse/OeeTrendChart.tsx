import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { OEETrendPoint } from '../../api/oee';

export function OeeTrendChart({ data, title }: { data: OEETrendPoint[]; title?: string }) {
  const chartData = [...data]
    .reverse()
    .map((d) => ({
      label: new Date(d.period_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      oee: Math.round(d.oee * 100),
    }));

  if (!chartData.length) {
    return <p className="text-sm text-slate-500">No OEE trend data yet.</p>;
  }

  return (
    <div>
      {title && <p className="mb-2 text-sm font-medium text-slate-700">{title}</p>}
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
          <Tooltip formatter={(v: number) => [`${v}%`, 'OEE']} />
          <Bar dataKey="oee" fill="#4f46e5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OeeBreakdown({
  availability,
  performance,
  quality,
  oee,
  estimated,
}: {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  estimated?: boolean;
}) {
  const rows = [
    { label: 'Availability', value: availability },
    { label: 'Performance', value: performance },
    { label: 'Quality', value: quality },
  ];
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-brand-700">{(oee * 100).toFixed(1)}%</span>
        <span className="text-sm text-slate-500">OEE</span>
        {estimated && (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">estimated</span>
        )}
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex justify-between text-xs text-slate-600">
              <span>{r.label}</span>
              <span>{(r.value * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-brand-500"
                style={{ width: `${Math.min(100, r.value * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
