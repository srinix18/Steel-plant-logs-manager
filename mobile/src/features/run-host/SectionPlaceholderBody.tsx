import { StyleSheet, Text, View } from 'react-native';

import type { CardStepKind } from '@/src/features/run-host/buildCardSteps';
import type { TemplateSection } from '@/src/types/processRun';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = {
  section: TemplateSection;
  stepKind?: CardStepKind;
};

/** Placeholder until P2-ENGINE-03 section adapters. Save still PATCHes existing section_data. */
export function SectionPlaceholderBody({ section, stepKind }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{section.title}</Text>
      <Text style={styles.body}>
        Section <Text style={styles.mono}>{section.section_type}</Text>
        {stepKind ? (
          <>
            {' '}
            · card <Text style={styles.mono}>{stepKind}</Text>
          </>
        ) : null}{' '}
        — full editor lands in P2-ENGINE-03. Pull to refresh or Save to keep the stored section
        payload.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { ...typography.section, color: colors.text },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
  mono: { fontFamily: 'monospace', color: colors.text },
});
