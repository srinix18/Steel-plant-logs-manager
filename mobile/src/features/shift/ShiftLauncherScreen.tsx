import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  fetchPlants,
  fetchPreviousHandover,
  fetchProcessInstances,
  fetchProcesses,
  fetchShifts,
  fetchSteelGrades,
} from '@/src/api/lookups';
import { createProcessRun, fetchActiveRuns } from '@/src/api/processRuns';
import { useAuth } from '@/src/auth/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { ListRow } from '@/src/components/ui/ListRow';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import {
  buildCreateRunPayload,
  filterProcessOptions,
  showsGradeField,
  showsShiftField,
  startButtonLabel,
} from '@/src/features/shift/processOptions';
import type { ProcessRun } from '@/src/types/processRun';
import type {
  Process,
  ProcessInstance,
  Shift,
  ShiftHandoverNote,
} from '@/src/types/platform';
import type { SteelGrade } from '@/src/features/run-host/section-data/types';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * P2-ENGINE-04 — Shift launcher (port of web ShiftDashboard).
 */
export function ShiftLauncherScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [processCode, setProcessCode] = useState('');
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [activeRuns, setActiveRuns] = useState<ProcessRun[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [grades, setGrades] = useState<SteelGrade[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [previousHandover, setPreviousHandover] = useState<ShiftHandoverNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [plantId, setPlantId] = useState<string | null>(null);

  const allowedProcessOptions = useMemo(
    () => filterProcessOptions(processes.map((p) => p.code)),
    [processes]
  );

  const processMeta =
    allowedProcessOptions.find((p) => p.code === processCode) ?? allowedProcessOptions[0];

  const isDaily = processMeta?.runType === 'daily';
  const showShift = showsShiftField(processMeta?.runType);
  const showGrade = showsGradeField(processCode || processMeta?.code || '', processMeta?.runType);

  const loadBootstrap = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [plants, procs, gradeList] = await Promise.all([
          fetchPlants(),
          fetchProcesses(),
          fetchSteelGrades(),
        ]);
        setProcesses(procs);
        setGrades(gradeList);

        const preferredPlant =
          (user?.plant_id && plants.find((p) => p.id === user.plant_id)) || plants[0];
        if (preferredPlant) {
          setPlantId(preferredPlant.id);
          const [shiftList, runs] = await Promise.all([
            fetchShifts(preferredPlant.id),
            fetchActiveRuns(preferredPlant.id).catch(() => [] as ProcessRun[]),
          ]);
          setShifts(shiftList);
          setActiveRuns(runs);
        } else {
          setPlantId(null);
          setShifts([]);
          setActiveRuns([]);
        }
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.plant_id]
  );

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (!allowedProcessOptions.length) return;
    if (!allowedProcessOptions.some((p) => p.code === processCode)) {
      setProcessCode(allowedProcessOptions[0].code);
    }
  }, [allowedProcessOptions, processCode]);

  useEffect(() => {
    const proc = processes.find((p) => p.code === processCode);
    setSelectedInstance('');
    if (!proc) {
      setInstances([]);
      return;
    }
    let cancelled = false;
    fetchProcessInstances(proc.id)
      .then((list) => {
        if (!cancelled) setInstances(list);
      })
      .catch((e) => {
        if (!cancelled) {
          setInstances([]);
          setError(getErrorMessage(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [processCode, processes]);

  useEffect(() => {
    if (!user?.department_id || !selectedShift || isDaily) {
      setPreviousHandover(null);
      return;
    }
    let cancelled = false;
    fetchPreviousHandover(user.department_id, selectedShift)
      .then((note) => {
        if (!cancelled) setPreviousHandover(note);
      })
      .catch(() => {
        if (!cancelled) setPreviousHandover(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.department_id, selectedShift, isDaily]);

  async function onStartRun() {
    if (!selectedInstance || !processMeta) return;
    setStarting(true);
    setError(null);
    try {
      const payload = buildCreateRunPayload({
        runType: processMeta.runType,
        shiftId: selectedShift,
        gradeId: selectedGrade,
        isDaily: Boolean(isDaily),
        showGrade,
      });
      const run = await createProcessRun(selectedInstance, payload);
      router.push(`/(app)/heat/${run.id}` as Href);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setStarting(false);
    }
  }

  if (loading && !processes.length) {
    return <LoadingView message="Loading shift dashboard…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void loadBootstrap(true)}>
      <Text style={styles.title}>Shift Dashboard</Text>
      <Text style={styles.sub}>Start a shop-floor run, then fill the log sheet on your phone.</Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {previousHandover ? (
        <Card style={styles.handover}>
          <Text style={styles.handoverTitle}>
            Previous shift handover (Shift {previousHandover.shift_code},{' '}
            {previousHandover.note_date})
          </Text>
          <Text style={styles.handoverBody}>{previousHandover.note}</Text>
          {previousHandover.author_name ? (
            <Text style={styles.handoverAuthor}>— {previousHandover.author_name}</Text>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.section}>Start New Run</Text>
        {!allowedProcessOptions.length ? (
          <EmptyState
            title="No processes available"
            description="No processes are scoped to your department for this launcher."
          />
        ) : (
          <View style={styles.form}>
            <SelectSheet
              label="Process"
              options={allowedProcessOptions.map((p) => ({
                label: p.label,
                value: p.code,
              }))}
              value={processCode || null}
              onChange={(code) => {
                setProcessCode(code);
                setSelectedShift('');
                setSelectedGrade('');
              }}
            />

            <SelectSheet
              label={processMeta?.instanceLabel ?? 'Instance'}
              options={instances.map((i) => ({ label: i.name, value: i.id }))}
              value={selectedInstance || null}
              onChange={setSelectedInstance}
              placeholder={`Select ${(processMeta?.instanceLabel ?? 'instance').toLowerCase()}`}
            />

            {showShift ? (
              <SelectSheet
                label="Shift"
                options={shifts.map((s) => ({ label: s.name, value: s.id }))}
                value={selectedShift || null}
                onChange={setSelectedShift}
                placeholder="Select shift"
              />
            ) : null}

            {showGrade ? (
              <SelectSheet
                label="Grade"
                options={grades.map((g) => ({
                  label: g.description ? `${g.code} — ${g.description}` : g.code,
                  value: g.id,
                }))}
                value={selectedGrade || null}
                onChange={setSelectedGrade}
                placeholder="Select grade"
              />
            ) : null}

            <Button
              title={
                starting
                  ? 'Starting…'
                  : startButtonLabel(processCode || processMeta?.code || '', processMeta?.runType)
              }
              size="lg"
              fullWidth
              loading={starting}
              disabled={!selectedInstance || starting || !processMeta}
              onPress={() => void onStartRun()}
            />
          </View>
        )}
      </Card>

      <Text style={styles.activeTitle}>Active Runs</Text>
      {!plantId ? (
        <Text style={styles.muted}>No plant available.</Text>
      ) : activeRuns.length === 0 ? (
        <Text style={styles.muted}>No active runs on this plant.</Text>
      ) : (
        activeRuns.map((run) => (
          <ListRow
            key={run.id}
            title={run.run_number}
            subtitle={run.run_type}
            onPress={() => router.push(`/(app)/heat/${run.id}` as Href)}
            right={<Badge label={run.current_state.replace(/_/g, ' ')} tone="brand" />}
          />
        ))
      )}
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
  handover: {
    marginBottom: spacing.md,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  handoverTitle: { ...typography.caption, fontWeight: '700', color: '#92400E' },
  handoverBody: { ...typography.body, color: '#78350F', marginTop: spacing.xs, lineHeight: 22 },
  handoverAuthor: { ...typography.caption, color: '#92400E', marginTop: spacing.xs },
  section: { ...typography.section, color: colors.text, marginBottom: spacing.sm },
  form: { gap: spacing.md },
  activeTitle: {
    ...typography.section,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  muted: { ...typography.caption, color: colors.textMuted },
});
