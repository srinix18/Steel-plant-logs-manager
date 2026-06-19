import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createRecord } from '../../api/records';
import { fetchTemplate, fetchTemplates } from '../../api/templates';
import { getErrorMessage } from '../../api/client';
import type { LegacyTemplateField, Template } from '../../types';
import { DynamicFormRenderer } from '../../components/forms/DynamicFormRenderer';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export function CreateRecordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState(searchParams.get('template') || '');
  const [fields, setFields] = useState<LegacyTemplateField[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates().then(setTemplates).catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setFields([]);
      return;
    }
    fetchTemplate(selectedId)
      .then((t) => {
        setFields(t.fields || []);
        const defaults: Record<string, unknown> = {};
        (t.fields || []).forEach((f) => {
          if (f.default_value !== undefined && f.default_value !== null) {
            defaults[f.id] = f.default_value;
          }
        });
        setValues(defaults);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [selectedId]);

  const handleChange = (fieldId: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setLoading(true);
    setError('');
    try {
      await createRecord({
        template_id: selectedId,
        values: Object.entries(values).map(([field_id, value]) => ({ field_id, value })),
      });
      navigate('/records');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">New Record Entry</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700">Template</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              required
            >
              <option value="">Select template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          {fields.length > 0 && <DynamicFormRenderer fields={fields} values={values} onChange={handleChange} />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/records')}>Cancel</Button>
            <Button type="submit" disabled={loading || !selectedId}>{loading ? 'Submitting...' : 'Submit'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
