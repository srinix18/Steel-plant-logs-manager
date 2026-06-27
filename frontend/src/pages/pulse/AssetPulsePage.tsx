import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { fetchAssetPulse } from '../../api/pulse';
import { fetchOee } from '../../api/oee';
import { OeeBreakdown, OeeTrendChart } from '../../components/pulse/OeeTrendChart';
import { PulseMetricCard } from '../../components/pulse/PulseMetricCard';
import { StatusBadge } from '../../components/pulse/StatusBadge';
import { Card } from '../../components/ui/Card';

export function AssetPulsePage() {
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState('');

  const [pulse, setPulse] = useState<Awaited<ReturnType<typeof fetchAssetPulse>> | null>(null);
  const [oeeDaily, setOeeDaily] = useState<Awaited<ReturnType<typeof fetchOee>>['daily']>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchAssetPulse(id), fetchOee('asset', id)])
      .then(([p, o]) => {
        setPulse(p);
        setOeeDaily(o.daily);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [id]);

  if (!id) return <p>Invalid asset.</p>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{pulse?.asset_name ?? 'Asset Pulse'}</h1>
          <p className="text-sm text-slate-500">{pulse?.asset_no} · {pulse?.department_name}</p>
        </div>
        <div className="flex gap-2">
          {pulse && <StatusBadge status={pulse.status} />}
          <Link
            to={`/assets/${id}/workspace`}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Open Workspace
          </Link>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {pulse && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PulseMetricCard label="Health" value={pulse.health_score?.toFixed(0) ?? '—'} unit="%" />
            <PulseMetricCard label="OEE" value={`${(pulse.oee.oee * 100).toFixed(0)}%`} />
            <PulseMetricCard label="Operator" value={pulse.current_operator ?? '—'} />
            <PulseMetricCard label="Current Run" value={pulse.current_run_label ?? '—'} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Live Parameters">
              {pulse.live_parameters.length === 0 ? (
                <p className="text-sm text-slate-500">No live parameters configured.</p>
              ) : (
                <dl className="grid grid-cols-2 gap-3">
                  {pulse.live_parameters.map((p) => (
                    <div key={p.param_key} className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">{p.label ?? p.param_key}</dt>
                      <dd className="text-lg font-semibold text-slate-900">
                        {p.value_text ?? p.value ?? '—'}
                        {p.unit && !p.value_text && (
                          <span className="ml-1 text-sm font-normal text-slate-500">{p.unit}</span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>
            <Card title="OEE">
              <OeeBreakdown
                availability={pulse.oee.availability}
                performance={pulse.oee.performance}
                quality={pulse.oee.quality}
                oee={pulse.oee.oee}
                estimated={pulse.oee.is_estimated}
              />
              <div className="mt-4">
                <OeeTrendChart data={oeeDaily} title="Daily trend" />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
