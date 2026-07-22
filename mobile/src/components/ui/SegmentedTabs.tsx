import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, touch, typography } from '@/src/theme/tokens';

export type Segment = {
  key: string;
  label: string;
};

type Props = {
  segments: Segment[];
  value: string;
  onChange: (key: string) => void;
};

export function SegmentedTabs({ segments, value, onChange }: Props) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {segments.map((seg) => {
        const active = seg.key === value;
        return (
          <Pressable
            key={seg.key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(seg.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={seg.label}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.button,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: touch.minTarget - 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button - 2,
    paddingHorizontal: spacing.sm,
  },
  tabActive: { backgroundColor: colors.card },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textMuted,
  },
  labelActive: { color: colors.brandDark },
});
