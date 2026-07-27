import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  createFoundationCorrectiveAction,
  fetchFoundationCorrectiveActions,
  fetchFoundationObservations,
  updateFoundationCorrectiveAction,
  type FoundationCorrectiveAction,
  type FoundationObservation,
} from '@/src/api/foundation';
import { fetchPlantUsers, fetchPlants } from '@/src/api/lookups';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import type { User } from '@/src/types/user';
import { colors, spacing, typography } from '@/src/theme/tokens';

type FormState = {
  observation_id: string;
  title: string;
  assigned_to: string;
  due_date: string;
};

function emptyForm(obsId = '', userId = ''): FormState {
  return {
    observation_id: obsId,
    title: '',
    assigned_to: userId,
    due_date: '',
  };
}

function statusTone(status: string): 'success' | 'danger' | 'brand' | 'neutral' {
  const key = status.toLowerCase();
  if (key === 'closed') return 'success';
  if (key === 'overdue') return 'danger';
  if (key === 'open' || key === 'in_progress') return 'brand';
  return 'neutral';
}

/**
 * P5-FND-CA — corrective actions from observations (port of CorrectiveActionsPage).
 */
export function FoundationCorrectiveActionsScreen() {
  const [plantId, setPlantId] = useState('');
  const [actions, setActions] = useState<FoundationCorrectiveAction[]>([]);
  const [observations, setObservations] = useState<FoundationObservation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
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
        const [a, o, u] = await Promise.all([
          fetchFoundationCorrectiveActions({ plant_id: pid || undefined }),
          fetchFoundationObservations({ plant_id: pid || undefined }),
          pid ? fetchPlantUsers(pid).catch(() => [] as User[]) : Promise.resolve([] as User[]),
        ]);
        setActions(a);
        setObservations(o);
        setUsers(u);
      } catch (e) {
        setError(getErrorMessage(e));
        setActions([]);
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

  const obsOptions = useMemo(
    () =>
      observations.map((o) => ({
        value: o.id,
        label: o.title || o.description.slice(0, 50),
      })),
    [observations]
  );

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: u.full_name || u.email,
      })),
    [users]
  );

  const openForm = () => {
    setForm(emptyForm(observations[0]?.id || '', users[0]?.id || ''));
    setShowForm(true);
    setMessage(null);
    setError(null);
  };

  const submit = async () => {
    if (!form.observation_id || !form.title.trim() || !form.assigned_to) {
      setError('Observation, title, and assignee are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createFoundationCorrectiveAction(form.observation_id, {
        title: form.title.trim(),
        assigned_to: form.assigned_to,
        due_date: form.due_date.trim() || undefined,
      });
      setShowForm(false);
      setForm(emptyForm());
      setMessage(`Created: ${created.title}`);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const closeAction = async (id: string) => {
    setClosingId(id);
    setError(null);
    try {
      await updateFoundationCorrectiveAction(id, {
        status: 'closed',
        closure_notes: 'Completed via foundation UI',
      });
      setMessage('Action closed.');
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setClosingId(null);
    }
  };

  if (loading && !refreshing) {
    return <LoadingView message="Loading corrective actions…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Corrective Actions</Text>
          <Text style={styles.subtitle}>Track actions from observations.</Text>
        </View>
        <Button title="New" onPress={openForm} size="sm" />
      </View>

      {error ? <ErrorBanner message={error} /> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {showForm ? (
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>New action</Text>
          {obsOptions.length === 0 ? (
            <Text style={styles.hint}>Create an observation first.</Text>
          ) : (
            <SelectSheet
              label="Observation"
              value={form.observation_id}
              options={obsOptions}
              onChange={(observation_id) => setForm((f) => ({ ...f, observation_id }))}
            />
          )}
          <TextField
            label="Action title"
            value={form.title}
            onChangeText={(title) => setForm((f) => ({ ...f, title }))}
          />
          {userOptions.length === 0 ? (
            <Text style={styles.hint}>No plant users to assign.</Text>
          ) : (
            <SelectSheet
              label="Assign to"
              value={form.assigned_to}
              options={userOptions}
              onChange={(assigned_to) => setForm((f) => ({ ...f, assigned_to }))}
            />
          )}
          <TextField
            label="Due date (YYYY-MM-DD)"
            value={form.due_date}
            onChangeText={(due_date) => setForm((f) => ({ ...f, due_date }))}
            placeholder="Optional"
            autoCapitalize="none"
          />
          <View style={styles.formActions}>
            <Button
              title="Save"
              onPress={() => void submit()}
              loading={saving}
              disabled={obsOptions.length === 0 || userOptions.length === 0}
            />
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setShowForm(false)}
              disabled={saving}
            />
          </View>
        </Card>
      ) : null}

      {actions.length === 0 ? (
        <EmptyState title="No corrective actions" description="Create one from an observation." />
      ) : (
        <View style={styles.list}>
          {actions.map((a) => (
            <Card key={a.id} style={styles.row}>
              <Text style={styles.rowTitle}>{a.title}</Text>
              <Text style={styles.rowMeta}>{a.observation_title || '—'}</Text>
              <View style={styles.badges}>
                <Badge label={a.status} tone={statusTone(a.status)} />
                <Text style={styles.rowMeta}>Due: {a.due_date || '—'}</Text>
              </View>
              {a.status !== 'closed' ? (
                <Button
                  title="Close"
                  size="sm"
                  variant="secondary"
                  onPress={() => void closeAction(a.id)}
                  loading={closingId === a.id}
                />
              ) : null}
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
  hint: { ...typography.caption, color: colors.textMuted },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  list: { gap: spacing.sm },
  row: { gap: spacing.xs },
  rowTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  rowMeta: { ...typography.caption, color: colors.textMuted },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
