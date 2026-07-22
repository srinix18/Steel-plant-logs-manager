import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = {
  message?: string;
};

export function LoadingView({ message }: Props) {
  return (
    <View style={styles.wrap} accessibilityLabel={message ?? 'Loading'}>
      <ActivityIndicator size="large" color={colors.brand} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  message: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
