import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { fetchOrganisations, type Organisation } from '@/src/api/admin';
import { getErrorMessage } from '@/src/api/client';
import { fetchDepartments, fetchPlants, fetchProcesses } from '@/src/api/lookups';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { PROCESS_LOG_SHEETS } from '@/src/features/admin/processLogSheets';
import type { Department, Plant, Process } from '@/src/types/platform';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * P5-ADM-DEPT — cross-org departments list (port of AdminDepartmentsPage).
 */
export function AdminDepartmentsScreen() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [orgFilter, setOrgFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [depts, orgs, plts, procs] = await Promise.all([
        fetchDepartments(),
        fetchOrganisations(),
        fetchPlants(),
        fetchProcesses(),
      ]);
      setDepartments(depts);
      setOrganisations(orgs);
      setPlants(plts);
      setProcesses(procs);
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

  const orgOptions = useMemo(
    () => [
      { value: '', label: 'All organisations' },
      ...organisations.map((o) => ({ value: o.id, label: o.name })),
    ],
    [organisations]
  );

  const filtered = useMemo(
    () => (orgFilter ? departments.filter((d) => d.organisation_id === orgFilter) : departments),
    [departments, orgFilter]
  );

  const orgName = (id: string) => organisations.find((o) => o.id === id)?.name ?? '—';
  const plantName = (id: string) => plants.find((p) => p.id === id)?.name ?? '—';

  if (loading && !refreshing) {
    return <LoadingView message="Loading departments…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Departments</Text>
      <Text style={styles.subtitle}>Every department across all organisations.</Text>

      {error ? <ErrorBanner message={error} /> : null}

      <SelectSheet
        label="Filter by organisation"
        options={orgOptions}
        value={orgFilter}
        onChange={setOrgFilter}
        placeholder="All organisations"
      />

      {filtered.length === 0 ? (
        <EmptyState title="No departments found." />
      ) : (
        <View style={styles.list}>
          {filtered.map((d) => {
            const procs = processes.filter((p) => p.department_id === d.id);
            const sheets = procs
              .map((p) => PROCESS_LOG_SHEETS[p.code])
              .filter((s): s is { doc: string; label: string } => Boolean(s));
            // Dedupe by doc
            const uniqueSheets = sheets.filter(
              (s, i, arr) => arr.findIndex((x) => x.doc === s.doc) === i
            );
            return (
              <Card key={d.id} style={styles.row}>
                <Text style={styles.rowTitle}>
                  {d.name} <Text style={styles.rowMeta}>({d.code})</Text>
                </Text>
                <Text style={styles.rowMeta}>Org: {orgName(d.organisation_id)}</Text>
                <Text style={styles.rowMeta}>Plant: {plantName(d.plant_id)}</Text>
                <Text style={styles.rowMeta}>
                  Processes:{' '}
                  {procs.length
                    ? procs.map((p) => `${p.code} (${p.name})`).join(' · ')
                    : '—'}
                </Text>
                {uniqueSheets.length > 0 ? (
                  <View style={styles.sheetLinks}>
                    <Text style={styles.sheetLabel}>Log sheets</Text>
                    {uniqueSheets.map((sheet) => (
                      <Pressable
                        key={sheet.doc}
                        onPress={() =>
                          router.push(
                            `/(app)/admin/sheets?doc=${encodeURIComponent(sheet.doc)}` as Href
                          )
                        }
                        accessibilityRole="link"
                      >
                        <Text style={styles.link}>{sheet.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  list: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.md },
  row: { gap: spacing.xs },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  rowMeta: { ...typography.caption, color: colors.textMuted },
  sheetLinks: { marginTop: spacing.xs, gap: spacing.xs },
  sheetLabel: { ...typography.caption, color: colors.text, fontWeight: '600' },
  link: { ...typography.caption, color: colors.brand, fontWeight: '600' },
});
