import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import {
  createFuelRate,
  createLabourRate,
  createMaintenanceRate,
  createPowerRate,
  createRawMaterialRate,
  fetchFuelRates,
  fetchLabourRates,
  fetchMaintenanceRates,
  fetchPowerRates,
  fetchRawMaterialRates,
} from '../../api/finance';
import { fetchMasterMaterials } from '../../api/foundation';
import { fetchPlants } from '../../api/platform';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';
import { hasRole, FINANCE_MASTERS_WRITE_ROLES } from '../../utils/roles';

type Tab = 'raw_materials' | 'power' | 'fuel' | 'labour' | 'maintenance';

export function CostMastersPage() {
  const { user } = useAuth();
  const canWrite = user ? hasRole(user.role, FINANCE_MASTERS_WRITE_ROLES) : false;
  const [tab, setTab] = useState<Tab>('raw_materials');
  const [error, setError] = useState('');
  const [plantId, setPlantId] = useState('');
  const [orgId, setOrgId] = useState(user?.organisation_id || '');
  const [rawMaterials, setRawMaterials] = useState<Awaited<ReturnType<typeof fetchRawMaterialRates>>>([]);
  const [powerRates, setPowerRates] = useState<Awaited<ReturnType<typeof fetchPowerRates>>>([]);
  const [fuelRates, setFuelRates] = useState<Awaited<ReturnType<typeof fetchFuelRates>>>([]);
  const [labourRates, setLabourRates] = useState<Awaited<ReturnType<typeof fetchLabourRates>>>([]);
  const [maintRates, setMaintRates] = useState<Awaited<ReturnType<typeof fetchMaintenanceRates>>>([]);
  const [materials, setMaterials] = useState<Awaited<ReturnType<typeof fetchMasterMaterials>>>([]);
  const [form, setForm] = useState({
    material_id: '',
    rate: '',
    fuel_name: '',
    role_label: 'Operator',
    category: 'equipment',
    cost_per_unit: '8.5',
    effective_from: new Date().toISOString().slice(0, 10),
  });

  const load = async () => {
    const [rm, pw, fu, lb, mt, mats, plants] = await Promise.all([
      fetchRawMaterialRates(orgId || undefined),
      fetchPowerRates(plantId || undefined),
      fetchFuelRates(plantId || undefined),
      fetchLabourRates(plantId || undefined),
      fetchMaintenanceRates(plantId || undefined),
      fetchMasterMaterials(),
      fetchPlants(),
    ]);
    setRawMaterials(rm);
    setPowerRates(pw);
    setFuelRates(fu);
    setLabourRates(lb);
    setMaintRates(mt);
    setMaterials(mats);
    if (!plantId && plants[0]) {
      setPlantId(plants[0].id);
      setOrgId(plants[0].organisation_id);
    }
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, [plantId, orgId]);

  const handleCreate = async () => {
    try {
      setError('');
      if (tab === 'raw_materials' && form.material_id && form.rate) {
        await createRawMaterialRate({
          organisation_id: orgId,
          material_id: form.material_id,
          rate: Number(form.rate),
          effective_from: form.effective_from,
        });
      }
      if (tab === 'power' && plantId) {
        await createPowerRate({
          plant_id: plantId,
          cost_per_unit: Number(form.cost_per_unit),
          effective_from: form.effective_from,
        });
      }
      if (tab === 'fuel' && plantId && form.fuel_name) {
        await createFuelRate({
          plant_id: plantId,
          fuel_name: form.fuel_name,
          rate: Number(form.rate) || 0,
          effective_from: form.effective_from,
        });
      }
      if (tab === 'labour' && plantId) {
        await createLabourRate({
          plant_id: plantId,
          role_label: form.role_label,
          cost_per_hour: Number(form.rate) || 350,
        });
      }
      if (tab === 'maintenance' && plantId) {
        await createMaintenanceRate({
          plant_id: plantId,
          category: form.category,
          default_cost: Number(form.rate) || 5000,
        });
      }
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'raw_materials', label: 'Raw Materials' },
    { id: 'power', label: 'Power' },
    { id: 'fuel', label: 'Fuel' },
    { id: 'labour', label: 'Labour' },
    { id: 'maintenance', label: 'Maintenance' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Cost Masters</h1>
        <p className="mt-1 text-sm text-slate-500">Maintain operational cost rates (not accounting)</p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {canWrite && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-end gap-3">
            {tab === 'raw_materials' && (
              <select
                className="rounded border px-3 py-2 text-sm"
                value={form.material_id}
                onChange={(e) => setForm({ ...form, material_id: e.target.value })}
              >
                <option value="">Material</option>
                {materials.map((m: { id: string; code: string; name: string }) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.name}
                  </option>
                ))}
              </select>
            )}
            {tab === 'fuel' && (
              <Input
                placeholder="Fuel name"
                value={form.fuel_name}
                onChange={(e) => setForm({ ...form, fuel_name: e.target.value })}
              />
            )}
            {tab === 'labour' && (
              <Input
                placeholder="Role"
                value={form.role_label}
                onChange={(e) => setForm({ ...form, role_label: e.target.value })}
              />
            )}
            {tab === 'maintenance' && (
              <select
                className="rounded border px-3 py-2 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {['equipment', 'quality', 'safety', 'energy', 'process'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
            {tab === 'power' ? (
              <Input
                placeholder="₹/kWh"
                value={form.cost_per_unit}
                onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })}
              />
            ) : tab !== 'maintenance' ? (
              <Input
                placeholder="Rate"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
              />
            ) : (
              <Input
                placeholder="Default cost"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
              />
            )}
            {(tab === 'raw_materials' || tab === 'power' || tab === 'fuel') && (
              <Input
                type="date"
                value={form.effective_from}
                onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
              />
            )}
            <Button onClick={handleCreate}>Add</Button>
          </div>
        </Card>
      )}

      <Card>
        {tab === 'raw_materials' && (
          <Table
            data={rawMaterials}
            emptyMessage="No raw material rates."
            columns={[
              { key: 'mat', header: 'Material', render: (r) => `${r.material_code} — ${r.material_name}` },
              { key: 'rate', header: 'Rate', render: (r) => `₹${r.rate}/${r.unit}` },
              { key: 'from', header: 'Effective From', render: (r) => r.effective_from },
            ]}
          />
        )}
        {tab === 'power' && (
          <Table
            data={powerRates}
            emptyMessage="No power rates."
            columns={[
              { key: 'rate', header: '₹/unit', render: (r) => r.cost_per_unit },
              { key: 'from', header: 'From', render: (r) => r.effective_from },
            ]}
          />
        )}
        {tab === 'fuel' && (
          <Table
            data={fuelRates}
            emptyMessage="No fuel rates."
            columns={[
              { key: 'name', header: 'Fuel', render: (r) => r.fuel_name },
              { key: 'rate', header: 'Rate', render: (r) => `₹${r.rate}/${r.unit}` },
            ]}
          />
        )}
        {tab === 'labour' && (
          <Table
            data={labourRates}
            emptyMessage="No labour rates."
            columns={[
              { key: 'role', header: 'Role', render: (r) => r.role_label },
              { key: 'rate', header: '₹/hr', render: (r) => r.cost_per_hour },
            ]}
          />
        )}
        {tab === 'maintenance' && (
          <Table
            data={maintRates}
            emptyMessage="No maintenance rates."
            columns={[
              { key: 'cat', header: 'Category', render: (r) => r.category },
              { key: 'cost', header: 'Default Cost', render: (r) => `₹${r.default_cost}` },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
