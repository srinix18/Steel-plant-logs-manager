import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { approveLeaveRequest, fetchLeaveRequests, rejectLeaveRequest, type LeaveRequestStatus } from '@/src/api/workforceOps';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

const TABS: Array<LeaveRequestStatus | 'all'> = ['pending', 'approved', 'rejected', 'all'];

/** P4-WF-LEAVE — HR leave request review. */
export function LeaveRequestsScreen() {
  const [tab, setTab] = useState<LeaveRequestStatus | 'all'>('pending');
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof fetchLeaveRequests>>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    setError(null);
    try { setRequests(await fetchLeaveRequests(tab === 'all' ? undefined : tab)); }
    catch (e) { setError(getErrorMessage(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab]);
  useEffect(() => { void load(); }, [load]);
  const act = async (id: string, action: 'approve' | 'reject') => {
    setActing(id); setError(null);
    try {
      if (action === 'approve') await approveLeaveRequest(id);
      else await rejectLeaveRequest(id);
      await load(true);
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setActing(null); }
  };
  if (loading) return <LoadingView message="Loading leave requests…" />;
  return <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
    <Text style={styles.title}>Leave Requests</Text>
    <Text style={styles.sub}>Review and approve employee leave applications.</Text>
    {error ? <View style={styles.banner}><ErrorBanner message={error} /></View> : null}
    <View style={styles.tabs}>{TABS.map((value) => <Pressable key={value} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.tabActive]}><Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value}</Text></Pressable>)}</View>
    {requests.length === 0 ? <EmptyState title="No leave requests" description={`No ${tab} leave requests.`} /> : requests.map((request) => (
      <Card key={request.id} style={styles.card}>
        <View style={styles.row}><View style={styles.grow}><Text style={styles.name}>{request.user_name ?? request.user_id}</Text><Text style={styles.meta}>{request.leave_type_name ?? 'Leave'} · {request.from_date} — {request.to_date}</Text></View><Badge label={request.status} tone={request.status === 'approved' ? 'success' : request.status === 'rejected' ? 'danger' : 'neutral'} /></View>
        <Text style={styles.remarks}>Remarks: {request.remarks ?? '—'}</Text>
        {request.status === 'pending' ? <View style={styles.actions}><Button title={acting === request.id ? 'Working…' : 'Approve'} size="sm" disabled={acting === request.id} onPress={() => void act(request.id, 'approve')} /><Button title="Reject" variant="danger" size="sm" disabled={acting === request.id} onPress={() => void act(request.id, 'reject')} /></View> : null}
      </Card>
    ))}
  </Screen>;
}
const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs }, sub: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  banner: { marginBottom: spacing.sm }, tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }, tab: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.button, backgroundColor: colors.background }, tabActive: { backgroundColor: colors.brand }, tabText: { ...typography.caption, color: colors.textMuted, textTransform: 'capitalize', fontWeight: '600' }, tabTextActive: { color: colors.card }, card: { marginBottom: spacing.sm }, row: { flexDirection: 'row', gap: spacing.sm }, grow: { flex: 1 }, name: { ...typography.body, color: colors.text, fontWeight: '700' }, meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 }, remarks: { ...typography.body, color: colors.text, marginTop: spacing.sm }, actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
