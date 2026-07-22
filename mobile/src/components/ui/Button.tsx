import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { colors, radius, touch } from '@/src/theme/tokens';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type Props = PressableProps & {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        state.pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.brand : '#fff'} />
      ) : (
        <Text style={[styles.label, labelStyles[variant], size === 'lg' && styles.labelLg]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  fullWidth: { alignSelf: 'stretch', width: '100%' },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.55 },
  label: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  labelLg: { fontSize: 17, fontWeight: '700' },
});

const sizeStyles = StyleSheet.create({
  sm: { minHeight: 36, paddingVertical: 6 },
  md: { minHeight: touch.minTarget, paddingVertical: 12 },
  lg: { minHeight: touch.minTarget, paddingVertical: 14 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.brand },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: 'transparent' },
});

const labelStyles = StyleSheet.create({
  primary: { color: '#fff' },
  secondary: { color: colors.text },
  danger: { color: '#fff' },
  ghost: { color: colors.textMuted },
});
