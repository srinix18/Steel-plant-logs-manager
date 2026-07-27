import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { ApiError, getErrorMessage } from '@/src/api/client';
import {
  COST_CATEGORY_LABELS,
  computeRunCost,
  fetchRunCostSheet,
  formatCurrency,
  type RunCostSheet,
} from '@/src/api/finance';
import { useAuth } from '@/src/auth/AuthContext';
import { FINANCE_MASTERS_WRITE_ROLES, hasRole } from '@/src/auth/roles';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = { runId: string };

/**
 * P5-FIN-SHEET — run cost sheet (port of RunCostSheetPage).
 */
export function RunCostSheetScreen({ runId }: Props) {
  const { user } = useAuth();
  const canCompute = user ? hasRole(user.role, FINANCE_MASTERS_WRITE_ROLES) : false;

  const [sheet, setSheet] = useState<RunCostSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noCalc, setNoCalc] = useState(false);

  const load = useCallback(
    async (soft = false) => {
      if (!runId) return;
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchRunCostSheet(runId);
        setSheet(data);
        setNoCalc(false);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          setSheet(null);
          setNoCalc(true);
          setError(null);
        } else {
          setSheet(null);
          setNoCalc(false);
          setError(getErrorMessage(e));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [runId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleCompute = async () => {
    setComputing(true);
    setError(null);
    try {
      await computeRunCost(runId);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setComputing(false);
    }
  };

  if (loading && !refreshing) {
    return <LoadingView message="Loading cost sheet…" />;
  }

  if (!sheet) {
    return (
      <Screen scroll>
        <Pressable onPress={() => router.push('/(app)/finance/dashboard' as Href)}>
          <Text style={styles.back}>← Finance Dashboard</Text>
        </Pressable>
        {error ? <ErrorBanner message={error} /> : null}
        {noCalc ? (
          <EmptyState
            title="No cost calculation for this run yet."
            description={
              canCompute
                ? 'Calculate to generate line items.'
                : 'Ask a plant admin / CEO to compute costs.'
            }
            actionLabel={canCompute ? 'Calculate Cost' : undefined}
            onAction={canCompute ? () => void handleCompute() : undefined}
          />
        ) : (
          <EmptyState title="Cost sheet unavailable" />
        )}
        {canCompute && error && !noCalc ? (
          <Button
            title="Calculate Cost"
            onPress={() => void handleCompute()}
            loading={computing}
            style={styles.computeBtn}
          />
        ) : null}
        {canCompute && noCalc && computing ? (
          <Text style={styles.hint}>Computing…</Text>
        ) : null}
      </Screen>
    );
  }

  const calc = sheet.calculation;

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Pressable onPress={() => router.push('/(app)/finance/dashboard' as Href)}>
            <Text style={styles.back}>← Finance Dashboard</Text>
          </Pressable>
          <Text style={styles.title}>Run Cost Sheet — {sheet.run_number}</Text>
          <Text style={styles.subtitle}>
            {sheet.department_code || '—'} / {sheet.process_code || '—'} · v{calc.version} ·{' '}
            {calc.status}
          </Text>
        </View>
        {canCompute ? (
          <Button
            title="Recalculate"
            size="sm"
            onPress={() => void handleCompute()}
            loading={computing}
          />
        ) : null}
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {(calc.status === 'partial' || calc.status === 'failed') && (
        <Card style={styles.warnCard}>
          <Text style={styles.warnTitle}>
            Cost calculation {calc.status === 'partial' ? 'partially completed' : 'failed'}.
          </Text>
          <Text style={styles.warnBody}>
            Raw material costs require saved charge mix / ferro alloy rows with material and
            quantity. Check warnings below.
          </Text>
        </Card>
      )}

      {calc.warnings?.length > 0 ? (
        <Card style={styles.amberCard}>
          {calc.warnings.map((w, i) => (
            <Text key={i} style={styles.amberText}>
              {w}
            </Text>
          ))}
        </Card>
      ) : null}

      <Card style={styles.totalCard}>
        <Text style={styles.totalValue}>{formatCurrency(calc.total_cost)}</Text>
        <Text style={styles.totalLabel}>Total operational cost</Text>
      </Card>

      <Text style={styles.section}>Category Contribution</Text>
      {sheet.breakdown.length === 0 ? (
        <EmptyState title="No breakdown." />
      ) : (
        <View style={styles.list}>
          {sheet.breakdown.map((r) => (
            <Card key={r.category} style={styles.row}>
              <Text style={styles.rowTitle}>
                {COST_CATEGORY_LABELS[r.category] || r.category}
              </Text>
              <Text style={styles.rowMeta}>
                {formatCurrency(r.amount)} · {r.percentage}%
              </Text>
            </Card>
          ))}
        </View>
      )}

      <Text style={styles.section}>Line Items</Text>
      {calc.line_items.length === 0 ? (
        <EmptyState title="No line items." />
      ) : (
        <View style={styles.list}>
          {calc.line_items.map((item) => (
            <Card key={item.id} style={styles.row}>
              <View style={styles.itemHeader}>
                <Text style={styles.rowTitle}>{item.item_name}</Text>
                <Badge
                  label={COST_CATEGORY_LABELS[item.cost_category] || item.cost_category}
                  tone="neutral"
                />
              </View>
              <Text style={styles.rowMeta}>
                {item.quantity} {item.unit} × {formatCurrency(item.rate)} ={' '}
                {formatCurrency(item.amount)}
              </Text>
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
  back: {
    ...typography.caption,
    color: colors.brand,
    marginBottom: spacing.xs,
  },
  title: { ...typography.title, color: colors.text },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  computeBtn: { marginTop: spacing.md },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  warnCard: {
    marginBottom: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  warnTitle: { ...typography.body, fontWeight: '600', color: colors.danger },
  warnBody: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  amberCard: {
    marginBottom: spacing.sm,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    gap: spacing.xs,
  },
  amberText: { ...typography.caption, color: '#92400E' },
  totalCard: { marginBottom: spacing.md, gap: spacing.xs },
  totalValue: { ...typography.title, color: colors.text, fontSize: 28 },
  totalLabel: { ...typography.caption, color: colors.textMuted },
  section: {
    ...typography.section,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  list: { gap: spacing.sm },
  row: { gap: spacing.xs },
  itemHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  rowMeta: { ...typography.caption, color: colors.textMuted },
});
