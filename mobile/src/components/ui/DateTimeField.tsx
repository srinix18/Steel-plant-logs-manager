import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, touch, typography } from '@/src/theme/tokens';

type Mode = 'date' | 'time' | 'datetime';

type Props = {
  label?: string;
  value: Date | null;
  onChange: (value: Date) => void;
  mode?: Mode;
  disabled?: boolean;
};

function formatValue(value: Date | null, mode: Mode): string {
  if (!value) return '';
  if (mode === 'date') return value.toLocaleDateString();
  if (mode === 'time') return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${value.toLocaleDateString()} ${value.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function DateTimeField({
  label,
  value,
  onChange,
  mode = 'date',
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const display = formatValue(value, mode) || 'Select…';

  function onPickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'dismissed') return;
    }
    if (selected) onChange(selected);
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={[styles.trigger, disabled && styles.disabled]}
        onPress={() => !disabled && setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Date'}
      >
        <Text style={[styles.triggerText, !value && styles.placeholder]}>{display}</Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
      </Pressable>

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode={mode === 'datetime' ? 'date' : mode}
          onChange={onPickerChange}
        />
      ) : null}

      {open && Platform.OS === 'ios' ? (
        <Modal transparent animationType="slide" visible onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <SafeAreaView style={styles.sheet} edges={['bottom']}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label ?? 'Select'}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.done}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={value ?? new Date()}
              mode={mode === 'datetime' ? 'datetime' : mode}
              display="spinner"
              onChange={onPickerChange}
              style={styles.iosPicker}
            />
          </SafeAreaView>
        </Modal>
      ) : null}

      {/* web / fallback */}
      {open && Platform.OS === 'web' ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.webCard}>
            <Text style={styles.sheetTitle}>{label ?? 'Select date'}</Text>
            <Text style={styles.webHint}>Use device date controls in native builds.</Text>
            <Pressable
              style={styles.webBtn}
              onPress={() => {
                onChange(new Date());
                setOpen(false);
              }}
            >
              <Text style={styles.done}>Use now</Text>
            </Pressable>
          </View>
        </Modal>
      ) : null}
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
  done: { color: colors.brand, fontWeight: '700', fontSize: 16 },
  iosPicker: { alignSelf: 'stretch' },
  webCard: {
    margin: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  webHint: { ...typography.caption, color: colors.textMuted },
  webBtn: { minHeight: touch.minTarget, justifyContent: 'center' },
});
