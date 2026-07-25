import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Card } from '@/src/components/ui/Card';
import { Screen } from '@/src/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * Landing target for P3-SAFE-SCAN until P5-PULSE-WS ships full Asset Workspace.
 */
export default function AssetWorkspaceStub() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen scroll>
      <Text style={styles.title}>Asset Workspace</Text>
      <Text style={styles.sub}>
        Scan resolved this asset. Full workspace tabs land in P5-PULSE-WS.
      </Text>
      <Card>
        <Text style={styles.label}>Asset ID</Text>
        <Text style={styles.id} selectable>
          {id ?? '—'}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  sub: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  label: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  id: { ...typography.body, color: colors.text, fontWeight: '600' },
});
