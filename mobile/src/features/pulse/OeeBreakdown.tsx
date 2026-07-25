import { StyleSheet, Text, View } from 'react-native';

import type { OEEMetrics } from '@/src/api/pulse';
import { formatOeePct } from '@/src/api/pulse';
import { Badge } from '@/src/components/ui/Badge';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = OEEMetrics;

/** Shared OEE A/P/Q breakdown (port of web OeeBreakdown). */
export function OeeBreakdown({ availability, performance, quality, oee, is_estimated }: Props) {
  const rows = [
    { label: 'Availability', value: availability },
    { label: 'Performance', value: performance },
    { label: 'Quality', value: quality },
  ];

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.oeeValue}>{formatOeePct(oee, 1)}</Text>
        <Text style={styles.oeeLabel}>OEE</Text>
        {is_estimated ? <Badge label="estimated" tone="brand" /> : null}
      </View>
      {rows.map((r) => (
        <View key={r.label} style={styles.row}>
          <View style={styles.rowTop}>
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Text style={styles.rowPct}>{formatOeePct(r.value)}</Text>
          </View>
          <ProgressBar progress={r.value} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  oeeValue: { ...typography.title, color: colors.brandDark, fontSize: 28 },
  oeeLabel: { ...typography.caption, color: colors.textMuted },
  row: { marginBottom: spacing.sm, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { ...typography.caption, color: colors.textMuted },
  rowPct: { ...typography.caption, color: colors.text, fontWeight: '600' },
});
