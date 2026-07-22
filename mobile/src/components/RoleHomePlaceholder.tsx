import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/theme/tokens';

type Props = {
  title: string;
  description: string;
  nextChunk: string;
};

/** Shared placeholder until the real module chunk lands. */
export function RoleHomePlaceholder({ title, description, nextChunk }: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{description}</Text>
        <Text style={styles.meta}>Next: {nextChunk}</Text>
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
