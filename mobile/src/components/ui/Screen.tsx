import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/src/theme/tokens';

type Props = ViewProps & {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  footer?: ReactNode;
};

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['bottom'],
  footer,
  style,
  ...rest
}: Props) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.padded, footer ? styles.footerPad : null]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, footer ? styles.footerPad : null, style]} {...rest}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {body}
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  padded: { padding: spacing.md },
  footerPad: { paddingBottom: 96 },
});
