import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';

import { getErrorMessage } from '@/src/api/client';
import {
  downloadMessageAttachment,
  fetchMessage,
  type AppMessage,
  type MessageAttachment,
} from '@/src/api/messages';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * P3-MSG-INBOX — Message detail + attachments (image lightbox / PDF share).
 */
export function MessageDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const messageId = typeof params.id === 'string' ? params.id : params.id?.[0];

  const [msg, setMsg] = useState<AppMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!messageId) return;
    setLoading(true);
    setError(null);
    try {
      setMsg(await fetchMessage(messageId));
    } catch (e) {
      setError(getErrorMessage(e));
      setMsg(null);
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAttachment = async (a: MessageAttachment) => {
    setBusyId(a.id);
    setError(null);
    try {
      const uri = await downloadMessageAttachment(a.id, a.file_name);
      if (a.mime_type.startsWith('image/')) {
        setLightboxUri(uri);
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        setError('Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: a.mime_type,
        dialogTitle: a.file_name,
      });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  if (!messageId) {
    return (
      <Screen>
        <EmptyState title="Missing message" description="No message id in the route." />
        <Button title="Back" onPress={() => router.replace('/(app)/messages' as Href)} />
      </Screen>
    );
  }

  if (loading && !msg) {
    return <LoadingView message="Loading message…" />;
  }

  if (!msg) {
    return (
      <Screen>
        {error ? <ErrorBanner message={error} /> : null}
        <EmptyState title="Not found" description="Could not load this message." />
        <Button title="Back to inbox" onPress={() => router.replace('/(app)/messages' as Href)} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()} accessibilityRole="link">
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      <Text style={styles.title}>{msg.subject}</Text>
      <Text style={styles.meta}>
        From {msg.sender?.full_name ?? 'Unknown'} · {new Date(msg.created_at).toLocaleString()}
      </Text>

      <Card style={styles.bodyCard}>
        <Text style={styles.body}>{msg.body}</Text>
      </Card>

      {(msg.attachments?.length ?? 0) > 0 ? (
        <>
          <Text style={styles.section}>Attachments</Text>
          {msg.attachments.map((a) => (
            <Button
              key={a.id}
              title={
                busyId === a.id
                  ? 'Opening…'
                  : a.mime_type.startsWith('image/')
                    ? `View image · ${a.file_name}`
                    : a.file_name
              }
              variant="secondary"
              style={styles.attachBtn}
              disabled={busyId === a.id}
              onPress={() => void openAttachment(a)}
            />
          ))}
        </>
      ) : null}

      <Modal
        visible={Boolean(lightboxUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxUri(null)}
      >
        <Pressable style={styles.lightbox} onPress={() => setLightboxUri(null)}>
          {lightboxUri ? (
            <Image source={{ uri: lightboxUri }} style={styles.lightboxImage} resizeMode="contain" />
          ) : null}
          <Text style={styles.lightboxHint}>Tap to close</Text>
        </Pressable>
      </Modal>
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
  banner: { marginBottom: spacing.sm },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  bodyCard: { marginBottom: spacing.lg },
  body: { ...typography.body, color: colors.text, lineHeight: 22 },
  section: { ...typography.section, color: colors.text, marginBottom: spacing.sm },
  attachBtn: { marginBottom: spacing.sm, alignSelf: 'stretch' },
  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  lightboxImage: { width: '100%', height: '80%' },
  lightboxHint: { ...typography.caption, color: '#E2E8F0', marginTop: spacing.md },
});
