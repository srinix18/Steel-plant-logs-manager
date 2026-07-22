import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, touch, typography } from '@/src/theme/tokens';

/**
 * Login shell for P1-01. Full form + API wired in P1-02 / P1-03.
 */
export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.brand}>MOI Platform</Text>
        <Text style={styles.subtitle}>Chandan Steel — Manufacturing Operations</Text>
        <Text style={styles.body}>
          Login UI and JWT auth land in chunks P1-02 and P1-03. Open the app shell to verify
          navigation.
        </Text>

        <Link href="/(app)/home" asChild>
          <Pressable style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>Continue to app shell</Text>
          </Pressable>
        </Link>

        {__DEV__ ? (
          <Text style={styles.devHint}>
            Dev: set EXPO_PUBLIC_API_URL to http://YOUR-LAN-IP:8000/api/v1 before P1-02.
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  brand: {
    ...typography.title,
    color: colors.brand,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  body: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand,
    borderRadius: radius.button,
    minHeight: touch.minTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  devHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
