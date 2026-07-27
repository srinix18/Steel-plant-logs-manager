import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  createFuelRate,
  createLabourRate,
  createMaintenanceRate,
  createPowerRate,
  createRawMaterialRate,
  fetchFuelRates,
  fetchLabourRates,
  fetchMaintenanceRates,
  fetchPowerRates,
  fetchRawMaterialRates,
  formatCurrency,
  type FuelCostRate,
  type LabourCostRate,
  type MaintenanceCostRate,
  type PowerCostRate,
  type RawMaterialCostRate,
} from '@/src/api/finance';
import { fetchMasterMaterials, type MasterMaterial } from '@/src/api/foundation';
import { fetchPlants } from '@/src/api/lookups';
import { useAuth } from '@/src/auth/AuthContext';
import { FINANCE_MASTERS_WRITE_ROLES, hasRole } from '@/src/auth/roles';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

type Tab = 'raw_materials' | 'power' | 'fuel' | 'labour' | 'maintenance';

const TABS: { id: Tab; label: string }[] = [
  { id: 'raw_materials', label: 'Raw Materials' },
  { id: 'power', label: 'Power' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'labour', label: 'Labour' },
  { id: 'maintenance', label: 'Maintenance' },
];

const MAINT_CATEGORIES = [
  { value: 'equipment', label: 'equipment' },
  { value: 'quality', label: 'quality' },
  { value: 'safety', label: 'safety' },
  { value: 'energy', label: 'energy' },
  { value: 'process', label: 'process' },
];

type FormState = {
  material_id: string;
  rate: string;
  fuel_name: string;
  role_label: string;
  category: string;
  cost_per_unit: string;
  effective_from: string;
};

function emptyForm(): FormState {
  return {
    material_id: '',
    rate: '',
    fuel_name: '',
    role_label: 'Operator',
    category: 'equipment',
    cost_per_unit: '8.5',
    effective_from: new Date().toISOString().slice(0, 10),
  };
}

/**
 * P5-FIN-MASTERS — cost rate masters (port of CostMastersPage, no DesktopOnlyGate).
 */
export function CostMastersScreen() {
  const { user } = useAuth();
  const canWrite = user ? hasRole(user.role, FINANCE_MASTERS_WRITE_ROLES) : false;

  const [tab, setTab] = useState<Tab>('raw_materials');
  const [plantId, setPlantId] = useState('');
  const [orgId, setOrgId] = useState(user?.organisation_id || '');
  const [rawMaterials, setRawMaterials] = useState<RawMaterialCostRate[]>([]);
  const [powerRates, setPowerRates] = useState<PowerCostRate[]>([]);
  const [fuelRates, setFuelRates] = useState<FuelCostRate[]>([]);
  const [labourRates, setLabourRates] = useState<LabourCostRate[]>([]);
  const [maintRates, setMaintRates] = useState<MaintenanceCostRate[]>([]);
  const [materials, setMaterials] = useState<MasterMaterial[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const plants = await fetchPlants();
        const pid = plantId || plants[0]?.id || '';
        const oid = orgId || plants[0]?.organisation_id || user?.organisation_id || '';
        if (!plantId && pid) setPlantId(pid);
        if (!orgId && oid) setOrgId(oid);

        const [rm, pw, fu, lb, mt, mats] = await Promise.all([
          fetchRawMaterialRates(oid || undefined),
          fetchPowerRates(pid || undefined),
          fetchFuelRates(pid || undefined),
          fetchLabourRates(pid || undefined),
          fetchMaintenanceRates(pid || undefined),
          fetchMasterMaterials(),
        ]);
        setRawMaterials(rm);
        setPowerRates(pw);
        setFuelRates(fu);
        setLabourRates(lb);
        setMaintRates(mt);
        setMaterials(mats);
        setForm((f) => ({
          ...f,
          material_id: f.material_id || mats[0]?.id || '',
        }));
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orgId, plantId, user?.organisation_id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const materialOptions = useMemo(
    () => materials.map((m) => ({ value: m.id, label: `${m.code} — ${m.name}` })),
    [materials]
  );

  const handleCreate = async () => {
    if (!canWrite) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (tab === 'raw_materials') {
        if (!orgId || !form.material_id || !form.rate.trim()) {
          throw new Error('Organisation, material, and rate are required.');
        }
        await createRawMaterialRate({
          organisation_id: orgId,
          material_id: form.material_id,
          rate: Number(form.rate),
          effective_from: form.effective_from,
        });
      } else if (tab === 'power') {
        if (!plantId) throw new Error('Plant is required.');
        await createPowerRate({
          plant_id: plantId,
          cost_per_unit: Number(form.cost_per_unit) || 0,
          effective_from: form.effective_from,
        });
      } else if (tab === 'fuel') {
        if (!plantId || !form.fuel_name.trim()) {
          throw new Error('Plant and fuel name are required.');
        }
        await createFuelRate({
          plant_id: plantId,
          fuel_name: form.fuel_name.trim(),
          rate: Number(form.rate) || 0,
          effective_from: form.effective_from,
        });
      } else if (tab === 'labour') {
        if (!plantId || !form.role_label.trim()) {
          throw new Error('Plant and role are required.');
        }
        await createLabourRate({
          plant_id: plantId,
          role_label: form.role_label.trim(),
          cost_per_hour: Number(form.rate) || 350,
        });
      } else if (tab === 'maintenance') {
        if (!plantId) throw new Error('Plant is required.');
        await createMaintenanceRate({
          plant_id: plantId,
          category: form.category,
          default_cost: Number(form.rate) || 5000,
        });
      }
      setMessage('Rate added.');
      setForm((f) => ({
        ...emptyForm(),
        material_id: f.material_id || materials[0]?.id || '',
        category: f.category,
        role_label: f.role_label || 'Operator',
      }));
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !refreshing) {
    return <LoadingView message="Loading cost masters…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Cost Masters</Text>
      <Text style={styles.subtitle}>Maintain operational cost rates (not accounting)</Text>

      {error ? <ErrorBanner message={error} /> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                setTab(t.id);
                setMessage(null);
                setError(null);
              }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {canWrite ? (
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Add rate</Text>
          {tab === 'raw_materials' ? (
            materialOptions.length === 0 ? (
              <Text style={styles.hint}>No materials in masters.</Text>
            ) : (
              <SelectSheet
                label="Material"
                value={form.material_id}
                options={materialOptions}
                onChange={(material_id) => setForm((f) => ({ ...f, material_id }))}
              />
            )
          ) : null}
          {tab === 'fuel' ? (
            <TextField
              label="Fuel name"
              value={form.fuel_name}
              onChangeText={(fuel_name) => setForm((f) => ({ ...f, fuel_name }))}
            />
          ) : null}
          {tab === 'labour' ? (
            <TextField
              label="Role"
              value={form.role_label}
              onChangeText={(role_label) => setForm((f) => ({ ...f, role_label }))}
            />
          ) : null}
          {tab === 'maintenance' ? (
            <SelectSheet
              label="Category"
              value={form.category}
              options={MAINT_CATEGORIES}
              onChange={(category) => setForm((f) => ({ ...f, category }))}
            />
          ) : null}
          {tab === 'power' ? (
            <TextField
              label="₹/kWh"
              value={form.cost_per_unit}
              onChangeText={(cost_per_unit) => setForm((f) => ({ ...f, cost_per_unit }))}
              keyboardType="decimal-pad"
            />
          ) : (
            <TextField
              label={tab === 'maintenance' ? 'Default cost' : 'Rate'}
              value={form.rate}
              onChangeText={(rate) => setForm((f) => ({ ...f, rate }))}
              keyboardType="decimal-pad"
            />
          )}
          {(tab === 'raw_materials' || tab === 'power' || tab === 'fuel') && (
            <TextField
              label="Effective from (YYYY-MM-DD)"
              value={form.effective_from}
              onChangeText={(effective_from) => setForm((f) => ({ ...f, effective_from }))}
              autoCapitalize="none"
            />
          )}
          <Button title="Add" onPress={() => void handleCreate()} loading={saving} />
        </Card>
      ) : (
        <Text style={styles.readOnly}>View only — plant admin / CEO can edit rates.</Text>
      )}

      {tab === 'raw_materials' &&
        (rawMaterials.length === 0 ? (
          <EmptyState title="No raw material rates." />
        ) : (
          <View style={styles.list}>
            {rawMaterials.map((r) => (
              <Card key={r.id} style={styles.row}>
                <Text style={styles.rowTitle}>
                  {r.material_code || '—'} — {r.material_name || r.material_id}
                </Text>
                <Text style={styles.rowMeta}>
                  {formatCurrency(r.rate)}/{r.unit} · from {r.effective_from}
                </Text>
              </Card>
            ))}
          </View>
        ))}

      {tab === 'power' &&
        (powerRates.length === 0 ? (
          <EmptyState title="No power rates." />
        ) : (
          <View style={styles.list}>
            {powerRates.map((r) => (
              <Card key={r.id} style={styles.row}>
                <Text style={styles.rowTitle}>₹{r.cost_per_unit}/unit</Text>
                <Text style={styles.rowMeta}>From {r.effective_from}</Text>
              </Card>
            ))}
          </View>
        ))}

      {tab === 'fuel' &&
        (fuelRates.length === 0 ? (
          <EmptyState title="No fuel rates." />
        ) : (
          <View style={styles.list}>
            {fuelRates.map((r) => (
              <Card key={r.id} style={styles.row}>
                <Text style={styles.rowTitle}>{r.fuel_name}</Text>
                <Text style={styles.rowMeta}>
                  {formatCurrency(r.rate)}/{r.unit}
                </Text>
              </Card>
            ))}
          </View>
        ))}

      {tab === 'labour' &&
        (labourRates.length === 0 ? (
          <EmptyState title="No labour rates." />
        ) : (
          <View style={styles.list}>
            {labourRates.map((r) => (
              <Card key={r.id} style={styles.row}>
                <Text style={styles.rowTitle}>{r.role_label}</Text>
                <Text style={styles.rowMeta}>{formatCurrency(r.cost_per_hour)}/hr</Text>
              </Card>
            ))}
          </View>
        ))}

      {tab === 'maintenance' &&
        (maintRates.length === 0 ? (
          <EmptyState title="No maintenance rates." />
        ) : (
          <View style={styles.list}>
            {maintRates.map((r) => (
              <Card key={r.id} style={styles.row}>
                <Text style={styles.rowTitle}>{r.category}</Text>
                <Text style={styles.rowMeta}>Default {formatCurrency(r.default_cost)}</Text>
              </Card>
            ))}
          </View>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  message: {
    ...typography.body,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.input,
    backgroundColor: colors.brandSoft,
  },
  tabActive: { backgroundColor: colors.brand },
  tabText: { ...typography.caption, color: colors.text },
  tabTextActive: { color: '#FFFFFF', fontWeight: '600' },
  formCard: { marginBottom: spacing.md, gap: spacing.sm },
  formTitle: { ...typography.section, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted },
  readOnly: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  list: { gap: spacing.sm },
  row: { gap: 2 },
  rowTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  rowMeta: { ...typography.caption, color: colors.textMuted },
});
