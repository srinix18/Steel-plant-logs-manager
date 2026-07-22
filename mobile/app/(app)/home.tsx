import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/theme/tokens';

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>MOI app shell</Text>
        <Text style={styles.body}>
          BUILD CHUNK P1-01 scaffold is live (Expo SDK 54 — Play Store Expo Go). Open the drawer
          for Home and Profile.
        </Text>
        <Text style={styles.meta}>Next: P1-02 — API client + SecureStore</Text>
        <Text style={styles.meta}>Then: P1-03 — Login form · P1-04 — Role home · P1-05 — Full drawer</Text>
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
