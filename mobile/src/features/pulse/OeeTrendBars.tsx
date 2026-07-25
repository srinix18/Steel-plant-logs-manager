import { StyleSheet, Text, View } from 'react-native';

import type { OEETrendPoint } from '@/src/api/oee';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

type Props = {
  data: OEETrendPoint[];
  title?: string;
};

/** Simple horizontal bar list (phone-friendly substitute for web Recharts). */
export function OeeTrendBars({ data, title }: Props) {
  const chartData = [...data].reverse().map((d) => ({
    label: new Date(d.period_start).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
    oee: Math.round(d.oee * 100),
  }));

  if (!chartData.length) {
    return <Text style={styles.empty}>No OEE trend data yet.</Text>;
  }

  return (
    <View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {chartData.map((d) => (
        <View key={d.label} style={styles.row}>
          <Text style={styles.label}>{d.label}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, d.oee)}%` }]} />
          </View>
          <Text style={styles.pct}>{d.oee}%</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { ...typography.body, color: colors.textMuted },
  title: { ...typography.caption, color: colors.text, fontWeight: '600', marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  label: { ...typography.caption, color: colors.textMuted, width: 52 },
  track: {
    flex: 1,
    height: 10,
    borderRadius: radius.button,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.button,
    backgroundColor: colors.brand,
  },
  pct: { ...typography.caption, color: colors.text, fontWeight: '600', width: 36, textAlign: 'right' },
});
