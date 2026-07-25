import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { getErrorMessage } from '@/src/api/client';
import {
  fetchAssetWorkspace,
  pulseStatusTone,
  type AssetWorkspace,
} from '@/src/api/pulse';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { OeeBreakdown } from '@/src/features/pulse/OeeBreakdown';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

const TABS = [
  'Overview',
  'Live Parameters',
  'Maintenance',
  'Alerts',
  'OEE',
  'Energy',
  'Inspections',
  'SOP',
] as const;
type Tab = (typeof TABS)[number];

function QrDisplay({ payload }: { payload: string }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(payload)}`;
  return (
    <View style={styles.qrWrap}>
      <Image source={{ uri: url }} style={styles.qr} accessibilityLabel="Asset QR Code" />
      <Text style={styles.qrPayload} selectable>
        {payload}
      </Text>
    </View>
  );
}

/**
 * P5-PULSE-WS — asset workspace tabs (port of AssetWorkspacePage).
 */
export function AssetWorkspaceScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const assetId = typeof id === 'string' ? id : id?.[0];

  const [tab, setTab] = useState<Tab>('Overview');
  const [ws, setWs] = useState<AssetWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (!assetId) return;
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setWs(await fetchAssetWorkspace(assetId));
      } catch (e) {
        setError(getErrorMessage(e));
        setWs(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [assetId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (!assetId) {
    return (
      <Screen>
        <EmptyState title="Invalid asset." description="Missing asset id in route." />
      </Screen>
    );
  }

  if (loading && !ws) {
    return <LoadingView message="Loading asset workspace…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <View style={styles.header}>
        <View style={styles.grow}>
          <Text style={styles.title}>{ws?.asset_name ?? 'Asset Workspace'}</Text>
          <Text style={styles.sub}>
            {[ws?.asset_no, ws?.department_name, ws?.location].filter(Boolean).join(' · ') || '—'}
          </Text>
        </View>
      </View>

      <View style={styles.badges}>
        {ws ? <Badge label={ws.status} tone={pulseStatusTone(ws.status)} /> : null}
        {ws?.health_category ? (
          <Badge
            label={`Health ${ws.health_score ?? '—'}%`}
            tone={pulseStatusTone(ws.health_category)}
          />
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          title="Pulse view"
          variant="secondary"
          size="sm"
          onPress={() => router.push(`/(app)/assets/${assetId}/pulse` as Href)}
        />
      </View>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabs}
      >
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {ws && tab === 'Overview' ? (
        <>
          <Text style={styles.section}>Asset Overview</Text>
          <Card style={styles.card}>
            <Row label="Status" value={ws.status} />
            <Row label="Operator" value={ws.current_operator ?? '—'} />
            <Row label="Current run" value={ws.current_run_label ?? '—'} />
            <Row label="Installed" value={ws.installation_date ?? '—'} />
            <Row
              label="Remaining life"
              value={
                ws.remaining_useful_life_pct != null
                  ? `${ws.remaining_useful_life_pct}%`
                  : '—'
              }
            />
          </Card>
          <Text style={styles.section}>QR Code</Text>
          <Card style={styles.card}>
            <QrDisplay payload={ws.qr_payload ?? `asset:${assetId}`} />
          </Card>
          <Text style={styles.section}>Emergency Contacts</Text>
          <Card style={styles.card}>
            {ws.emergency_contacts.length === 0 ? (
              <EmptyState title="No emergency contacts." />
            ) : (
              ws.emergency_contacts.map((c) => (
                <Pressable
                  key={`${c.phone}-${c.name}`}
                  onPress={() => void Linking.openURL(`tel:${c.phone}`)}
                  style={styles.contact}
                >
                  <Text style={styles.contactName}>{c.name}</Text>
                  <Text style={styles.meta}>
                    {c.role} · {c.phone}
                  </Text>
                </Pressable>
              ))
            )}
          </Card>
        </>
      ) : null}

      {ws && tab === 'Live Parameters' ? (
        <Card style={styles.card}>
          {ws.live_parameters.length === 0 ? (
            <EmptyState title="No live parameters." />
          ) : (
            <View style={styles.paramGrid}>
              {ws.live_parameters.map((p) => (
                <View key={p.param_key} style={styles.param}>
                  <Text style={styles.meta}>{p.label ?? p.param_key}</Text>
                  <Text style={styles.paramVal}>
                    {p.value_text ?? p.value ?? '—'}
                    {p.unit && !p.value_text ? ` ${p.unit}` : ''}
                  </Text>
                  <Text style={styles.meta}>source: {p.source}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      ) : null}

      {ws && tab === 'Maintenance' ? (
        <Card style={styles.card}>
          {ws.maintenance.open_work_orders.length === 0 ? (
            <EmptyState title="No open work orders." />
          ) : (
            ws.maintenance.open_work_orders.map((wo) => (
              <Pressable
                key={wo.id}
                onPress={() =>
                  router.push(`/(app)/maintenance/work-orders/${wo.id}` as Href)
                }
                style={styles.listRow}
              >
                <Text style={styles.link}>{wo.title}</Text>
                <Text style={styles.meta}>{wo.status}</Text>
              </Pressable>
            ))
          )}
        </Card>
      ) : null}

      {ws && tab === 'Alerts' ? (
        <Card style={styles.card}>
          {ws.open_alerts.length === 0 ? (
            <Text style={styles.ok}>No open alerts for this asset.</Text>
          ) : (
            ws.open_alerts.map((a) => (
              <View key={a.id} style={styles.listRow}>
                <Text style={styles.contactName}>{a.title}</Text>
                <Text style={styles.meta}>{a.message}</Text>
              </View>
            ))
          )}
        </Card>
      ) : null}

      {ws && tab === 'OEE' ? (
        <Card style={styles.card}>
          <OeeBreakdown {...ws.oee} />
        </Card>
      ) : null}

      {ws && tab === 'Energy' ? (
        <Card style={styles.card}>
          <Text style={styles.energy}>
            {ws.energy_kwh_today != null ? ws.energy_kwh_today.toFixed(0) : '—'} kWh
          </Text>
          <Text style={styles.meta}>Energy today</Text>
          <Button
            title="View Energy module"
            variant="secondary"
            size="sm"
            onPress={() => router.push('/(app)/energy')}
          />
        </Card>
      ) : null}

      {ws && tab === 'Inspections' ? (
        <Card style={styles.card}>
          {ws.inspections.length === 0 ? (
            <EmptyState title="No inspections recorded." />
          ) : (
            ws.inspections.map((i) => (
              <View key={i.id} style={styles.listRow}>
                <Text style={styles.contactName}>{i.type}</Text>
                <Text style={styles.meta}>
                  {new Date(i.inspected_at).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </Card>
      ) : null}

      {ws && tab === 'SOP' ? (
        <Card style={styles.card}>
          {ws.sops.length === 0 ? (
            <EmptyState title="No documents linked." />
          ) : (
            ws.sops.map((s) => (
              <View key={s.id} style={styles.listRow}>
                <Text style={styles.contactName}>{s.title}</Text>
                <Text style={styles.meta}>{s.category}</Text>
              </View>
            ))
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={styles.rowVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  grow: { flex: 1 },
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  actions: { marginTop: spacing.md },
  banner: { marginTop: spacing.md },
  tabsScroll: { marginTop: spacing.md, marginHorizontal: -spacing.md },
  tabs: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 0,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.brand },
  tabText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.brandDark },
  section: {
    ...typography.section,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: { marginBottom: spacing.sm, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowVal: { ...typography.body, color: colors.text, fontWeight: '600' },
  meta: { ...typography.caption, color: colors.textMuted },
  qrWrap: { alignItems: 'center', gap: spacing.sm },
  qr: { width: 160, height: 160, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border },
  qrPayload: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  contact: { paddingVertical: spacing.sm },
  contactName: { ...typography.body, color: colors.text, fontWeight: '600' },
  paramGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  param: {
    width: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: spacing.md,
  },
  paramVal: { ...typography.section, color: colors.text, marginVertical: 4 },
  listRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  link: { ...typography.body, color: colors.brandDark, fontWeight: '600' },
  ok: { ...typography.body, color: colors.success },
  energy: { ...typography.title, color: colors.text, fontSize: 28 },
});
