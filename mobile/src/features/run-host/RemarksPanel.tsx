import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  createRunRemark,
  fetchRunRemarks,
  replyToRunRemark,
} from '@/src/api/processRuns';
import { Button } from '@/src/components/ui/Button';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { TextField } from '@/src/components/ui/TextField';
import type { RunRemark } from '@/src/types/processRun';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = {
  runId: string;
  refreshKey: number;
};

export function RemarksPanel({ runId, refreshKey }: Props) {
  const [remarks, setRemarks] = useState<RunRemark[]>([]);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRemarks(await fetchRunRemarks(runId));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function onPost() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setPosting(true);
    setError(null);
    try {
      if (replyTo) await replyToRunRemark(runId, replyTo, trimmed);
      else await createRunRemark(runId, trimmed);
      setBody('');
      setReplyTo(null);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setPosting(false);
    }
  }

  const roots = remarks.filter((r) => !r.parent_id);
  const repliesOf = (id: string) => remarks.filter((r) => r.parent_id === id);

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Remarks</Text>
      {error ? <ErrorBanner message={error} /> : null}
      {loading && remarks.length === 0 ? (
        <Text style={styles.muted}>Loading remarks…</Text>
      ) : remarks.length === 0 ? (
        <Text style={styles.muted}>No remarks yet.</Text>
      ) : (
        roots.map((r) => (
          <View key={r.id} style={styles.item}>
            <Text style={styles.meta}>
              {r.author?.full_name ?? r.role} · {new Date(r.created_at).toLocaleString()}
            </Text>
            <Text style={styles.body}>{r.body}</Text>
            <Button
              title="Reply"
              variant="ghost"
              size="sm"
              onPress={() => setReplyTo(r.id)}
              disabled={posting}
            />
            {repliesOf(r.id).map((rep) => (
              <View key={rep.id} style={styles.reply}>
                <Text style={styles.meta}>
                  {rep.author?.full_name ?? rep.role} ·{' '}
                  {new Date(rep.created_at).toLocaleString()}
                </Text>
                <Text style={styles.body}>{rep.body}</Text>
              </View>
            ))}
          </View>
        ))
      )}
      <TextField
        label={replyTo ? 'Reply' : 'Add remark'}
        value={body}
        onChangeText={setBody}
        multiline
        numberOfLines={3}
        style={styles.input}
        editable={!posting}
      />
      {replyTo ? (
        <Button title="Cancel reply" variant="ghost" onPress={() => setReplyTo(null)} />
      ) : null}
      <Button
        title={posting ? 'Posting…' : replyTo ? 'Post reply' : 'Post remark'}
        variant="secondary"
        loading={posting}
        disabled={!body.trim()}
        onPress={() => void onPost()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.md },
  heading: { ...typography.section, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },
  item: {
    gap: 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reply: {
    marginLeft: spacing.md,
    marginTop: spacing.xs,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    gap: 2,
  },
  meta: { ...typography.caption, color: colors.textMuted },
  body: { ...typography.body, color: colors.text },
  input: { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
});
