import { useState } from 'react';
import type { Department } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const CATEGORIES = [
  'sop',
  'work_instruction',
  'safety_procedure',
  'quality_document',
  'maintenance_manual',
  'training_material',
];

interface Props {
  plantId: string;
  departments: Department[];
  onClose: () => void;
  onUpload: (form: FormData) => Promise<void>;
}

export function DocumentUploadModal({ plantId, departments, onClose, onUpload }: Props) {
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('1.0');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!file) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append('plant_id', plantId);
      form.append('department_id', departmentId);
      form.append('category', category);
      form.append('title', title);
      form.append('version', version);
      form.append('file', file);
      await onUpload(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Upload document</h2>
        <div className="mt-4 space-y-3">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Version" value={version} onChange={(e) => setVersion(e.target.value)} />
          <select className="w-full rounded border px-3 py-2 text-sm" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
          </select>
          <select className="w-full rounded border px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
          <input type="file" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !file || !title}>Upload</Button>
        </div>
      </div>
    </div>
  );
}
