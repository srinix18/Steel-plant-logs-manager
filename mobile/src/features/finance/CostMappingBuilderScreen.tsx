import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  COST_CATEGORY_LABELS,
  createMappingRule,
  deleteMappingRule,
  fetchMappingContext,
  formatCurrency,
  type CostCategory,
  type TemplateMappingContext,
} from '@/src/api/finance';
import { fetchTemplates } from '@/src/api/processRuns';
import { useAuth } from '@/src/auth/AuthContext';
import { FINANCE_MAPPING_WRITE_ROLES, hasRole } from '@/src/auth/roles';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

const CATEGORY_OPTIONS = (Object.keys(COST_CATEGORY_LABELS) as CostCategory[]).map((k) => ({
  value: k,
  label: COST_CATEGORY_LABELS[k],
}));

/**
 * P5-FIN-MAP — cost mapping builder (port of CostMappingBuilderPage).
 */
export function CostMappingBuilderScreen() {
  const { user } = useAuth();
  const canWrite = user ? hasRole(user.role, FINANCE_MAPPING_WRITE_ROLES) : false;

  const [versionId, setVersionId] = useState('');
  const [versionOptions, setVersionOptions] = useState<{ value: string; label: string }[]>([]);
  const [context, setContext] = useState<TemplateMappingContext | null>(null);
  const [selectedField, setSelectedField] = useState('');
  const [costCategory, setCostCategory] = useState<CostCategory>('power');
  const [labelOverride, setLabelOverride] = useState('');
  const [previewQty, setPreviewQty] = useState('1000');
  const [previewRate, setPreviewRate] = useState('45');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const templates = await fetchTemplates();
      const published = templates.flatMap((t) =>
        (t.versions ?? [])
          .filter((v) => v.status === 'published')
          .map((v) => ({
            value: v.id,
            label: `${t.doc_no} — ${t.name} (rev ${v.rev_no})`,
          }))
      );
      setVersionOptions(published);
      setVersionId((prev) => prev || published[0]?.value || '');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const loadContext = useCallback(async () => {
    if (!versionId) {
      setContext(null);
      return;
    }
    setError(null);
    try {
      const ctx = await fetchMappingContext(versionId);
      setContext(ctx);
      setSelectedField('');
    } catch (e) {
      setError(getErrorMessage(e));
      setContext(null);
    }
  }, [versionId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const previewAmount = useMemo(
    () => (Number(previewQty) || 0) * (Number(previewRate) || 0),
    [previewQty, previewRate]
  );

  const handleAddRule = async () => {
    if (!canWrite || !versionId || !selectedField || !context) return;
    const field = context.available_fields.find(
      (f) => `${f.section_key}.${f.field_name}` === selectedField
    );
    if (!field) return;
    const isSection = field.section_type !== 'fields';
    setSaving(true);
    setError(null);
    try {
      await createMappingRule({
        template_version_id: versionId,
        source_type: isSection ? 'section_row' : 'scalar_field',
        source_key: isSection ? field.section_key : field.field_name,
        cost_category: costCategory,
        child_key: isSection ? 'quantity_kg' : undefined,
        material_field_key:
          isSection && costCategory === 'raw_material' ? 'material' : undefined,
        item_label_override: labelOverride.trim() || undefined,
        sort_order: (context.rules.length || 0) + 1,
      });
      setLabelOverride('');
      const ctx = await fetchMappingContext(versionId);
      setContext(ctx);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!canWrite) return;
    setSaving(true);
    setError(null);
    try {
      await deleteMappingRule(ruleId);
      if (versionId) {
        setContext(await fetchMappingContext(versionId));
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingView message="Loading templates…" />;
  }

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => {
        void loadTemplates(true);
        void loadContext();
      }}
    >
      <Text style={styles.title}>Cost Mapping Builder</Text>
      <Text style={styles.subtitle}>
        Map template fields to cost categories — no hardcoded field names in the engine
      </Text>

      {error ? <ErrorBanner message={error} /> : null}

      {!canWrite ? (
        <Text style={styles.readOnly}>Read-only — mapping write role required to add or delete rules.</Text>
      ) : null}

      <Card style={styles.card}>
        <SelectSheet
          label="Template version"
          placeholder="Select published template…"
          options={versionOptions}
          value={versionId || null}
          onChange={(v) => setVersionId(v)}
        />
        {versionOptions.length === 0 ? (
          <Text style={styles.hint}>No published template versions found.</Text>
        ) : null}
      </Card>

      {context ? (
        <>
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Template Fields</Text>
            {context.available_fields.length === 0 ? (
              <EmptyState title="No fields" description="This template version has no mappable fields." />
            ) : (
              context.available_fields.map((f) => {
                const key = `${f.section_key}.${f.field_name}`;
                const selected = selectedField === key;
                return (
                  <Pressable
                    key={key}
                    style={[styles.fieldRow, selected && styles.fieldRowSelected]}
                    onPress={() => setSelectedField(key)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.fieldLabel, selected && styles.fieldLabelSelected]}>
                      {f.field_label}
                    </Text>
                    <Text style={styles.fieldMeta}>
                      {f.section_key}/{f.field_name} ({f.section_type})
                    </Text>
                  </Pressable>
                );
              })
            )}
          </Card>

          {canWrite ? (
            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>New Mapping</Text>
              <SelectSheet
                label="Cost category"
                options={CATEGORY_OPTIONS}
                value={costCategory}
                onChange={(v) => setCostCategory(v)}
              />
              <TextField
                label="Label override (optional)"
                value={labelOverride}
                onChangeText={setLabelOverride}
                placeholder="Override item label"
              />
              <Button
                title={`Map selected → ${COST_CATEGORY_LABELS[costCategory]}`}
                onPress={() => void handleAddRule()}
                disabled={!selectedField || saving}
                loading={saving}
              />
            </Card>
          ) : null}

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <Text style={styles.previewText}>
              If qty = {previewQty} @ ₹{previewRate} →{' '}
              <Text style={styles.previewStrong}>{formatCurrency(previewAmount)}</Text>
            </Text>
            <View style={styles.previewRow}>
              <View style={styles.previewField}>
                <TextField label="Qty" value={previewQty} onChangeText={setPreviewQty} keyboardType="decimal-pad" />
              </View>
              <View style={styles.previewField}>
                <TextField label="Rate" value={previewRate} onChangeText={setPreviewRate} keyboardType="decimal-pad" />
              </View>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>
              Active Rules — {context.template_name ?? 'Template'} rev {context.rev_no ?? '—'}
            </Text>
            {context.rules.length === 0 ? (
              <EmptyState title="No mapping rules" description="Add rules above." />
            ) : (
              context.rules.map((r) => (
                <View key={r.id} style={styles.ruleRow}>
                  <View style={styles.ruleBody}>
                    <Text style={styles.ruleSrc}>
                      {r.source_type}: {r.source_key}
                    </Text>
                    <Text style={styles.ruleMeta}>
                      {COST_CATEGORY_LABELS[r.cost_category] ?? r.cost_category}
                      {r.child_key ? ` · ${r.child_key}` : ''}
                    </Text>
                  </View>
                  {canWrite ? (
                    <Pressable onPress={() => void handleDelete(r.id)} accessibilityRole="button">
                      <Text style={styles.delete}>Delete</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
          </Card>
        </>
      ) : versionId ? null : (
        <EmptyState title="Select a template" description="Choose a published template version to map fields." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  readOnly: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  card: { marginBottom: spacing.md, gap: spacing.sm },
  sectionTitle: { ...typography.section, color: colors.text, marginBottom: spacing.xs },
  hint: { ...typography.caption, color: colors.textMuted },
  fieldRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.card,
    marginBottom: spacing.xs,
  },
  fieldRowSelected: { backgroundColor: colors.brandSoft },
  fieldLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  fieldLabelSelected: { color: colors.brand },
  fieldMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  previewText: { ...typography.body, color: colors.textMuted },
  previewStrong: { fontWeight: '700', color: colors.text },
  previewRow: { flexDirection: 'row', gap: spacing.sm },
  previewField: { flex: 1 },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  ruleBody: { flex: 1, paddingRight: spacing.sm },
  ruleSrc: { ...typography.body, color: colors.text, fontWeight: '600' },
  ruleMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  delete: { ...typography.caption, color: colors.danger, fontWeight: '600' },
});
