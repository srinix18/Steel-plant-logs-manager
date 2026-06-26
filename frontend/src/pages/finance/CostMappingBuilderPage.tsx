import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import {
  COST_CATEGORY_LABELS,
  createMappingRule,
  deleteMappingRule,
  fetchMappingContext,
  type CostCategory,
  type CostMappingSourceType,
} from '../../api/finance';
import { fetchTemplates } from '../../api/templatesMoi';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { hasRole, FINANCE_MAPPING_WRITE_ROLES } from '../../utils/roles';
import type { TemplateSummary } from '../../types';

export function CostMappingBuilderPage() {
  const { user } = useAuth();
  const canWrite = user ? hasRole(user.role, FINANCE_MAPPING_WRITE_ROLES) : false;
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [versionId, setVersionId] = useState('');
  const [context, setContext] = useState<Awaited<ReturnType<typeof fetchMappingContext>> | null>(null);
  const [selectedField, setSelectedField] = useState('');
  const [form, setForm] = useState({
    source_type: 'scalar_field' as CostMappingSourceType,
    cost_category: 'power' as CostCategory,
    child_key: 'quantity_kg',
    material_field_key: 'material',
    item_label_override: '',
    preview_qty: '1000',
    preview_rate: '45',
  });

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    if (!versionId) return;
    fetchMappingContext(versionId)
      .then(setContext)
      .catch((e) => setError(getErrorMessage(e)));
  }, [versionId]);

  const publishedVersions = templates.flatMap((t) =>
    t.versions
      .filter((v) => v.status === 'published')
      .map((v) => ({
        versionId: v.id,
        label: `${t.doc_no} — ${t.name} (rev ${v.rev_no})`,
      }))
  );

  const handleAddRule = async () => {
    if (!versionId || !selectedField) return;
    const field = context?.available_fields.find(
      (f) => `${f.section_key}.${f.field_name}` === selectedField
    );
    if (!field) return;
    const isSection = field.section_type !== 'fields';
    try {
      await createMappingRule({
        template_version_id: versionId,
        source_type: isSection ? 'section_row' : 'scalar_field',
        source_key: isSection ? field.section_key : field.field_name,
        cost_category: form.cost_category,
        child_key: isSection ? form.child_key : undefined,
        material_field_key: isSection && form.cost_category === 'raw_material' ? form.material_field_key : undefined,
        item_label_override: form.item_label_override || undefined,
        sort_order: (context?.rules.length || 0) + 1,
      });
      const ctx = await fetchMappingContext(versionId);
      setContext(ctx);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await deleteMappingRule(ruleId);
      if (versionId) setContext(await fetchMappingContext(versionId));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const previewAmount =
    (Number(form.preview_qty) || 0) * (Number(form.preview_rate) || 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Cost Mapping Builder</h1>
        <p className="mt-1 text-sm text-slate-500">
          Map template fields to cost categories — no hardcoded field names in the engine
        </p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card className="mb-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">Template version</label>
        <select
          className="w-full max-w-xl rounded border px-3 py-2 text-sm"
          value={versionId}
          onChange={(e) => setVersionId(e.target.value)}
        >
          <option value="">Select published template...</option>
          {publishedVersions.map((v) => (
            <option key={v.versionId} value={v.versionId}>
              {v.label}
            </option>
          ))}
        </select>
      </Card>

      {context && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Template Fields</h2>
            <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
              {context.available_fields.map((f) => {
                const key = `${f.section_key}.${f.field_name}`;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setSelectedField(key)}
                      className={`w-full rounded px-2 py-1 text-left ${
                        selectedField === key ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-medium">{f.field_label}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {f.section_key}/{f.field_name} ({f.section_type})
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="space-y-4">
            {canWrite && (
              <Card>
                <h2 className="mb-3 text-sm font-semibold">New Mapping</h2>
                <div className="space-y-2">
                  <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={form.cost_category}
                    onChange={(e) => setForm({ ...form, cost_category: e.target.value as CostCategory })}
                  >
                    {Object.entries(COST_CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="Label override (optional)"
                    value={form.item_label_override}
                    onChange={(e) => setForm({ ...form, item_label_override: e.target.value })}
                  />
                  <Button onClick={handleAddRule} disabled={!selectedField}>
                    Map selected field → {COST_CATEGORY_LABELS[form.cost_category]}
                  </Button>
                </div>
              </Card>
            )}

            <Card>
              <h2 className="mb-3 text-sm font-semibold">Preview</h2>
              <p className="text-sm text-slate-600">
                If qty = {form.preview_qty} @ ₹{form.preview_rate} →{' '}
                <strong>₹{previewAmount.toLocaleString('en-IN')}</strong>
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  className="w-24 rounded border px-2 py-1 text-sm"
                  value={form.preview_qty}
                  onChange={(e) => setForm({ ...form, preview_qty: e.target.value })}
                />
                <input
                  className="w-24 rounded border px-2 py-1 text-sm"
                  value={form.preview_rate}
                  onChange={(e) => setForm({ ...form, preview_rate: e.target.value })}
                />
              </div>
            </Card>
          </div>
        </div>
      )}

      {context && (
        <Card className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">Active Rules — {context.template_name} rev {context.rev_no}</h2>
          <Table
            data={context.rules}
            emptyMessage="No mapping rules. Add rules above."
            columns={[
              { key: 'src', header: 'Source', render: (r) => `${r.source_type}: ${r.source_key}` },
              {
                key: 'cat',
                header: 'Cost Type',
                render: (r) => COST_CATEGORY_LABELS[r.cost_category],
              },
              { key: 'child', header: 'Child Key', render: (r) => r.child_key || '—' },
              {
                key: 'actions',
                header: '',
                render: (r) =>
                  canWrite ? (
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() => handleDelete(r.id)}
                    >
                      Delete
                    </button>
                  ) : null,
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
