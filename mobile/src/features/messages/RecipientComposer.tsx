import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Department } from '@/src/types/platform';
import type { User } from '@/src/types/user';
import {
  buildRecipientSuggestions,
  suggestionToToken,
  tokenKey,
  type RecipientSuggestion,
  type RecipientToken,
} from '@/src/utils/messageRecipients';
import { colors, radius, spacing, touch, typography } from '@/src/theme/tokens';

type Props = {
  eligible: User[];
  departments: Department[];
  tokens: RecipientToken[];
  onChange: (tokens: RecipientToken[]) => void;
};

export function RecipientComposer({ eligible, departments, tokens, onChange }: Props) {
  const [query, setQuery] = useState('');

  const suggestions = useMemo(
    () => buildRecipientSuggestions(query, eligible, departments, tokens),
    [query, eligible, departments, tokens]
  );

  const showNoMatch = query.trim().length > 0 && suggestions.length === 0;

  const addToken = (s: RecipientSuggestion) => {
    const next = suggestionToToken(s);
    if (tokens.some((t) => tokenKey(t) === tokenKey(next))) return;
    if (next.kind === 'all') {
      onChange([next]);
    } else if (tokens.some((t) => t.kind === 'all')) {
      onChange([next]);
    } else {
      onChange([...tokens, next]);
    }
    setQuery('');
  };

  const removeToken = (key: string) => {
    onChange(tokens.filter((t) => tokenKey(t) !== key));
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>To</Text>
      <Text style={styles.hint}>
        Type a name or email. Use @all or @DEPT_CODE (e.g. @SMS, @ROLLING).
      </Text>

      <View style={styles.box}>
        <View style={styles.chips}>
          {tokens.map((t) => (
            <Pressable
              key={tokenKey(t)}
              style={styles.chip}
              onPress={() => removeToken(tokenKey(t))}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${t.label}`}
            >
              <Text style={styles.chipText}>{t.label}</Text>
              <Text style={styles.chipX}>×</Text>
            </Pressable>
          ))}
          <TextInput
            style={styles.input}
            placeholder={tokens.length === 0 ? 'Search recipients…' : ''}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {suggestions.length > 0 ? (
        <View style={styles.suggestList}>
          {suggestions.map((s) => (
            <Pressable
              key={s.kind === 'user' ? s.id : s.kind === 'dept' ? s.id : 'all'}
              style={styles.suggestRow}
              onPress={() => addToken(s)}
              accessibilityRole="button"
            >
              <Text style={styles.suggestLabel}>{s.label}</Text>
              <Text style={styles.suggestSub}>{s.sublabel}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {showNoMatch ? <Text style={styles.noMatch}>No one matched.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.caption, fontWeight: '600', color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted, lineHeight: 16, marginBottom: spacing.xs },
  box: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: touch.minTarget,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brandSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { ...typography.caption, color: colors.brandDark, fontWeight: '600' },
  chipX: { color: colors.brandDark, fontWeight: '700', fontSize: 14 },
  input: {
    flexGrow: 1,
    minWidth: 120,
    ...typography.body,
    color: colors.text,
    paddingVertical: 8,
    minHeight: 40,
  },
  suggestList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    overflow: 'hidden',
    maxHeight: 220,
  },
  suggestRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: touch.minTarget,
    justifyContent: 'center',
  },
  suggestLabel: { ...typography.body, fontWeight: '600', color: colors.text },
  suggestSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  noMatch: { ...typography.caption, color: colors.textMuted },
});
