import * as DocumentPicker from 'expo-document-picker';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchDepartments } from '@/src/api/lookups';
import {
  fetchSuggestedRecipients,
  sendMessage,
  uploadMessageAttachment,
  type PendingAttachment,
} from '@/src/api/messages';
import { useAuth } from '@/src/auth/AuthContext';
import { CEO_TIER_ROLES, HR_ROLES, hasRole } from '@/src/auth/roles';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { TextField } from '@/src/components/ui/TextField';
import { RecipientComposer } from '@/src/features/messages/RecipientComposer';
import type { Department } from '@/src/types/platform';
import type { User } from '@/src/types/user';
import {
  resolveRecipientIds,
  type RecipientToken,
} from '@/src/utils/messageRecipients';
import { colors, spacing, typography } from '@/src/theme/tokens';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf']);

/**
 * P3-MSG-COMPOSE — Compose message (port of MessagesPage compose tab).
 */
export function MessagesComposeScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tokens, setTokens] = useState<RecipientToken[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [suggested, depts] = await Promise.all([
        fetchSuggestedRecipients(),
        fetchDepartments(),
      ]);
      setRecipients(suggested);
      setDepartments(depts);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canBroadcast = !!(user && (hasRole(user.role, CEO_TIER_ROLES) || hasRole(user.role, HR_ROLES)));
  const canSend =
    subject.trim().length > 0 && body.trim().length > 0 && tokens.length > 0;

  const pickFiles = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const next: PendingAttachment[] = [];
      for (const asset of result.assets) {
        const mime = asset.mimeType || 'application/octet-stream';
        if (!ALLOWED_MIME.has(mime)) {
          setError('Only JPEG, PNG, and PDF attachments are allowed.');
          continue;
        }
        next.push({
          uri: asset.uri,
          name: asset.name || `file-${Date.now()}`,
          mimeType: mime,
        });
      }
      if (next.length) setPendingFiles((prev) => [...prev, ...next]);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const handleSend = async () => {
    if (!user) return;
    setSending(true);
    setError(null);
    try {
      const { recipientIds, isBroadcast } = resolveRecipientIds(
        tokens,
        recipients,
        canBroadcast
      );
      if (!isBroadcast && recipientIds.length === 0) {
        setError('Add at least one recipient, @all, or a department like @SMS.');
        return;
      }
      const msg = await sendMessage({
        subject: subject.trim(),
        body: body.trim(),
        recipient_ids: isBroadcast ? [] : recipientIds,
        is_broadcast: isBroadcast,
      });
      for (const file of pendingFiles) {
        await uploadMessageAttachment(msg.id, file);
      }
      setSubject('');
      setBody('');
      setTokens([]);
      setPendingFiles([]);
      router.replace('/(app)/messages?tab=sent' as Href);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <LoadingView message="Loading recipients…" />;
  }

  return (
    <Screen scroll>
      <Pressable
        onPress={() => router.push('/(app)/messages' as Href)}
        accessibilityRole="link"
      >
        <Text style={styles.back}>← Messages</Text>
      </Pressable>
      <Text style={styles.title}>Compose</Text>
      <Text style={styles.sub}>
        Type to find recipients, or use @all / @DEPT_CODE for groups.
      </Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      <Card style={styles.card}>
        <RecipientComposer
          eligible={recipients}
          departments={departments}
          tokens={tokens}
          onChange={setTokens}
        />
        <TextField label="Subject" value={subject} onChangeText={setSubject} />
        <TextField
          label="Message"
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={6}
          style={styles.bodyInput}
        />

        <Text style={styles.attachLabel}>Attachments (JPEG, PNG, PDF)</Text>
        <Button title="Add files" variant="secondary" size="sm" onPress={() => void pickFiles()} />
        {pendingFiles.map((f, i) => (
          <View key={`${f.uri}-${i}`} style={styles.fileRow}>
            <Text style={styles.fileName} numberOfLines={1}>
              {f.name}
            </Text>
            <Pressable
              onPress={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${f.name}`}
            >
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        ))}

        <Button
          title={sending ? 'Sending…' : 'Send message'}
          disabled={sending || !canSend}
          onPress={() => void handleSend()}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    ...typography.caption,
    color: colors.brandDark,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  sub: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  banner: { marginBottom: spacing.sm },
  card: { gap: spacing.md },
  bodyInput: { minHeight: 120, textAlignVertical: 'top' },
  attachLabel: { ...typography.caption, fontWeight: '600', color: colors.text },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  fileName: { ...typography.caption, color: colors.text, flex: 1 },
  remove: { ...typography.caption, color: colors.danger, fontWeight: '600' },
});
