import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { fetchAssetWorkspace } from '../../api/pulse';
import { OeeBreakdown } from '../../components/pulse/OeeTrendChart';
import { StatusBadge } from '../../components/pulse/StatusBadge';
import { Card } from '../../components/ui/Card';

const TABS = ['Overview', 'Live Parameters', 'Maintenance', 'Alerts', 'OEE', 'Energy', 'Inspections', 'SOP'] as const;
type Tab = (typeof TABS)[number];

function QrDisplay({ payload }: { payload: string }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(payload)}`;
  return (
    <div className="text-center">
      <img src={url} alt="Asset QR Code" className="mx-auto rounded border border-slate-200" width={160} height={160} />
      <p className="mt-2 break-all text-xs text-slate-500">{payload}</p>
    </div>
  );
}

export function AssetWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('Overview');
  const [ws, setWs] = useState<Awaited<ReturnType<typeof fetchAssetWorkspace>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchAssetWorkspace(id).then(setWs).catch((e) => setError(getErrorMessage(e)));
  }, [id]);

  if (!id) return <p>Invalid asset.</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{ws?.asset_name ?? 'Asset Workspace'}</h1>
          <p className="text-sm text-slate-500">
            {ws?.asset_no} · {ws?.department_name} · {ws?.location}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ws && <StatusBadge status={ws.status} />}
          {ws?.health_category && <StatusBadge status={ws.health_category} label={`Health ${ws.health_score}%`} />}
          <Link to={`/assets/${id}/pulse`} className="text-sm text-brand-700 hover:underline">
            Pulse view
          </Link>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {ws && tab === 'Overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Asset Overview">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd>{ws.status}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Operator</dt><dd>{ws.current_operator ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Current run</dt><dd>{ws.current_run_label ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Installed</dt><dd>{ws.installation_date ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Remaining life</dt><dd>{ws.remaining_useful_life_pct != null ? `${ws.remaining_useful_life_pct}%` : '—'}</dd></div>
            </dl>
          </Card>
          <Card title="QR Code">
            <QrDisplay payload={ws.qr_payload ?? `asset:${id}`} />
          </Card>
          <Card title="Emergency Contacts">
            <ul className="space-y-2 text-sm">
              {ws.emergency_contacts.map((c) => (
                <li key={c.phone}>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-slate-500">{c.role} · {c.phone}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {ws && tab === 'Live Parameters' && (
        <Card title="Live Parameters">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ws.live_parameters.map((p) => (
              <div key={p.param_key} className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs text-slate-500">{p.label ?? p.param_key}</p>
                <p className="text-xl font-bold">{p.value_text ?? p.value ?? '—'}{p.unit && !p.value_text ? ` ${p.unit}` : ''}</p>
                <p className="text-xs text-slate-400">source: {p.source}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {ws && tab === 'Maintenance' && (
        <Card title="Open Work Orders">
          {ws.maintenance.open_work_orders.length === 0 ? (
            <p className="text-sm text-slate-500">No open work orders.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {ws.maintenance.open_work_orders.map((wo) => (
                <li key={wo.id} className="py-2 text-sm">
                  <Link to={`/maintenance/work-orders/${wo.id}`} className="font-medium text-brand-700 hover:underline">
                    {wo.title}
                  </Link>
                  <span className="ml-2 text-slate-500">{wo.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {ws && tab === 'Alerts' && (
        <Card title="Open Alerts">
          {ws.open_alerts.length === 0 ? (
            <p className="text-sm text-emerald-600">No open alerts for this asset.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {ws.open_alerts.map((a) => (
                <li key={a.id} className="py-2">
                  <p className="font-medium text-sm">{a.title}</p>
                  <p className="text-xs text-slate-500">{a.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {ws && tab === 'OEE' && (
        <Card title="OEE">
          <OeeBreakdown
            availability={ws.oee.availability}
            performance={ws.oee.performance}
            quality={ws.oee.quality}
            oee={ws.oee.oee}
            estimated={ws.oee.is_estimated}
          />
        </Card>
      )}

      {ws && tab === 'Energy' && (
        <Card title="Energy Today">
          <p className="text-2xl font-bold">{ws.energy_kwh_today?.toFixed(0) ?? '—'} kWh</p>
          <Link to="/energy" className="mt-2 inline-block text-sm text-brand-700 hover:underline">
            View Energy module →
          </Link>
        </Card>
      )}

      {ws && tab === 'Inspections' && (
        <Card title="Inspection History">
          {ws.inspections.length === 0 ? (
            <p className="text-sm text-slate-500">No inspections recorded.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {ws.inspections.map((i) => (
                <li key={i.id} className="py-2">{i.type} — {new Date(i.inspected_at).toLocaleDateString()}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {ws && tab === 'SOP' && (
        <Card title="SOP & Manuals">
          {ws.sops.length === 0 ? (
            <p className="text-sm text-slate-500">No documents linked.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {ws.sops.map((s) => (
                <li key={s.id} className="py-2">{s.title} <span className="text-slate-400">({s.category})</span></li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
