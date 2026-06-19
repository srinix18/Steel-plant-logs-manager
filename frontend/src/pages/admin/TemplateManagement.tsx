import { useEffect, useState, type FormEvent } from 'react';
import {
  addTemplateField,
  createTemplate,
  deleteTemplate,
  deleteTemplateField,
  fetchTemplate,
  fetchTemplates,
} from '../../api/templates';
import { fetchDepartments } from '../../api/departments';
import { fetchOrganisations } from '../../api/organisations';
import { getErrorMessage } from '../../api/client';
import type { Department, FieldType, LegacyTemplateField, Organisation, Template } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';

const fieldTypes: FieldType[] = ['text', 'number', 'email', 'date', 'boolean', 'dropdown', 'textarea'];

export function TemplateManagement() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [fields, setFields] = useState<LegacyTemplateField[]>([]);
  const [templateModal, setTemplateModal] = useState(false);
  const [fieldModal, setFieldModal] = useState(false);
  const [error, setError] = useState('');

  const [tForm, setTForm] = useState({ name: '', description: '', department_id: '' });
  const [fForm, setFForm] = useState({
    name: '',
    label: '',
    field_type: 'text' as FieldType,
    required: false,
    placeholder: '',
    options: '',
    sort_order: 0,
  });

  const deptLabel = (dept: Department) => {
    const orgName = organisations.find((o) => o.id === dept.organisation_id)?.name;
    return orgName ? `${orgName} / ${dept.name}` : dept.name;
  };

  const loadTemplates = () => fetchTemplates().then(setTemplates).catch((e) => setError(getErrorMessage(e)));

  useEffect(() => {
    loadTemplates();
    fetchDepartments().then(setDepartments).catch(() => {});
    fetchOrganisations().then(setOrganisations).catch(() => {});
  }, []);

  const selectTemplate = async (t: Template) => {
    setSelected(t);
    try {
      const detail = await fetchTemplate(t.id);
      setFields(detail.fields || []);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const handleCreateTemplate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createTemplate(tForm);
      setTemplateModal(false);
      setTForm({ name: '', description: '', department_id: '' });
      loadTemplates();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleAddField = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await addTemplateField(selected.id, {
        name: fForm.name,
        label: fForm.label,
        field_type: fForm.field_type,
        required: fForm.required,
        placeholder: fForm.placeholder || undefined,
        sort_order: fForm.sort_order,
        validation: fForm.field_type === 'dropdown' ? { options: fForm.options.split(',').map((s) => s.trim()).filter(Boolean) } : {},
      });
      setFieldModal(false);
      setFForm({ name: '', label: '', field_type: 'text', required: false, placeholder: '', options: '', sort_order: fields.length });
      selectTemplate(selected);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete template and all fields?')) return;
    try {
      await deleteTemplate(id);
      setSelected(null);
      setFields([]);
      loadTemplates();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!selected) return;
    try {
      await deleteTemplateField(selected.id, fieldId);
      selectTemplate(selected);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Template Management</h1>
        <Button onClick={() => setTemplateModal(true)}>New Template</Button>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Templates">
          <Table
            data={templates}
            columns={[
              { key: 'name', header: 'Name', render: (t) => t.name },
              { key: 'status', header: 'Status', render: (t) => <Badge color={t.is_active ? 'green' : 'gray'}>{t.is_active ? 'Active' : 'Inactive'}</Badge> },
              {
                key: 'actions',
                header: 'Actions',
                render: (t) => (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => selectTemplate(t)}>Fields</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDeleteTemplate(t.id)}>Delete</Button>
                  </div>
                ),
              },
            ]}
          />
        </Card>

        <Card
          title={selected ? `Fields: ${selected.name}` : 'Template Fields'}
          action={selected ? <Button size="sm" onClick={() => setFieldModal(true)}>Add Field</Button> : undefined}
        >
          {!selected ? (
            <p className="text-sm text-slate-500">Select a template to manage its fields.</p>
          ) : (
            <Table
              data={fields}
              columns={[
                { key: 'label', header: 'Label', render: (f) => f.label },
                { key: 'name', header: 'Key', render: (f) => <code className="text-xs">{f.name}</code> },
                { key: 'type', header: 'Type', render: (f) => <Badge>{f.field_type}</Badge> },
                { key: 'req', header: 'Required', render: (f) => (f.required ? 'Yes' : 'No') },
                {
                  key: 'actions',
                  header: '',
                  render: (f) => <Button size="sm" variant="danger" onClick={() => handleDeleteField(f.id)}>Delete</Button>,
                },
              ]}
            />
          )}
        </Card>
      </div>

      <Modal open={templateModal} title="Create Template" onClose={() => setTemplateModal(false)}>
        <form onSubmit={handleCreateTemplate} className="space-y-4">
          <Input label="Name" value={tForm.name} onChange={(e) => setTForm({ ...tForm, name: e.target.value })} required />
          <Input label="Description" value={tForm.description} onChange={(e) => setTForm({ ...tForm, description: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-slate-700">Department</label>
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={tForm.department_id} onChange={(e) => setTForm({ ...tForm, department_id: e.target.value })} required>
              <option value="">Select department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{deptLabel(d)}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setTemplateModal(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={fieldModal} title="Add Field" onClose={() => setFieldModal(false)}>
        <form onSubmit={handleAddField} className="space-y-4">
          <Input label="Field Key (snake_case)" value={fForm.name} onChange={(e) => setFForm({ ...fForm, name: e.target.value })} placeholder="e.g. roll_number" required />
          <Input label="Label" value={fForm.label} onChange={(e) => setFForm({ ...fForm, label: e.target.value })} required />
          <div>
            <label className="block text-sm font-medium text-slate-700">Type</label>
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={fForm.field_type} onChange={(e) => setFForm({ ...fForm, field_type: e.target.value as FieldType })}>
              {fieldTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {fForm.field_type === 'dropdown' && (
            <Input label="Options (comma-separated)" value={fForm.options} onChange={(e) => setFForm({ ...fForm, options: e.target.value })} required />
          )}
          <Input label="Placeholder" value={fForm.placeholder} onChange={(e) => setFForm({ ...fForm, placeholder: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fForm.required} onChange={(e) => setFForm({ ...fForm, required: e.target.checked })} />
            Required field
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFieldModal(false)}>Cancel</Button>
            <Button type="submit">Add Field</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
