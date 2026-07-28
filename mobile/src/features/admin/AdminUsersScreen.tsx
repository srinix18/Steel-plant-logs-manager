import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import {
  fetchOrganisations,
  fetchUsers,
  type Organisation,
} from '@/src/api/admin';
import { getErrorMessage } from '@/src/api/client';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { VirtualList } from '@/src/components/ui/VirtualList';
import type { User } from '@/src/types/user';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * P5-ADM-USERS — list-only platform users (port of AdminUsersPage).
 * Create/edit belongs in P5-EXE-EMP (`/organisations/{orgId}/users`).
 * FlatList virtualization (P6-PERF).
 */
export function AdminUsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [u, o] = await Promise.all([fetchUsers(), fetchOrganisations()]);
      setUsers(u);
      setOrganisations(o);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const orgName = (id?: string | null) =>
    organisations.find((o) => o.id === id)?.name ?? '—';

  if (loading && !refreshing) {
    return <LoadingView message="Loading users…" />;
  }

  return (
    <VirtualList
      data={users}
      keyExtractor={(u) => u.id}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      header={
        <>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.subtitle}>
            Platform users and their roles across organisations. Create and edit employees in
            Executive → Employees.
          </Text>
          {error ? <ErrorBanner message={error} /> : null}
        </>
      }
      empty={<EmptyState title="No users found." />}
      renderItem={({ item: u }) => (
        <Card style={styles.row}>
          <Text style={styles.rowTitle}>{u.full_name}</Text>
          <Text style={styles.rowMeta}>{u.email}</Text>
          <Text style={styles.rowMeta}>Role: {u.role.replace(/_/g, ' ')}</Text>
          <Text style={styles.rowMeta}>Org: {orgName(u.organisation_id)}</Text>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  row: { gap: spacing.xs, marginBottom: spacing.sm },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  rowMeta: { ...typography.caption, color: colors.textMuted },
});
