import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import {
  createMasterCustomer,
  createMasterDelayCode,
  createMasterGrade,
  createMasterMaterial,
  createMasterProduct,
  fetchMasterContractors,
  fetchMasterCustomers,
  fetchMasterDelayCodes,
  fetchMasterGrades,
  fetchMasterMaterials,
  fetchMasterProducts,
} from '../../api/foundation';
import { fetchPlants } from '../../api/platform';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';
import { isCeoTier } from '../../utils/roles';

type Tab = 'grades' | 'materials' | 'products' | 'customers' | 'delay_codes' | 'contractors';

type GradeRow = { id: string; code: string; description?: string | null };
type MaterialRow = { id: string; code: string; name: string; type: string };
type ContractorRow = { id: string; code: string; name: string; contact_person?: string | null };

export function MastersPage() {
  const { user } = useAuth();
  const canWrite = user ? isCeoTier(user.role) : false;
  const [tab, setTab] = useState<Tab>('grades');
  const [error, setError] = useState('');
  const [plantId, setPlantId] = useState('');
  const [orgId, setOrgId] = useState(user?.organisation_id || '');
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [products, setProducts] = useState<Awaited<ReturnType<typeof fetchMasterProducts>>>([]);
  const [customers, setCustomers] = useState<Awaited<ReturnType<typeof fetchMasterCustomers>>>([]);
  const [delayCodes, setDelayCodes] = useState<Awaited<ReturnType<typeof fetchMasterDelayCodes>>>([]);
  const [contractors, setContractors] = useState<ContractorRow[]>([]);
  const [form, setForm] = useState({ code: '', name: '', description: '', type: 'alloy', category: 'equipment' });

  const load = async () => {
    const [g, m, p, c, d, k, plants] = await Promise.all([
      fetchMasterGrades(),
      fetchMasterMaterials(),
      fetchMasterProducts(),
      fetchMasterCustomers(plantId || undefined),
      fetchMasterDelayCodes(plantId || undefined),
      fetchMasterContractors(),
      fetchPlants(),
    ]);
    setGrades(g);
    setMaterials(m);
    setProducts(p);
    setCustomers(c);
    setDelayCodes(d);
    setContractors(k);
    if (!plantId && plants[0]) setPlantId(plants[0].id);
    if (!orgId && plants[0]) setOrgId(plants[0].organisation_id);
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, [plantId]);

  const handleCreate = async () => {
    try {
      setError('');
      if (tab === 'grades') await createMasterGrade({ organisation_id: orgId, code: form.code, description: form.description });
      if (tab === 'materials') await createMasterMaterial({ organisation_id: orgId, type: form.type, code: form.code, name: form.name });
      if (tab === 'products') await createMasterProduct({ organisation_id: orgId, code: form.code, name: form.name });
      if (tab === 'customers') await createMasterCustomer({ plant_id: plantId, name: form.name, code: form.code });
      if (tab === 'delay_codes') await createMasterDelayCode({ plant_id: plantId, code: form.code, description: form.description, category: form.category });
      setForm({ code: '', name: '', description: '', type: 'alloy', category: 'equipment' });
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'grades', label: 'Grades' },
    { id: 'materials', label: 'Materials' },
    { id: 'products', label: 'Products' },
    { id: 'customers', label: 'Customers' },
    { id: 'delay_codes', label: 'Delay Codes' },
    { id: 'contractors', label: 'Contractors' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Master Data</h1>
      <p className="mt-1 text-sm text-slate-500">Centralized reference data for grades, materials, products, and more.</p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button key={t.id} variant={tab === t.id ? 'primary' : 'secondary'} onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>

      {canWrite && tab !== 'contractors' && (
        <div className="mt-4">
        <Card>
          <div className="space-y-3">
          <h2 className="font-semibold">Add {tab.replace('_', ' ')}</h2>
          <div className="flex flex-wrap gap-2">
            {(tab === 'grades' || tab === 'materials' || tab === 'products' || tab === 'customers' || tab === 'delay_codes') && (
              <Input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            )}
            {(tab === 'materials' || tab === 'products' || tab === 'customers') && (
              <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            )}
            {(tab === 'grades' || tab === 'delay_codes') && (
              <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            )}
            <Button onClick={handleCreate}>Add</Button>
          </div>
          </div>
        </Card>
        </div>
      )}

      <div className="mt-4">
      <Card>
        {tab === 'grades' && (
          <Table data={grades} columns={[
            { key: 'code', header: 'Code', render: (g) => g.code },
            { key: 'desc', header: 'Description', render: (g) => g.description || '—' },
          ]} />
        )}
        {tab === 'materials' && (
          <Table data={materials} columns={[
            { key: 'code', header: 'Code', render: (m) => m.code },
            { key: 'name', header: 'Name', render: (m) => m.name },
            { key: 'type', header: 'Type', render: (m) => m.type },
          ]} />
        )}
        {tab === 'products' && (
          <Table data={products} columns={[
            { key: 'code', header: 'Code', render: (p) => p.code },
            { key: 'name', header: 'Name', render: (p) => p.name },
            { key: 'active', header: 'Active', render: (p) => (p.is_active ? 'Yes' : 'No') },
          ]} />
        )}
        {tab === 'customers' && (
          <Table data={customers} columns={[
            { key: 'code', header: 'Code', render: (c) => c.code || '—' },
            { key: 'name', header: 'Name', render: (c) => c.name },
            { key: 'active', header: 'Active', render: (c) => (c.is_active ? 'Yes' : 'No') },
          ]} />
        )}
        {tab === 'delay_codes' && (
          <Table data={delayCodes} columns={[
            { key: 'code', header: 'Code', render: (d) => d.code },
            { key: 'desc', header: 'Description', render: (d) => d.description },
            { key: 'cat', header: 'Category', render: (d) => d.category },
          ]} />
        )}
        {tab === 'contractors' && (
          <>
            <p className="mb-2 px-4 pt-4 text-sm text-slate-500">Read-only. Manage contractors in Workforce.</p>
            <Table data={contractors} columns={[
              { key: 'code', header: 'Code', render: (c) => c.code },
              { key: 'name', header: 'Name', render: (c) => c.name },
              { key: 'contact', header: 'Contact', render: (c) => c.contact_person || '—' },
            ]} />
          </>
        )}
      </Card>
      </div>
    </div>
  );
}
