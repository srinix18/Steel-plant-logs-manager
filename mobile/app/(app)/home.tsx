import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/src/auth/AuthContext';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

export default function HomeScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>MOI app shell</Text>
        <Text style={styles.body}>
          Signed in as {user?.full_name} ({user?.role}). Session is stored in SecureStore
          (P1-02).
        </Text>
        <Text style={styles.meta}>Next: P1-03 — Login UI polish · P1-04 — Role home</Text>
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
    marginTop: spacing.xs,
  },
});
