import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  adjustInventory,
  fetchInventoryPulse,
  inventoryStatusTone,
  type InventoryItem,
} from '@/src/api/inventoryPulse';
import { fetchPlants } from '@/src/api/lookups';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * P5-INV — inventory pulse + adjust (web list + mobile-required adjust).
 */
export function InventoryPulseScreen() {
  const [plantId, setPlantId] = useState('');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    material_code: '',
    quantity: '',
    quality_grade: '',
    location: '',
  });

  useEffect(() => {
    fetchPlants()
      .then((plants) => {
        if (plants[0]) setPlantId(plants[0].id);
        else {
          setLoading(false);
          setError('No plants available.');
        }
      })
      .catch((e) => {
        setLoading(false);
        setError(getErrorMessage(e));
      });
  }, []);

  const load = useCallback(
    async (soft = false) => {
      if (!plantId) return;
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const list = await fetchInventoryPulse(plantId);
        setItems(list);
        setForm((f) => ({
          ...f,
          material_code: f.material_code || list[0]?.material_code || '',
        }));
      } catch (e) {
        setError(getErrorMessage(e));
        setItems([]);
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

  const critical = useMemo(
    () => items.filter((i) => i.status === 'critical').length,
    [items]
  );

  const materialOptions = useMemo(
    () =>
      items.map((i) => ({
        value: i.material_code,
        label: `${i.material_name} (${i.material_code})`,
      })),
    [items]
  );

  const onPickMaterial = (code: string) => {
    const item = items.find((i) => i.material_code === code);
    setForm({
      material_code: code,
      quantity: item != null ? String(item.quantity) : '',
      quality_grade: item?.quality_grade ?? '',
      location: item?.location ?? '',
    });
  };

  const openAdjustFor = (item: InventoryItem) => {
    setForm({
      material_code: item.material_code,
      quantity: String(item.quantity),
      quality_grade: item.quality_grade ?? '',
      location: item.location ?? '',
    });
    setShowAdjust(true);
    setMessage(null);
    setError(null);
  };

  const onAdjust = async () => {
    if (!plantId) return;
    const qty = Number(form.quantity);
    if (!form.material_code.trim()) {
      setError('Select a material to adjust.');
      return;
    }
    if (!Number.isFinite(qty) || qty < 0) {
      setError('Enter a valid non-negative quantity.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await adjustInventory(plantId, {
        material_code: form.material_code.trim(),
        quantity: qty,
        quality_grade: form.quality_grade.trim() || undefined,
        location: form.location.trim() || undefined,
      });
      await load(true);
      setMessage(
        `Adjusted ${result.material_code} → ${result.quantity} (${result.status})`
      );
      setShowAdjust(false);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading && items.length === 0 && !error) {
    return <LoadingView message="Loading inventory…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Inventory Pulse</Text>
      <Text style={styles.sub}>
        Operational raw material levels — {critical} critical item(s)
      </Text>

      {critical > 0 ? (
        <View style={styles.criticalBanner}>
          <Text style={styles.criticalText}>
            {critical} material{critical === 1 ? '' : 's'} at critical stock level
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          title={showAdjust ? 'Hide adjust' : 'Adjust quantity'}
          variant="secondary"
          size="sm"
          onPress={() => {
            setShowAdjust((v) => !v);
            setMessage(null);
            setError(null);
            if (!showAdjust && form.material_code) {
              const item = items.find((i) => i.material_code === form.material_code);
              if (item) openAdjustFor(item);
            }
          }}
        />
      </View>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}

      {showAdjust ? (
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Adjust inventory</Text>
          <Text style={styles.hint}>
            Sets the absolute on-hand quantity (not a delta). Optional grade and location update
            the snapshot.
          </Text>
          {materialOptions.length > 0 ? (
            <SelectSheet
              label="Material"
              options={materialOptions}
              value={form.material_code || null}
              onChange={onPickMaterial}
            />
          ) : (
            <TextField
              label="Material code"
              value={form.material_code}
              onChangeText={(material_code) => setForm((f) => ({ ...f, material_code }))}
              autoCapitalize="characters"
            />
          )}
          <TextField
            label="New quantity"
            value={form.quantity}
            onChangeText={(quantity) => setForm((f) => ({ ...f, quantity }))}
            keyboardType="decimal-pad"
          />
          <TextField
            label="Quality grade (optional)"
            value={form.quality_grade}
            onChangeText={(quality_grade) => setForm((f) => ({ ...f, quality_grade }))}
          />
          <TextField
            label="Location (optional)"
            value={form.location}
            onChangeText={(location) => setForm((f) => ({ ...f, location }))}
          />
          <Button
            title={saving ? 'Saving…' : 'Save adjustment'}
            disabled={saving}
            onPress={() => void onAdjust()}
          />
        </Card>
      ) : null}

      {items.length === 0 && !error ? (
        <EmptyState
          title="No inventory items."
          description="Snapshots appear after seed or an adjust create."
        />
      ) : (
        items.map((item) => (
          <Card key={item.material_code} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.grow}>
                <Text style={styles.name}>{item.material_name}</Text>
                <Text style={styles.code}>{item.material_code}</Text>
              </View>
              <Badge label={item.status} tone={inventoryStatusTone(item.status)} />
            </View>
            <Text style={styles.qty}>
              {item.quantity.toLocaleString('en-IN')}{' '}
              <Text style={styles.unit}>{item.unit}</Text>
            </Text>
            <View style={styles.dl}>
              <Row label="Location" value={item.location ?? '—'} />
              <Row
                label="Days remaining"
                value={
                  item.days_remaining != null ? item.days_remaining.toFixed(0) : '—'
                }
              />
              <Row
                label="Avg consumption"
                value={
                  item.avg_daily_consumption != null
                    ? `${item.avg_daily_consumption.toFixed(1)}/day`
                    : '—'
                }
              />
              <Row
                label="Value"
                value={`₹${(item.current_value ?? 0).toLocaleString('en-IN')}`}
              />
              <Row label="Supplier" value={item.supplier ?? '—'} />
            </View>
            <Button
              title="Adjust"
              size="sm"
              variant="secondary"
              onPress={() => openAdjustFor(item)}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  criticalBanner: {
    marginTop: spacing.md,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: spacing.md,
  },
  criticalText: { ...typography.body, color: colors.danger, fontWeight: '600' },
  actions: { marginTop: spacing.md },
  banner: { marginTop: spacing.md },
  ok: { ...typography.caption, color: colors.success, marginTop: spacing.sm },
  formCard: { marginTop: spacing.md, gap: spacing.sm },
  formTitle: { ...typography.section, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  card: { marginTop: spacing.sm, gap: spacing.sm },
  cardTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  grow: { flex: 1, minWidth: 0 },
  name: { ...typography.body, color: colors.text, fontWeight: '700' },
  code: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  qty: { ...typography.title, color: colors.text, fontSize: 24 },
  unit: { ...typography.caption, color: colors.textMuted, fontWeight: '400' },
  dl: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { ...typography.caption, color: colors.textMuted },
  rowVal: { ...typography.caption, color: colors.text, fontWeight: '600' },
});
