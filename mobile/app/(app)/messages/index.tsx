import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/src/components/ui/Badge';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { SegmentedTabs } from '@/src/components/ui/SegmentedTabs';
import { colors, spacing, typography } from '@/src/theme/tokens';

type TabKey = 'inbox' | 'alerts';

const DEMO_INBOX = [
  {
    id: '1',
    title: 'Shift handover — SMS',
    subtitle: 'IAF night shift notes ready for review',
    tone: 'brand' as const,
  },
  {
    id: '2',
    title: 'Maintenance assigned',
    subtitle: 'Quality issue #482 awaiting acknowledgement',
    tone: 'danger' as const,
  },
];

const DEMO_ALERTS = [
  {
    id: 'a1',
    title: 'Delay code OT logged',
    subtitle: 'Rolling Mill — 18 minutes lost',
    tone: 'neutral' as const,
  },
];

/**
 * Messages list preview using P1-06 ListRow / SegmentedTabs.
 * Full messaging lands in P3-MSG-*.
 */
export default function MessagesScreen() {
  const [tab, setTab] = useState<TabKey>('inbox');
  const rows = tab === 'inbox' ? DEMO_INBOX : DEMO_ALERTS;

  return (
    <Screen scroll>
      <Text style={styles.heading}>Messages & Alerts</Text>
      <Text style={styles.meta}>Placeholder list — next chunk P3-MSG-INBOX</Text>

      <SegmentedTabs
        segments={[
          { key: 'inbox', label: 'Inbox' },
          { key: 'alerts', label: 'Alerts' },
        ]}
        value={tab}
        onChange={(key) => setTab(key as TabKey)}
      />

      <Card padded={false} style={styles.listCard}>
        {rows.length === 0 ? (
          <EmptyState title="No messages" description="You’re all caught up." />
        ) : (
          rows.map((row) => (
            <ListRow
              key={row.id}
              title={row.title}
              subtitle={row.subtitle}
              onPress={() => {}}
              right={<Badge label={tab === 'inbox' ? 'Msg' : 'Alert'} tone={row.tone} />}
            />
          ))
        )}
      </Card>

      <View style={styles.note}>
        <Text style={styles.meta}>Demo rows only until P3-MSG-INBOX wires the API.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  listCard: {
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  note: {
    marginTop: spacing.md,
  },
});
