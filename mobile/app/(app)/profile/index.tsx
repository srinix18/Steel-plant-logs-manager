import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/src/auth/AuthContext';
import { colors, radius, spacing, touch, typography } from '@/src/theme/tokens';

/**
 * Profile placeholder — full screen in P1-07. Logout here for P1-02 acceptance.
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
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.body}>{user?.full_name ?? '—'}</Text>
        <Text style={styles.meta}>{user?.email}</Text>
        <Text style={styles.meta}>Role: {user?.role}</Text>
        <Text style={styles.meta}>Full profile UI lands in P1-07.</Text>

        <Pressable
          style={styles.logout}
          accessibilityRole="button"
          onPress={onLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={styles.logoutText}>Log out</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
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
  logout: {
    marginTop: spacing.md,
    minHeight: touch.minTarget,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  logoutText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
});
