import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  createFoundationObservation,
  fetchFoundationObservations,
  type FoundationObservation,
} from '@/src/api/foundation';
import { fetchDepartments, fetchPlants } from '@/src/api/lookups';
import { useAuth } from '@/src/auth/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import type { Department } from '@/src/types/platform';
import { colors, spacing, typography } from '@/src/theme/tokens';

const CATEGORIES = [
  { value: 'quality', label: 'quality' },
  { value: 'safety', label: 'safety' },
  { value: 'energy', label: 'energy' },
  { value: 'equipment', label: 'equipment' },
  { value: 'process', label: 'process' },
];

const SEVERITIES = [
  { value: 'low', label: 'low' },
  { value: 'medium', label: 'medium' },
  { value: 'high', label: 'high' },
  { value: 'critical', label: 'critical' },
];

type FormState = {
  title: string;
  description: string;
  category: string;
  severity: string;
  department_id: string;
};

function emptyForm(deptId: string): FormState {
  return {
    title: '',
    description: '',
    category: 'equipment',
    severity: 'medium',
    department_id: deptId,
  };
}

function severityTone(severity: string): 'success' | 'danger' | 'brand' | 'neutral' {
  const key = severity.toLowerCase();
  if (key === 'critical' || key === 'high') return 'danger';
  if (key === 'medium') return 'brand';
  if (key === 'low') return 'success';
  return 'neutral';
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * P5-FND-OBS — operational observations (port of ObservationsPage).
 */
export function FoundationObservationsScreen() {
  const { user } = useAuth();
  const defaultDept = user?.department_id || '';

  const [plantId, setPlantId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [observations, setObservations] = useState<FoundationObservation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultDept));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const plants = await fetchPlants();
        const pid = plantId || plants[0]?.id || '';
        if (!plantId && pid) setPlantId(pid);
        const [list, depts] = await Promise.all([
          fetchFoundationObservations({ plant_id: pid || undefined }),
          fetchDepartments(pid || undefined).catch(() => [] as Department[]),
        ]);
        setObservations(list);
        setDepartments(depts);
      } catch (e) {
        setError(getErrorMessage(e));
        setObservations([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [plantId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const deptOptions = useMemo(
    () => [
      { value: '', label: 'No department' },
      ...departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` })),
    ],
    [departments]
  );

  const openForm = () => {
    setForm(emptyForm(defaultDept));
    setShowForm(true);
    setMessage(null);
    setError(null);
  };

  const submit = async () => {
    if (!plantId) {
      setError('No plant available.');
      return;
    }
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createFoundationObservation({
        plant_id: plantId,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        severity: form.severity,
        department_id: form.department_id || undefined,
      });
      setShowForm(false);
      setForm(emptyForm(defaultDept));
      setMessage(`Created: ${created.title || created.description.slice(0, 40)}`);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !refreshing) {
    return <LoadingView message="Loading observations…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Observations</Text>
          <Text style={styles.subtitle}>Operational issues and findings.</Text>
        </View>
        <Button title="New" onPress={openForm} size="sm" />
      </View>

      {error ? <ErrorBanner message={error} /> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {showForm ? (
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>New observation</Text>
          <TextField
            label="Title"
            value={form.title}
            onChangeText={(title) => setForm((f) => ({ ...f, title }))}
          />
          <TextField
            label="Description"
            value={form.description}
            onChangeText={(description) => setForm((f) => ({ ...f, description }))}
            multiline
            numberOfLines={3}
          />
          <SelectSheet
            label="Category"
            value={form.category}
            options={CATEGORIES}
            onChange={(category) => setForm((f) => ({ ...f, category }))}
          />
          <SelectSheet
            label="Severity"
            value={form.severity}
            options={SEVERITIES}
            onChange={(severity) => setForm((f) => ({ ...f, severity }))}
          />
          {deptOptions.length > 1 ? (
            <SelectSheet
              label="Department"
              value={form.department_id}
              options={deptOptions}
              onChange={(department_id) => setForm((f) => ({ ...f, department_id }))}
            />
          ) : null}
          <View style={styles.formActions}>
            <Button title="Save" onPress={() => void submit()} loading={saving} />
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setShowForm(false)}
              disabled={saving}
            />
          </View>
        </Card>
      ) : null}

      {observations.length === 0 ? (
        <EmptyState title="No observations yet" description="Create one to track an issue." />
      ) : (
        <View style={styles.list}>
          {observations.map((o) => (
            <Card key={o.id} style={styles.row}>
              <Text style={styles.rowTitle}>{o.title || o.description.slice(0, 40)}</Text>
              <View style={styles.badges}>
                <Badge label={o.category} tone="neutral" />
                <Badge label={o.severity} tone={severityTone(o.severity)} />
                <Badge label={o.status} tone="brand" />
              </View>
              <Text style={styles.rowMeta}>{formatWhen(o.observed_at)}</Text>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: { flex: 1 },
  title: { ...typography.title, color: colors.text },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  message: {
    ...typography.body,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  formCard: { marginBottom: spacing.md, gap: spacing.sm },
  formTitle: { ...typography.section, color: colors.text },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  list: { gap: spacing.sm },
  row: { gap: spacing.xs },
  rowTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  rowMeta: { ...typography.caption, color: colors.textMuted },
});
