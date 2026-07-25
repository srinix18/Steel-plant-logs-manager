import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchInbox, fetchSentMessages, type AppMessage } from '@/src/api/messages';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { ListRow } from '@/src/components/ui/ListRow';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SegmentedTabs } from '@/src/components/ui/SegmentedTabs';
import { colors, spacing, typography } from '@/src/theme/tokens';

type TabKey = 'inbox' | 'sent';

/**
 * P3-MSG-INBOX — Inbox / Sent list (port of MessagesPage inbox+sent tabs).
 */
export function MessagesInboxScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab: TabKey = params.tab === 'sent' ? 'sent' : 'inbox';
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [inbox, setInbox] = useState<AppMessage[]>([]);
  const [sent, setSent] = useState<AppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.tab === 'sent' || params.tab === 'inbox') {
      setTab(params.tab);
    }
  }, [params.tab]);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [inMsgs, sentMsgs] = await Promise.all([fetchInbox(), fetchSentMessages()]);
      setInbox(inMsgs);
      setSent(sentMsgs);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const list = tab === 'inbox' ? inbox : sent;

  if (loading && inbox.length === 0 && sent.length === 0) {
    return <LoadingView message="Loading messages…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Messages & Alerts</Text>
      <Text style={styles.sub}>Inbox and sent mail. Use Alerts for notifications or Compose to write.</Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      <View style={styles.links}>
        <Button
          title="Alerts"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/(app)/messages/alerts' as Href)}
        />
        <Button
          title="Compose"
          size="sm"
          onPress={() => router.push('/(app)/messages/compose' as Href)}
        />
      </View>

      <SegmentedTabs
        segments={[
          { key: 'inbox', label: 'Inbox' },
          { key: 'sent', label: 'Sent' },
        ]}
        value={tab}
        onChange={(key) => setTab(key as TabKey)}
      />

      <Card padded={false} style={styles.listCard}>
        {list.length === 0 ? (
          <EmptyState
            title={tab === 'inbox' ? 'Inbox empty' : 'No sent messages'}
            description={
              tab === 'inbox' ? 'You’re all caught up.' : 'Messages you send will appear here.'
            }
          />
        ) : (
          list.map((m) => (
            <ListRow
              key={m.id}
              title={m.subject}
              subtitle={`${tab === 'inbox' ? m.sender?.full_name ?? 'Unknown' : 'You'} · ${new Date(m.created_at).toLocaleString()}`}
              onPress={() => router.push(`/(app)/messages/${m.id}` as Href)}
              right={
                (m.attachments?.length ?? 0) > 0 ? (
                  <Badge label={`${m.attachments.length}`} tone="brand" />
                ) : undefined
              }
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  sub: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  banner: { marginBottom: spacing.sm },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  listCard: { marginTop: spacing.md, overflow: 'hidden' },
});
