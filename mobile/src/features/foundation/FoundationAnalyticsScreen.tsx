import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  createKpiDefinition,
  fetchKpiDefinitions,
  type KpiDefinition,
} from '@/src/api/foundation';
import { fetchDepartments } from '@/src/api/lookups';
import { useAuth } from '@/src/auth/AuthContext';
import { CEO_TIER_ROLES, hasRole } from '@/src/auth/roles';
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

const FREQUENCIES = [
  { value: 'shift', label: 'shift' },
  { value: 'daily', label: 'daily' },
  { value: 'weekly', label: 'weekly' },
  { value: 'monthly', label: 'monthly' },
];

type FormState = {
  code: string;
  name: string;
  formula: string;
  target_value: string;
  frequency: string;
  department_id: string;
};

function emptyForm(): FormState {
  return {
    code: '',
    name: '',
    formula: '',
    target_value: '',
    frequency: 'shift',
    department_id: '',
  };
}

/**
 * P5-FND-AN — KPI definitions (port of AnalyticsPage).
 * Stored only — no auto-calculation yet.
 */
export function FoundationAnalyticsScreen() {
  const { user } = useAuth();
  const canWrite = user ? hasRole(user.role, CEO_TIER_ROLES) : false;

  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [k, d] = await Promise.all([fetchKpiDefinitions(), fetchDepartments()]);
      setKpis(k);
      setDepartments(d);
    } catch (e) {
      setError(getErrorMessage(e));
      setKpis([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const deptOptions = useMemo(
    () => [
      { value: '', label: 'All departments' },
      ...departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` })),
    ],
    [departments]
  );

  const openForm = () => {
    setForm(emptyForm());
    setShowForm(true);
    setMessage(null);
    setError(null);
  };

  const submit = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.formula.trim()) {
      setError('Code, name, and formula are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createKpiDefinition({
        code: form.code.trim(),
        name: form.name.trim(),
        formula: form.formula.trim(),
        target_value: form.target_value.trim() ? Number(form.target_value) : undefined,
        frequency: form.frequency || undefined,
        department_id: form.department_id || undefined,
      });
      setShowForm(false);
      setForm(emptyForm());
      setMessage(`Created: ${created.code}`);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !refreshing) {
    return <LoadingView message="Loading analytics…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Analytics Foundation</Text>
          <Text style={styles.subtitle}>
            KPI definitions (stored only — no auto-calculation yet).
          </Text>
        </View>
        {canWrite ? <Button title="Add KPI" onPress={openForm} size="sm" /> : null}
      </View>

      {!canWrite ? (
        <Text style={styles.readOnly}>View only — CEO-tier can create KPI definitions.</Text>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {showForm && canWrite ? (
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Add KPI</Text>
          <TextField
            label="Code"
            value={form.code}
            onChangeText={(code) => setForm((f) => ({ ...f, code }))}
            autoCapitalize="characters"
          />
          <TextField
            label="Name"
            value={form.name}
            onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          />
          <TextField
            label="Formula (text only)"
            value={form.formula}
            onChangeText={(formula) => setForm((f) => ({ ...f, formula }))}
            multiline
            numberOfLines={2}
          />
          <TextField
            label="Target value"
            value={form.target_value}
            onChangeText={(target_value) => setForm((f) => ({ ...f, target_value }))}
            keyboardType="decimal-pad"
            placeholder="Optional"
          />
          <SelectSheet
            label="Frequency"
            value={form.frequency}
            options={FREQUENCIES}
            onChange={(frequency) => setForm((f) => ({ ...f, frequency }))}
          />
          <SelectSheet
            label="Department"
            value={form.department_id}
            options={deptOptions}
            onChange={(department_id) => setForm((f) => ({ ...f, department_id }))}
          />
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

      {kpis.length === 0 ? (
        <EmptyState title="No KPI definitions" description="Create one to store a formula." />
      ) : (
        <View style={styles.list}>
          {kpis.map((k) => (
            <Card key={k.id} style={styles.row}>
              <Text style={styles.rowTitle}>
                {k.code} · {k.name}
              </Text>
              <Text style={styles.formula}>{k.formula}</Text>
              <View style={styles.metaRow}>
                {k.frequency ? <Badge label={k.frequency} tone="brand" /> : null}
                <Text style={styles.rowMeta}>
                  Target: {k.target_value != null ? String(k.target_value) : '—'}
                </Text>
              </View>
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
  readOnly: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
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
  formula: {
    ...typography.caption,
    color: colors.text,
    fontFamily: 'monospace',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowMeta: { ...typography.caption, color: colors.textMuted },
});
