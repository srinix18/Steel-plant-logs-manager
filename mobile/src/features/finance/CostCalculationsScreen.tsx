import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { bulkComputeCosts, type BulkComputeResult } from '@/src/api/finance';
import { fetchDepartments, fetchPlants } from '@/src/api/lookups';
import { useAuth } from '@/src/auth/AuthContext';
import { FINANCE_MASTERS_WRITE_ROLES, hasRole } from '@/src/auth/roles';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * P5-FIN-CALC — bulk cost recalculation (port of CostCalculationsPage).
 */
export function CostCalculationsScreen() {
  const { user } = useAuth();
  const canWrite = user ? hasRole(user.role, FINANCE_MASTERS_WRITE_ROLES) : false;

  const [plantId, setPlantId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [departments, setDepartments] = useState<{ id: string; code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkComputeResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plants, depts] = await Promise.all([fetchPlants(), fetchDepartments()]);
      const pid = plantId || plants[0]?.id || '';
      if (!plantId && pid) setPlantId(pid);
      setDepartments(
        depts
          .filter((d) => !pid || d.plant_id === pid)
          .map((d) => ({ id: d.id, code: d.code, name: d.name }))
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [plantId]);

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

  const handleBulk = async () => {
    if (!canWrite) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await bulkComputeCosts({
        plant_id: plantId || undefined,
        department_id: departmentId || undefined,
        from_date: fromDate.trim() || undefined,
        to_date: toDate.trim() || undefined,
      });
      setResult(res);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <LoadingView message="Loading…" />;
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Cost Calculations</Text>
      <Text style={styles.subtitle}>
        Bulk recalculate costs after updating masters or mappings. If raw material shows ₹0, ensure
        process runs have saved charge mix rows with materials before closing the run.
      </Text>

      {error ? <ErrorBanner message={error} /> : null}

      {canWrite ? (
        <Card style={styles.card}>
          <SelectSheet
            label="Department (optional)"
            placeholder="All departments"
            options={deptOptions}
            value={departmentId}
            onChange={setDepartmentId}
          />
          <TextField
            label="From date"
            value={fromDate}
            onChangeText={setFromDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
          <TextField
            label="To date"
            value={toDate}
            onChangeText={setToDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
          <Button
            title={running ? 'Running…' : 'Bulk Compute'}
            onPress={() => void handleBulk()}
            loading={running}
            disabled={running}
          />
          {result ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Result</Text>
              <Text style={styles.resultText}>
                Computed: {result.computed} · Failed: {result.failed} · Skipped: {result.skipped}
              </Text>
            </View>
          ) : null}
        </Card>
      ) : (
        <Text style={styles.readOnly}>
          Read-only access. Contact plant admin to run bulk calculations.
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  card: { gap: spacing.sm },
  resultBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  resultLabel: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  resultText: { ...typography.body, color: colors.text, fontWeight: '600' },
  readOnly: { ...typography.body, color: colors.textMuted },
});
