import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  addAssetResponsibility,
  createAssetEvent,
  createFoundationAsset,
  fetchAssetEvents,
  fetchAssetResponsibilities,
  fetchFoundationAssetGroups,
  fetchFoundationAssets,
  formatRemainingLife,
  updateFoundationAsset,
  type AssetEvent,
  type AssetResponsibility,
  type FoundationAsset,
  type FoundationAssetGroup,
} from '@/src/api/foundation';
import { fetchDepartments, fetchPlantUsers, fetchPlants } from '@/src/api/lookups';
import {
  fetchAssetMaintenanceHistory,
  type AssetMaintenanceHistory,
} from '@/src/api/maintenancePm';
import { useAuth } from '@/src/auth/AuthContext';
import { HOD_TIER_ROLES, hasRole } from '@/src/auth/roles';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import type { Department } from '@/src/types/platform';
import type { User } from '@/src/types/user';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

type DetailTab = 'details' | 'maintenance';

type FormState = {
  group_id: string;
  department_id: string;
  asset_no: string;
  name: string;
  status: string;
  remarks: string;
  life_unit: string;
  life_expected: string;
  life_current: string;
};

function emptyForm(groups: FoundationAssetGroup[]): FormState {
  return {
    group_id: groups[0]?.id || '',
    department_id: '',
    asset_no: '',
    name: '',
    status: 'active',
    remarks: '',
    life_unit: 'heats',
    life_expected: '',
    life_current: '0',
  };
}

function formFromAsset(asset: FoundationAsset, groups: FoundationAssetGroup[]): FormState {
  const unit = (asset.expected_life?.unit as string) || 'heats';
  return {
    group_id: asset.group_id || groups[0]?.id || '',
    department_id: asset.department_id || '',
    asset_no: asset.asset_no,
    name: asset.name,
    status: asset.status || 'active',
    remarks: asset.remarks || '',
    life_unit: unit,
    life_expected: String((asset.expected_life?.value as number) ?? ''),
    life_current: String(asset.life_counters?.[unit] ?? 0),
  };
}

function statusTone(status: string): 'success' | 'danger' | 'brand' | 'neutral' {
  const key = status.toLowerCase();
  if (key === 'active' || key === 'healthy') return 'success';
  if (key === 'critical' || key === 'inactive') return 'danger';
  if (key === 'warning' || key === 'maintenance') return 'brand';
  return 'neutral';
}

/**
 * P5-FND-ASSETS — asset registry (port of AssetsPage + AssetFormModal).
 */
export function FoundationAssetsScreen() {
  const { user } = useAuth();
  const canEdit = user ? hasRole(user.role, HOD_TIER_ROLES) : false;

  const [plantId, setPlantId] = useState('');
  const [assets, setAssets] = useState<FoundationAsset[]>([]);
  const [groups, setGroups] = useState<FoundationAssetGroup[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [plantUsers, setPlantUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<FoundationAsset | null>(null);
  const [events, setEvents] = useState<AssetEvent[]>([]);
  const [responsibilities, setResponsibilities] = useState<AssetResponsibility[]>([]);
  const [maintHistory, setMaintHistory] = useState<AssetMaintenanceHistory | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('details');
  const [respUserId, setRespUserId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editAsset, setEditAsset] = useState<FoundationAsset | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm([]));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const plants = await fetchPlants();
        const pid = plantId || plants[0]?.id || '';
        if (!plantId && pid) setPlantId(pid);
        const [a, g, d, u] = await Promise.all([
          fetchFoundationAssets({ plant_id: pid || undefined }),
          fetchFoundationAssetGroups(pid || undefined),
          fetchDepartments(pid || undefined),
          pid ? fetchPlantUsers(pid).catch(() => [] as User[]) : Promise.resolve([] as User[]),
        ]);
        setAssets(a);
        setGroups(g);
        setDepartments(d);
        setPlantUsers(u);
        const sid = selectedIdRef.current;
        if (sid) {
          setSelected(a.find((x) => x.id === sid) ?? null);
        }
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [plantId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const selectAsset = async (asset: FoundationAsset) => {
    selectedIdRef.current = asset.id;
    setSelected(asset);
    setDetailTab('details');
    setMessage(null);
    setError(null);
    try {
      const [ev, resp, hist] = await Promise.all([
        fetchAssetEvents(asset.id),
        fetchAssetResponsibilities(asset.id),
        fetchAssetMaintenanceHistory(asset.id).catch(() => null),
      ]);
      setEvents(ev);
      setResponsibilities(resp);
      setMaintHistory(hist);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const openCreate = () => {
    setEditAsset(null);
    setForm(emptyForm(groups));
    setShowForm(true);
    setMessage(null);
    setError(null);
  };

  const openEdit = (asset: FoundationAsset) => {
    setEditAsset(asset);
    setForm(formFromAsset(asset, groups));
    setShowForm(true);
    setMessage(null);
    setError(null);
  };

  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: g.id, label: `${g.name} (${g.code})` })),
    [groups]
  );
  const deptOptions = useMemo(
    () => [
      { value: '', label: 'No department' },
      ...departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` })),
    ],
    [departments]
  );
  const userOptions = useMemo(
    () => plantUsers.map((u) => ({ value: u.id, label: u.full_name || u.email })),
    [plantUsers]
  );
  const statusOptions = useMemo(
    () => [
      { value: 'active', label: 'active' },
      { value: 'inactive', label: 'inactive' },
      { value: 'maintenance', label: 'maintenance' },
    ],
    []
  );

  const saveForm = async () => {
    if (!form.asset_no.trim() || !form.name.trim() || !form.group_id) {
      setError('Asset code, name, and group are required.');
      return;
    }
    const unit = form.life_unit.trim() || 'heats';
    const payload: Record<string, unknown> = {
      group_id: form.group_id,
      department_id: form.department_id || null,
      asset_no: form.asset_no.trim(),
      name: form.name.trim(),
      status: form.status || 'active',
      remarks: form.remarks.trim() || null,
      expected_life: form.life_expected
        ? { unit, value: Number(form.life_expected) }
        : {},
      life_counters: { [unit]: Number(form.life_current) || 0 },
    };
    setSaving(true);
    setError(null);
    try {
      if (editAsset) {
        await updateFoundationAsset(editAsset.id, payload);
        setMessage(`Updated ${form.asset_no}`);
      } else {
        if (!plantId) throw new Error('No plant selected.');
        const created = await createFoundationAsset({ ...payload, plant_id: plantId });
        setMessage(`Created ${created.asset_no}`);
      }
      setShowForm(false);
      setEditAsset(null);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const logManualEvent = async () => {
    if (!selected) return;
    setError(null);
    try {
      await createAssetEvent(selected.id, {
        event_type: 'manual_entry',
        occurred_at: new Date().toISOString(),
        payload: { note: 'Manual inspection entry' },
      });
      setEvents(await fetchAssetEvents(selected.id));
      setMessage('Manual event logged.');
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const assignResponsibility = async () => {
    if (!selected || !respUserId) return;
    setError(null);
    try {
      await addAssetResponsibility(selected.id, { user_id: respUserId });
      setResponsibilities(await fetchAssetResponsibilities(selected.id));
      setRespUserId(null);
      setMessage('Responsibility assigned.');
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  if (loading && assets.length === 0) {
    return <LoadingView message="Loading assets…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Asset Registry</Text>
      <Text style={styles.sub}>Plant equipment, life tracking, and manual events.</Text>

      {canEdit ? (
        <View style={styles.actions}>
          <Button title="Add asset" size="sm" onPress={openCreate} />
        </View>
      ) : null}

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}

      {showForm ? (
        <Card style={styles.formCard}>
          <Text style={styles.section}>{editAsset ? 'Edit asset' : 'New asset'}</Text>
          <TextField
            label="Asset code"
            value={form.asset_no}
            editable={!editAsset}
            onChangeText={(asset_no) => setForm((f) => ({ ...f, asset_no }))}
            autoCapitalize="characters"
          />
          <TextField
            label="Name"
            value={form.name}
            onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          />
          <SelectSheet
            label="Group"
            options={groupOptions}
            value={form.group_id || null}
            onChange={(group_id) => setForm((f) => ({ ...f, group_id }))}
          />
          <SelectSheet
            label="Department"
            options={deptOptions}
            value={form.department_id || ''}
            onChange={(department_id) => setForm((f) => ({ ...f, department_id }))}
          />
          <SelectSheet
            label="Status"
            options={statusOptions}
            value={form.status}
            onChange={(status) => setForm((f) => ({ ...f, status }))}
          />
          <TextField
            label="Life unit"
            value={form.life_unit}
            onChangeText={(life_unit) => setForm((f) => ({ ...f, life_unit }))}
            placeholder="heats"
          />
          <TextField
            label="Expected life"
            value={form.life_expected}
            onChangeText={(life_expected) => setForm((f) => ({ ...f, life_expected }))}
            keyboardType="number-pad"
          />
          <TextField
            label="Current life"
            value={form.life_current}
            onChangeText={(life_current) => setForm((f) => ({ ...f, life_current }))}
            keyboardType="number-pad"
          />
          <TextField
            label="Remarks"
            value={form.remarks}
            onChangeText={(remarks) => setForm((f) => ({ ...f, remarks }))}
          />
          <View style={styles.formActions}>
            <Button
              title="Cancel"
              variant="secondary"
              size="sm"
              onPress={() => {
                setShowForm(false);
                setEditAsset(null);
              }}
            />
            <Button
              title={saving ? 'Saving…' : 'Save'}
              size="sm"
              disabled={saving}
              onPress={() => void saveForm()}
            />
          </View>
        </Card>
      ) : null}

      <Text style={styles.section}>Assets</Text>
      {assets.length === 0 ? (
        <EmptyState title="No assets found." description="Add an asset to start the registry." />
      ) : (
        assets.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => void selectAsset(a)}
            style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
          >
            <View style={styles.listTop}>
              <View style={styles.grow}>
                <Text style={styles.assetNo}>{a.asset_no}</Text>
                <Text style={styles.name}>{a.name}</Text>
                <Text style={styles.meta}>{a.group_name || '—'}</Text>
              </View>
              <Badge label={a.status} tone={statusTone(a.status)} />
            </View>
            <Text style={styles.meta}>Remaining {formatRemainingLife(a.remaining_life)}</Text>
          </Pressable>
        ))
      )}

      <Text style={styles.section}>Detail</Text>
      {!selected ? (
        <EmptyState title="Select an asset" description="Tap a row to view details and events." />
      ) : (
        <Card style={styles.detailCard}>
          <Text style={styles.detailTitle}>
            {selected.asset_no} — {selected.name}
          </Text>
          <View style={styles.tabs}>
            <Pressable
              onPress={() => setDetailTab('details')}
              style={[styles.tab, detailTab === 'details' && styles.tabActive]}
            >
              <Text style={[styles.tabText, detailTab === 'details' && styles.tabTextActive]}>
                Details
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setDetailTab('maintenance')}
              style={[styles.tab, detailTab === 'maintenance' && styles.tabActive]}
            >
              <Text
                style={[styles.tabText, detailTab === 'maintenance' && styles.tabTextActive]}
              >
                Maintenance
              </Text>
            </Pressable>
          </View>

          {detailTab === 'details' ? (
            <>
              <Text style={styles.meta}>
                Life: {JSON.stringify(selected.life_counters)}
              </Text>
              <Text style={styles.meta}>
                Expected: {JSON.stringify(selected.expected_life)}
              </Text>
              {selected.last_inspection_at ? (
                <Text style={styles.meta}>
                  Last inspection: {new Date(selected.last_inspection_at).toLocaleString()}
                </Text>
              ) : null}

              {canEdit ? (
                <View style={styles.formActions}>
                  <Button
                    title="Edit"
                    variant="secondary"
                    size="sm"
                    onPress={() => openEdit(selected)}
                  />
                  <Button
                    title="Log manual event"
                    variant="secondary"
                    size="sm"
                    onPress={() => void logManualEvent()}
                  />
                </View>
              ) : null}

              <Text style={styles.subSection}>Events</Text>
              {events.length === 0 ? (
                <Text style={styles.meta}>No events recorded.</Text>
              ) : (
                events.map((e) => (
                  <Text key={e.id} style={styles.meta}>
                    {e.event_type} — {new Date(e.occurred_at).toLocaleString()}
                  </Text>
                ))
              )}

              <Text style={styles.subSection}>Responsibilities</Text>
              {responsibilities.length === 0 ? (
                <Text style={styles.meta}>No assignments.</Text>
              ) : (
                responsibilities.map((r) => (
                  <Text key={r.id} style={styles.meta}>
                    {r.user_name || r.user_id} ({r.role_label})
                    {r.is_primary ? ' — primary' : ''}
                  </Text>
                ))
              )}

              {canEdit && userOptions.length > 0 ? (
                <View style={styles.assignBlock}>
                  <SelectSheet
                    label="Assign employee"
                    options={userOptions}
                    value={respUserId}
                    onChange={setRespUserId}
                  />
                  <Button
                    title="Assign"
                    size="sm"
                    disabled={!respUserId}
                    onPress={() => void assignResponsibility()}
                  />
                </View>
              ) : null}
            </>
          ) : maintHistory ? (
            <>
              {maintHistory.last_pm_at ? (
                <Text style={styles.meta}>
                  Last PM: {new Date(maintHistory.last_pm_at).toLocaleString()}
                </Text>
              ) : null}
              {maintHistory.next_pm_due_at ? (
                <Text style={styles.meta}>
                  Next PM due: {new Date(maintHistory.next_pm_due_at).toLocaleString()}
                </Text>
              ) : null}
              <Text style={styles.meta}>
                Total maintenance cost: ₹
                {maintHistory.total_maintenance_cost.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.subSection}>History timeline</Text>
              {maintHistory.entries.length === 0 ? (
                <Text style={styles.meta}>No maintenance history recorded.</Text>
              ) : (
                maintHistory.entries.map((entry) => (
                  <View key={entry.id} style={styles.timelineRow}>
                    <Text style={styles.meta}>
                      {new Date(entry.occurred_at).toLocaleString()}
                    </Text>
                    <Text style={styles.name}>{entry.title}</Text>
                    <Text style={styles.meta}>
                      {entry.entry_type.replace(/_/g, ' ')}
                      {entry.status ? ` — ${entry.status}` : ''}
                    </Text>
                  </View>
                ))
              )}
            </>
          ) : (
            <Text style={styles.meta}>Maintenance history unavailable.</Text>
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  actions: { marginTop: spacing.md },
  banner: { marginTop: spacing.md },
  ok: { ...typography.caption, color: colors.success, marginTop: spacing.sm },
  section: {
    ...typography.section,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  subSection: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  formCard: { marginTop: spacing.md, gap: spacing.sm },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.85 },
  listTop: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1, minWidth: 0 },
  assetNo: { ...typography.body, color: colors.brandDark, fontWeight: '700' },
  name: { ...typography.body, color: colors.text, fontWeight: '600' },
  meta: { ...typography.caption, color: colors.textMuted },
  detailCard: { gap: spacing.sm },
  detailTitle: { ...typography.section, color: colors.text },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.background,
    minHeight: 44,
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.brand },
  tabText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.card },
  assignBlock: { gap: spacing.sm, marginTop: spacing.sm },
  timelineRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
});
