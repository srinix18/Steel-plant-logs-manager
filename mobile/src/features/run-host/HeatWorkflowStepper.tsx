import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { workflowStepsForUi } from '@/src/utils/heatWorkflowUi';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = {
  currentState: string;
};

/** IAF lifecycle chips — Start → Power on → Sample → … → Closed (P2-SMS-IAF). */
export function HeatWorkflowStepper({ currentState }: Props) {
  const steps = workflowStepsForUi(currentState);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {steps.map((step, idx) => (
        <View key={step.key} style={styles.item}>
          <View
            style={[
              styles.chip,
              step.isCurrent && styles.chipCurrent,
              step.isComplete && !step.isCurrent && styles.chipDone,
            ]}
          >
            <View
              style={[
                styles.num,
                step.isCurrent && styles.numCurrent,
                step.isComplete && !step.isCurrent && styles.numDone,
              ]}
            >
              <Text
                style={[
                  styles.numText,
                  (step.isCurrent || step.isComplete) && styles.numTextActive,
                ]}
              >
                {step.isComplete && !step.isCurrent ? '✓' : idx + 1}
              </Text>
            </View>
            <Text
              style={[
                styles.label,
                step.isCurrent && styles.labelCurrent,
                step.isComplete && !step.isCurrent && styles.labelDone,
              ]}
            >
              {step.label}
            </Text>
          </View>
          {idx < steps.length - 1 ? (
            <View style={[styles.line, step.isComplete && styles.lineDone]} />
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginBottom: spacing.sm },
  row: { alignItems: 'center', paddingVertical: 2 },
  item: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.background,
  },
  chipCurrent: { backgroundColor: colors.brand },
  chipDone: { backgroundColor: colors.brandSoft },
  num: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border,
  },
  numCurrent: { backgroundColor: 'rgba(255,255,255,0.25)' },
  numDone: { backgroundColor: '#BFDBFE' },
  numText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  numTextActive: { color: colors.brandDark },
  label: { ...typography.caption, fontWeight: '600', color: colors.textMuted },
  labelCurrent: { color: '#fff' },
  labelDone: { color: colors.brandDark },
  line: { width: 16, height: 1, backgroundColor: colors.border, marginHorizontal: 2 },
  lineDone: { backgroundColor: '#93C5FD' },
});
