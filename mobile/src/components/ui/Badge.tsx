import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/theme/tokens';

type Tone = 'neutral' | 'brand' | 'success' | 'danger';

type Props = {
  label: string;
  tone?: Tone;
};

export function Badge({ label, tone = 'neutral' }: Props) {
  return (
    <View style={[styles.base, toneStyles[tone]]}>
      <Text style={[styles.text, textStyles[tone]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
  },
});

const toneStyles = StyleSheet.create({
  neutral: { backgroundColor: colors.background },
  brand: { backgroundColor: colors.brandSoft },
  success: { backgroundColor: '#DCFCE7' },
  danger: { backgroundColor: '#FEE2E2' },
});

const textStyles = StyleSheet.create({
  neutral: { color: colors.textMuted },
  brand: { color: colors.brandDark },
  success: { color: colors.success },
  danger: { color: colors.danger },
});
