import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, touch, typography } from '@/src/theme/tokens';

export type SelectOption<T extends string = string> = {
  label: string;
  value: T;
};

type Props<T extends string = string> = {
  label?: string;
  placeholder?: string;
  options: SelectOption<T>[];
  value?: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
};

export function SelectSheet<T extends string = string>({
  label,
  placeholder = 'Select…',
  options,
  value,
  onChange,
  disabled,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={[styles.trigger, disabled && styles.disabled]}
        onPress={() => !disabled && setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{label ?? 'Select'}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {item.label}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={18} color={colors.brand} /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
  },
  trigger: {
    minHeight: touch.minTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    gap: spacing.sm,
  },
  disabled: { opacity: 0.55 },
  triggerText: { flex: 1, fontSize: 16, color: colors.text },
  placeholder: { color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)' },
  sheet: {
    maxHeight: '55%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { ...typography.section, color: colors.text },
  close: { color: colors.brand, fontWeight: '600', fontSize: 15 },
  option: {
    minHeight: touch.listRow,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionActive: { backgroundColor: colors.brandSoft },
  optionText: { fontSize: 16, color: colors.text },
  optionTextActive: { color: colors.brandDark, fontWeight: '600' },
});
