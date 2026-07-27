import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkOptional } from '@/src/offline/NetworkContext';
import { spacing, typography } from '@/src/theme/tokens';

/**
 * Global offline / draft-sync banner (P6-OFFLINE / Q8).
 */
export function OfflineBanner() {
  const net = useNetworkOptional();
  const insets = useSafeAreaInsets();

  if (!net) return null;
  const { isOnline, pendingCount, syncing, retrySync } = net;

  if (isOnline && pendingCount === 0 && !syncing) return null;

  let message: string;
  if (!isOnline) {
    message =
      pendingCount > 0
        ? `You're offline. ${pendingCount} draft save(s) queued — will retry when online.`
        : "You're offline. Failed saves will be queued — never lost silently.";
  } else if (syncing) {
    message = 'Syncing queued draft saves…';
  } else {
    message = `${pendingCount} draft save(s) waiting to sync.`;
  }

  return (
    <View
      style={[styles.wrap, { paddingTop: Math.max(insets.top, spacing.sm) }]}
      accessibilityRole="alert"
    >
      <Text style={styles.text}>{message}</Text>
      {isOnline && pendingCount > 0 && !syncing ? (
        <Pressable
          onPress={() => void retrySync()}
          accessibilityRole="button"
          style={styles.retry}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#92400E',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    ...typography.caption,
    color: '#FFFBEB',
    flex: 1,
    fontWeight: '600',
    lineHeight: 18,
  },
  retry: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    minHeight: 48,
    justifyContent: 'center',
  },
  retryText: {
    ...typography.caption,
    color: '#92400E',
    fontWeight: '700',
  },
});
