import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, touch, typography } from '@/src/theme/tokens';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  /** Enables show/hide toggle for password fields. */
  passwordToggle?: boolean;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, passwordToggle, secureTextEntry, style, ...rest },
  ref
) {
  const [visible, setVisible] = useState(false);
  const isSecure = Boolean(secureTextEntry) && !visible;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.row, error ? styles.rowError : null]}>
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={passwordToggle ? isSecure : secureTextEntry}
          {...rest}
        />
        {passwordToggle ? (
          <Pressable
            style={styles.eye}
            onPress={() => setVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            hitSlop={8}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.card,
    minHeight: touch.minTarget,
  },
  rowError: { borderColor: colors.danger },
  input: {
    flex: 1,
    minHeight: touch.minTarget,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  eye: {
    minWidth: touch.minTarget,
    minHeight: touch.minTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
