import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchPlants } from '@/src/api/lookups';
import { useAuth } from '@/src/auth/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';

export type SafetyListRow = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: 'neutral' | 'brand' | 'success' | 'danger';
};

type Props = {
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyDescription: string;
  loadRows: (plantId: string) => Promise<SafetyListRow[]>;
};

/**
 * Shared plant-scoped safety list shell (P3-SAFE-LISTS).
 */
export function SafetyListScreen({
  title,
  subtitle,
  emptyTitle,
  emptyDescription,
  loadRows,
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SafetyListRow[]>([]);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const plants = await fetchPlants();
        const plantId =
          (user?.plant_id && plants.find((p) => p.id === user.plant_id)?.id) || plants[0]?.id;
        if (!plantId) {
          setRows([]);
          setError('No plant available.');
          return;
        }
        setRows(await loadRows(plantId));
      } catch (e) {
        setError(getErrorMessage(e));
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadRows, user?.plant_id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && rows.length === 0 && !error) {
    return <LoadingView message={`Loading ${title.toLowerCase()}…`} />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{subtitle}</Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {!error && rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        rows.map((row) => (
          <Card key={row.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.textCol}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                {row.subtitle ? <Text style={styles.meta}>{row.subtitle}</Text> : null}
              </View>
              {row.badge ? (
                <Badge label={row.badge} tone={row.badgeTone ?? 'neutral'} />
              ) : null}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  sub: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  banner: { marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  textCol: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
});
