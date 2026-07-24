import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/src/theme/tokens';

type Props = {
  /** 0–1 progress fraction */
  progress: number;
};

export function ProgressBar({ progress }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={styles.track} accessibilityRole="progressbar">
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: radius.button,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.button,
    backgroundColor: colors.brand,
  },
});
