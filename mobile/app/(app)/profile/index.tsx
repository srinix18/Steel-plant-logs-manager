import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/src/auth/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Screen } from '@/src/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * Profile placeholder — full form in P1-07. Uses P1-06 primitives.
 */
export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function onLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.body}>{user?.full_name ?? '—'}</Text>
        <Text style={styles.meta}>{user?.email}</Text>
        <View style={styles.badgeRow}>
          <Badge label={user?.role?.replace(/_/g, ' ') ?? 'unknown'} tone="brand" />
        </View>
        <Text style={styles.meta}>Full profile editor lands in P1-07.</Text>

        <Button
          title="Log out"
          variant="danger"
          fullWidth
          loading={loggingOut}
          onPress={onLogout}
          style={styles.logout}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  badgeRow: {
    marginVertical: spacing.xs,
  },
  logout: {
    marginTop: spacing.md,
  },
});
