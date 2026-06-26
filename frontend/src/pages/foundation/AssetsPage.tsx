import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import {
  addAssetResponsibility,
  createAssetEvent,
  createFoundationAsset,
  fetchAssetEvents,
  fetchAssetGroups,
  fetchAssetResponsibilities,
  fetchFoundationAssets,
  updateFoundationAsset,
  type FoundationAsset,
} from '../../api/foundation';
import { fetchDepartments, fetchPlants, fetchPlantUsers } from '../../api/platform';
import { fetchAssetMaintenanceHistory, type AssetMaintenanceHistory } from '../../api/maintenancePm';
import { useAuth } from '../../contexts/AuthContext';
import { AssetFormModal } from '../../components/foundation/AssetFormModal';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { isHodTier } from '../../utils/roles';

export function AssetsPage() {
  const { user } = useAuth();
  const canEdit = user ? isHodTier(user.role) : false;
  const [error, setError] = useState('');
  const [plantId, setPlantId] = useState('');
  const [assets, setAssets] = useState<FoundationAsset[]>([]);
  const [groups, setGroups] = useState<Awaited<ReturnType<typeof fetchAssetGroups>>>([]);
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [selected, setSelected] = useState<FoundationAsset | null>(null);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof fetchAssetEvents>>>([]);
  const [responsibilities, setResponsibilities] = useState<Awaited<ReturnType<typeof fetchAssetResponsibilities>>>([]);
  const [plantUsers, setPlantUsers] = useState<Awaited<ReturnType<typeof fetchPlantUsers>>>([]);
  const [respUserId, setRespUserId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editAsset, setEditAsset] = useState<FoundationAsset | null>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'maintenance'>('details');
  const [maintHistory, setMaintHistory] = useState<AssetMaintenanceHistory | null>(null);

  const load = async () => {
    const plants = await fetchPlants();
    const pid = plantId || plants[0]?.id || '';
    if (!plantId && pid) setPlantId(pid);
    const [a, g, d, u] = await Promise.all([
      fetchFoundationAssets({ plant_id: pid || undefined }),
      fetchAssetGroups(pid || undefined),
      fetchDepartments(pid || undefined),
      pid ? fetchPlantUsers(pid).catch(() => []) : Promise.resolve([]),
    ]);
    setAssets(a);
    setGroups(g);
    setDepartments(d);
    setPlantUsers(u);
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, [plantId]);

  const selectAsset = async (asset: FoundationAsset) => {
    setSelected(asset);
    setDetailTab('details');
    const [ev, resp, hist] = await Promise.all([
      fetchAssetEvents(asset.id),
      fetchAssetResponsibilities(asset.id),
      fetchAssetMaintenanceHistory(asset.id).catch(() => null),
    ]);
    setEvents(ev);
    setResponsibilities(resp);
    setMaintHistory(hist);
  };

  const assignResponsibility = async () => {
    if (!selected || !respUserId) return;
    await addAssetResponsibility(selected.id, { user_id: respUserId });
    setResponsibilities(await fetchAssetResponsibilities(selected.id));
    setRespUserId('');
  };

  const handleSave = async (payload: Record<string, unknown>) => {
    if (editAsset) {
      await updateFoundationAsset(editAsset.id, payload);
    } else {
      await createFoundationAsset({ ...payload, plant_id: plantId });
    }
    setShowModal(false);
    setEditAsset(null);
    await load();
  };

  const addEvent = async () => {
    if (!selected) return;
    await createAssetEvent(selected.id, {
      event_type: 'manual_entry',
      occurred_at: new Date().toISOString(),
      payload: { note: 'Manual inspection entry' },
    });
    setEvents(await fetchAssetEvents(selected.id));
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Asset Registry</h1>
          <p className="mt-1 text-sm text-slate-500">Plant equipment, life tracking, and manual events.</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditAsset(null); setShowModal(true); }}>Add asset</Button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Table
            data={assets}
            emptyMessage="No assets found."
            columns={[
              { key: 'code', header: 'Code', render: (a) => <button type="button" className="text-brand-600" onClick={() => selectAsset(a)}>{a.asset_no}</button> },
              { key: 'name', header: 'Name', render: (a) => a.name },
              { key: 'group', header: 'Group', render: (a) => a.group_name || '—' },
              { key: 'status', header: 'Status', render: (a) => a.status },
              { key: 'rem', header: 'Remaining', render: (a) => (a.remaining_life ? `${a.remaining_life.value} ${a.remaining_life.unit}` : '—') },
            ]}
          />
        </Card>

        <Card>
          {selected ? (
            <>
              <h2 className="font-semibold">{selected.asset_no} — {selected.name}</h2>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDetailTab('details')}
                  className={`rounded-lg px-3 py-1 text-sm font-medium ${
                    detailTab === 'details' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('maintenance')}
                  className={`rounded-lg px-3 py-1 text-sm font-medium ${
                    detailTab === 'maintenance' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Maintenance
                </button>
              </div>

              {detailTab === 'details' && (
                <>
                  <dl className="mt-3 space-y-1 text-sm">
                    <div><dt className="inline font-medium">Life: </dt><dd className="inline">{JSON.stringify(selected.life_counters)}</dd></div>
                    <div><dt className="inline font-medium">Expected: </dt><dd className="inline">{JSON.stringify(selected.expected_life)}</dd></div>
                    {selected.last_inspection_at && <div><dt className="inline font-medium">Last inspection: </dt><dd className="inline">{new Date(selected.last_inspection_at).toLocaleString()}</dd></div>}
                  </dl>
                  {canEdit && (
                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" onClick={() => { setEditAsset(selected); setShowModal(true); }}>Edit</Button>
                      <Button variant="secondary" onClick={() => addEvent().catch((e) => setError(getErrorMessage(e)))}>Log manual event</Button>
                    </div>
                  )}
                  <h3 className="mt-4 font-medium">Events</h3>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {events.map((e) => (
                      <li key={e.id}>{e.event_type} — {new Date(e.occurred_at).toLocaleString()}</li>
                    ))}
                    {events.length === 0 && <li>No events recorded.</li>}
                  </ul>
                  <h3 className="mt-4 font-medium">Responsibilities</h3>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {responsibilities.map((r) => (
                      <li key={r.id}>{r.user_name} ({r.role_label}){r.is_primary ? ' — primary' : ''}</li>
                    ))}
                    {responsibilities.length === 0 && <li>No assignments.</li>}
                  </ul>
                  {canEdit && (
                    <div className="mt-2 flex gap-2">
                      <select className="rounded border px-2 py-1 text-sm" value={respUserId} onChange={(e) => setRespUserId(e.target.value)}>
                        <option value="">Assign employee</option>
                        {plantUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                      </select>
                      <Button variant="secondary" onClick={() => assignResponsibility().catch((e) => setError(getErrorMessage(e)))}>Assign</Button>
                    </div>
                  )}
                </>
              )}

              {detailTab === 'maintenance' && (
                <div className="mt-3">
                  {maintHistory ? (
                    <>
                      <dl className="mb-4 space-y-1 text-sm">
                        {maintHistory.last_pm_at && (
                          <div><dt className="inline font-medium">Last PM: </dt><dd className="inline">{new Date(maintHistory.last_pm_at).toLocaleString()}</dd></div>
                        )}
                        {maintHistory.next_pm_due_at && (
                          <div><dt className="inline font-medium">Next PM due: </dt><dd className="inline">{new Date(maintHistory.next_pm_due_at).toLocaleString()}</dd></div>
                        )}
                        <div><dt className="inline font-medium">Total maintenance cost: </dt><dd className="inline">₹{maintHistory.total_maintenance_cost.toLocaleString('en-IN')}</dd></div>
                      </dl>
                      <h3 className="font-medium">History timeline</h3>
                      <ol className="relative mt-4 border-l border-slate-200 pl-4">
                        {maintHistory.entries.map((entry) => (
                          <li key={entry.id} className="mb-4">
                            <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                            <p className="text-xs text-slate-500">{new Date(entry.occurred_at).toLocaleString()}</p>
                            <p className="font-medium text-slate-900">{entry.title}</p>
                            <p className="text-xs capitalize text-slate-500">{entry.entry_type.replace(/_/g, ' ')}{entry.status ? ` — ${entry.status}` : ''}</p>
                          </li>
                        ))}
                        {maintHistory.entries.length === 0 && (
                          <li className="text-sm text-slate-500">No maintenance history recorded.</li>
                        )}
                      </ol>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">Maintenance history unavailable.</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">Select an asset to view details and events.</p>
          )}
        </Card>
      </div>

      {showModal && (
        <AssetFormModal
          groups={groups}
          departments={departments}
          asset={editAsset}
          onClose={() => { setShowModal(false); setEditAsset(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
