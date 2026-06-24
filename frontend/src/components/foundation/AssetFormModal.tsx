import { useState } from 'react';
import type { FoundationAsset } from '../../api/foundation';
import type { AssetGroup } from '../../api/foundation';
import type { Department } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Props {
  groups: AssetGroup[];
  departments: Department[];
  asset: FoundationAsset | null;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}

export function AssetFormModal({ groups, departments, asset, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    group_id: asset?.group_id || groups[0]?.id || '',
    department_id: asset?.department_id || '',
    asset_no: asset?.asset_no || '',
    name: asset?.name || '',
    status: asset?.status || 'active',
    remarks: asset?.remarks || '',
    life_unit: (asset?.expected_life?.unit as string) || 'heats',
    life_expected: String((asset?.expected_life?.value as number) || ''),
    life_current: String((asset?.life_counters?.[(asset?.expected_life?.unit as string) || 'heats'] as number) || 0),
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const unit = form.life_unit;
      await onSave({
        group_id: form.group_id,
        department_id: form.department_id || null,
        asset_no: form.asset_no,
        name: form.name,
        status: form.status,
        remarks: form.remarks || null,
        expected_life: form.life_expected ? { unit, value: Number(form.life_expected) } : {},
        life_counters: { [unit]: Number(form.life_current) || 0 },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{asset ? 'Edit asset' : 'New asset'}</h2>
        <div className="mt-4 space-y-3">
          <Input placeholder="Asset code" value={form.asset_no} disabled={!!asset} onChange={(e) => setForm({ ...form, asset_no: e.target.value })} />
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="w-full rounded border px-3 py-2 text-sm" value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="w-full rounded border px-3 py-2 text-sm" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            <option value="">No department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Life unit" value={form.life_unit} onChange={(e) => setForm({ ...form, life_unit: e.target.value })} />
            <Input placeholder="Expected" value={form.life_expected} onChange={(e) => setForm({ ...form, life_expected: e.target.value })} />
            <Input placeholder="Current" value={form.life_current} onChange={(e) => setForm({ ...form, life_current: e.target.value })} />
          </div>
          <Input placeholder="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}
