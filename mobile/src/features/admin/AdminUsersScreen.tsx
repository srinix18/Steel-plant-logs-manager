import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
import { Screen } from '@/src/components/ui/Screen';
import type { User } from '@/src/types/user';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * P5-ADM-USERS — list-only platform users (port of AdminUsersPage).
 * Create/edit belongs in P5-EXE-EMP (`/organisations/{orgId}/users`).
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
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Users</Text>
      <Text style={styles.subtitle}>
        Platform users and their roles across organisations. Create and edit employees in Executive
        → Employees.
      </Text>

      {error ? <ErrorBanner message={error} /> : null}

      {users.length === 0 ? (
        <EmptyState title="No users found." />
      ) : (
        <View style={styles.list}>
          {users.map((u) => (
            <Card key={u.id} style={styles.row}>
              <Text style={styles.rowTitle}>{u.full_name}</Text>
              <Text style={styles.rowMeta}>{u.email}</Text>
              <Text style={styles.rowMeta}>
                Role: {u.role.replace(/_/g, ' ')}
              </Text>
              <Text style={styles.rowMeta}>Org: {orgName(u.organisation_id)}</Text>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  list: { gap: spacing.sm, marginBottom: spacing.md },
  row: { gap: spacing.xs },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  rowMeta: { ...typography.caption, color: colors.textMuted },
});
