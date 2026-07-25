import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import {
  PEEL_BLOCKED_DESCRIPTION,
  PEEL_BLOCKED_TITLE,
} from '@/src/features/peel/peelBlocked';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * P2-BBD-PEEL — blocked empty state (no fake template / JSON editors).
 */
export function PeelBlockedScreen() {
  return (
    <Screen scroll>
      <Text style={styles.heading}>Bright Bar — Peeling</Text>
      <View style={styles.body}>
        <EmptyState title={PEEL_BLOCKED_TITLE} description={PEEL_BLOCKED_DESCRIPTION} />
      </View>
      <Text style={styles.meta}>
        Chunk P2-BBD-PEEL · Unblocks when seed_peel lands · Next: P2-FORGE-GRIND
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.md,
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 220,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
