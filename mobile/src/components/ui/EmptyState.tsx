import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="secondary" style={styles.btn} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.section,
    color: colors.text,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: { marginTop: spacing.sm, minWidth: 160 },
});
