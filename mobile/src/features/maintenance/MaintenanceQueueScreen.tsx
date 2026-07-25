import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/src/api/client';
import {
  assignMaintenanceIssue,
  closeMaintenanceIssue,
  fetchMyMaintenanceIssues,
  type MaintenanceIssue,
  type MaintenanceIssueStatus,
} from '@/src/api/maintenance';
import { useAuth } from '@/src/auth/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SegmentedTabs } from '@/src/components/ui/SegmentedTabs';
import { TextField } from '@/src/components/ui/TextField';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

const STATUS_TABS: { key: MaintenanceIssueStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

function categoryLabel(c: string) {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/**
 * P3-MAINT-QUEUE — Issue Queue (port of web MaintenanceQueuePage).
 */
export function MaintenanceQueueScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ issue?: string }>();
  const highlightId = typeof params.issue === 'string' ? params.issue : params.issue?.[0];

  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [tab, setTab] = useState<MaintenanceIssueStatus | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [closeId, setCloseId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setIssues(await fetchMyMaintenanceIssues());
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

  const filtered = useMemo(() => {
    if (tab === 'all') return issues;
    return issues.filter((i) => i.status === tab);
  }, [issues, tab]);

  async function handleAssign(id: string) {
    setAssigningId(id);
    setError(null);
    try {
      await assignMaintenanceIssue(id);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setAssigningId(null);
    }
  }

  async function handleClose() {
    if (!closeId || !resolutionNotes.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await closeMaintenanceIssue(closeId, resolutionNotes.trim());
      setCloseId(null);
      setResolutionNotes('');
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading && issues.length === 0) {
    return <LoadingView message="Loading issue queue…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Maintenance Queue</Text>
      <Text style={styles.sub}>
        Issues routed to the {user?.maintenance_division ?? 'your'} category crew.
      </Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      <SegmentedTabs
        segments={STATUS_TABS.map((t) => ({ key: t.key, label: t.label }))}
        value={tab}
        onChange={(key) => setTab(key as MaintenanceIssueStatus | 'all')}
      />

      <View style={styles.list}>
        {filtered.length === 0 ? (
          <EmptyState title="No issues" description="No issues in this queue tab." />
        ) : (
          filtered.map((issue) => {
            const highlighted = highlightId === issue.id;
            return (
              <Card
                key={issue.id}
                style={[styles.card, highlighted ? styles.highlight : null]}
              >
                <View style={styles.badges}>
                  <Badge label={categoryLabel(issue.category)} tone="neutral" />
                  <Badge
                    label={issue.status.replace(/_/g, ' ')}
                    tone={issue.status === 'closed' ? 'success' : 'brand'}
                  />
                  <Badge label={issue.severity} tone="neutral" />
                </View>
                <Text style={styles.issueTitle}>{issue.title}</Text>
                <Text style={styles.desc}>{issue.description}</Text>
                <Text style={styles.meta}>
                  Raised by {issue.raised_by_user?.full_name ?? '—'} ·{' '}
                  {new Date(issue.raised_at).toLocaleString()}
                </Text>
                {issue.run_id ? (
                  <Pressable
                    onPress={() => router.push(`/(app)/reports/${issue.run_id}` as Href)}
                    accessibilityRole="link"
                  >
                    <Text style={styles.link}>View run report</Text>
                  </Pressable>
                ) : null}
                {issue.status === 'closed' && issue.closed_by_user ? (
                  <Text style={styles.meta}>
                    Closed by {issue.closed_by_user.full_name}
                    {issue.closed_at
                      ? ` on ${new Date(issue.closed_at).toLocaleString()}`
                      : ''}
                    {issue.resolution_notes
                      ? `\nResolution: ${issue.resolution_notes}`
                      : ''}
                  </Text>
                ) : null}
                {issue.status === 'in_progress' && issue.assigned_to_user ? (
                  <Text style={styles.meta}>
                    Assigned to {issue.assigned_to_user.full_name}
                  </Text>
                ) : null}
                <View style={styles.actions}>
                  {issue.status === 'open' ? (
                    <Button
                      title={assigningId === issue.id ? 'Taking…' : 'Take issue'}
                      size="lg"
                      loading={assigningId === issue.id}
                      onPress={() => void handleAssign(issue.id)}
                    />
                  ) : null}
                  {issue.status === 'in_progress' ? (
                    <Button
                      title="Mark completed"
                      size="lg"
                      onPress={() => {
                        setCloseId(issue.id);
                        setResolutionNotes('');
                      }}
                    />
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </View>

      <Modal
        visible={Boolean(closeId)}
        animationType="slide"
        transparent
        onRequestClose={() => setCloseId(null)}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.modalSheet} edges={['bottom']}>
            <Text style={styles.modalTitle}>Complete issue</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalBody}>
              <TextField
                label="Resolution notes *"
                value={resolutionNotes}
                onChangeText={setResolutionNotes}
                placeholder="What was done to resolve this?"
                multiline
                style={styles.multiline}
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                size="lg"
                style={styles.modalBtn}
                onPress={() => setCloseId(null)}
              />
              <Button
                title={saving ? 'Saving…' : 'Mark completed'}
                size="lg"
                style={styles.modalBtn}
                loading={saving}
                disabled={saving || !resolutionNotes.trim()}
                onPress={() => void handleClose()}
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
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
  banner: { marginBottom: spacing.sm, marginTop: spacing.sm },
  list: { marginTop: spacing.md, gap: spacing.sm },
  card: { gap: spacing.sm },
  highlight: {
    borderColor: colors.brand,
    borderWidth: 2,
    backgroundColor: colors.brandSoft,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  issueTitle: { ...typography.section, color: colors.text },
  desc: { ...typography.body, color: colors.text, lineHeight: 22 },
  meta: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  link: { ...typography.caption, color: colors.brandDark, fontWeight: '600' },
  actions: { marginTop: spacing.xs },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '70%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  modalTitle: {
    ...typography.section,
    color: colors.text,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalBody: { padding: spacing.md, gap: spacing.md },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalBtn: { flex: 1 },
});
