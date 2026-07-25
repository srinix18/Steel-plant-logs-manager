import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchPlants } from '@/src/api/lookups';
import { fetchSafetyDashboard, type SafetyDashboard } from '@/src/api/safety';
import { useAuth } from '@/src/auth/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

type KpiTone = 'neutral' | 'danger' | 'warn';

function KpiCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: KpiTone;
}) {
  return (
    <View style={[styles.kpi, tone === 'danger' && styles.kpiDanger, tone === 'warn' && styles.kpiWarn]}>
      <Text style={[styles.kpiValue, tone === 'danger' && styles.kpiValueDanger, tone === 'warn' && styles.kpiValueWarn]}>
        {value}
      </Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

/**
 * P3-SAFE-DASH — Safety Dashboard (port of web SafetyDashboardPage).
 */
export function SafetyDashboardScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plantId, setPlantId] = useState<string | null>(null);
  const [dash, setDash] = useState<SafetyDashboard | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const plants = await fetchPlants();
        const pid =
          (user?.plant_id && plants.find((p) => p.id === user.plant_id)?.id) || plants[0]?.id || null;
        setPlantId(pid);
        if (!pid) {
          setDash(null);
          setError('No plant available for safety dashboard.');
          return;
        }
        setDash(await fetchSafetyDashboard(pid));
      } catch (e) {
        setError(getErrorMessage(e));
        setDash(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.plant_id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !dash) {
    return <LoadingView message="Loading safety dashboard…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Safety</Text>
      <Text style={styles.sub}>Inspections, incidents, and compliance for your plant.</Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      <View style={styles.links}>
        <Button
          title="Scan Asset"
          size="lg"
          style={styles.linkBtn}
          onPress={() => router.push('/(app)/safety/scan' as Href)}
        />
        <Button
          title="Inspections"
          variant="secondary"
          size="lg"
          style={styles.linkBtn}
          onPress={() => router.push('/(app)/safety/inspections' as Href)}
        />
        <Button
          title="SOP Library"
          variant="secondary"
          size="lg"
          style={styles.linkBtn}
          onPress={() => router.push('/(app)/safety/sops' as Href)}
        />
        <Button
          title="Incidents"
          variant="secondary"
          size="lg"
          style={styles.linkBtn}
          onPress={() => router.push('/(app)/safety/incidents' as Href)}
        />
      </View>

      {dash ? (
        <>
          <View style={styles.kpiGrid}>
            <KpiCard label="Under Maintenance" value={dash.assets_under_maintenance} />
            <KpiCard label="Unsafe Assets" value={dash.unsafe_assets} tone="danger" />
            <KpiCard label="Expired Certs" value={dash.expired_certifications} />
            <KpiCard label="Inspection Due" value={dash.inspection_due} tone="warn" />
          </View>

          <Text style={styles.section}>Recent Incidents</Text>
          <Card style={styles.card}>
            {(dash.recent_incidents ?? []).length === 0 ? (
              <EmptyState title="No incidents" description="No recent incidents for this plant." />
            ) : (
              dash.recent_incidents.map((i) => (
                <View key={i.id} style={styles.incidentRow}>
                  <View style={styles.textCol}>
                    <Text style={styles.incidentTitle}>{i.title}</Text>
                    <Text style={styles.meta}>
                      {i.status.replace(/_/g, ' ')}
                      {i.occurred_at ? ` · ${new Date(i.occurred_at).toLocaleString()}` : ''}
                    </Text>
                  </View>
                  <Badge
                    label={i.severity}
                    tone={i.severity === 'critical' || i.severity === 'high' ? 'danger' : 'neutral'}
                  />
                </View>
              ))
            )}
          </Card>

          <Text style={styles.section}>Emergency Contacts</Text>
          <Card style={styles.card}>
            {(dash.emergency_contacts ?? []).length === 0 ? (
              <EmptyState title="No contacts" description="No emergency contacts configured." />
            ) : (
              dash.emergency_contacts.map((c) => (
                <Pressable
                  key={`${c.phone}-${c.name}`}
                  style={styles.contactRow}
                  onPress={() => void Linking.openURL(`tel:${c.phone}`)}
                  accessibilityRole="link"
                  accessibilityLabel={`Call ${c.name}`}
                >
                  <View style={styles.textCol}>
                    <Text style={styles.contactName}>{c.name}</Text>
                    <Text style={styles.meta}>{c.role}</Text>
                  </View>
                  <Text style={styles.phone}>{c.phone}</Text>
                </Pressable>
              ))
            )}
          </Card>
        </>
      ) : !error ? (
        <EmptyState title="No data" description="Safety dashboard is empty for this plant." />
      ) : null}

      {plantId ? (
        <Text style={styles.plantHint}>Plant scope loaded.</Text>
      ) : null}
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
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  linkBtn: { flexGrow: 1, minWidth: '45%' },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpi: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    minHeight: 88,
    justifyContent: 'center',
  },
  kpiDanger: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  kpiWarn: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  kpiValue: { ...typography.title, color: colors.text, marginBottom: 4 },
  kpiValueDanger: { color: colors.danger },
  kpiValueWarn: { color: '#B45309' },
  kpiLabel: { ...typography.caption, color: colors.textMuted, lineHeight: 16 },
  section: { ...typography.section, color: colors.text, marginBottom: spacing.sm },
  card: { marginBottom: spacing.lg, gap: spacing.sm },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  textCol: { flex: 1, minWidth: 0 },
  incidentTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  contactName: { ...typography.body, fontWeight: '600', color: colors.text },
  phone: { ...typography.body, color: colors.brandDark, fontWeight: '600' },
  plantHint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
});
