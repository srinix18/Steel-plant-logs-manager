import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  createMasterCustomer,
  createMasterDelayCode,
  createMasterGrade,
  createMasterMaterial,
  createMasterProduct,
  fetchMasterContractors,
  fetchMasterCustomers,
  fetchMasterDelayCodes,
  fetchMasterGrades,
  fetchMasterMaterials,
  fetchMasterProducts,
  type MasterContractor,
  type MasterCustomer,
  type MasterDelayCode,
  type MasterGrade,
  type MasterMaterial,
  type MasterProduct,
} from '@/src/api/foundation';
import { fetchPlants } from '@/src/api/lookups';
import { useAuth } from '@/src/auth/AuthContext';
import { CEO_TIER_ROLES, hasRole } from '@/src/auth/roles';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

type Tab =
  | 'grades'
  | 'materials'
  | 'products'
  | 'customers'
  | 'delay_codes'
  | 'contractors';

const TABS: { id: Tab; label: string }[] = [
  { id: 'grades', label: 'Grades' },
  { id: 'materials', label: 'Materials' },
  { id: 'products', label: 'Products' },
  { id: 'customers', label: 'Customers' },
  { id: 'delay_codes', label: 'Delay Codes' },
  { id: 'contractors', label: 'Contractors' },
];

const MATERIAL_TYPES = [
  { value: 'alloy', label: 'alloy' },
  { value: 'scrap', label: 'scrap' },
];

const DELAY_CATEGORIES = [
  { value: 'equipment', label: 'equipment' },
  { value: 'process', label: 'process' },
];

type FormState = {
  code: string;
  name: string;
  description: string;
  type: string;
  category: string;
};

function emptyForm(): FormState {
  return {
    code: '',
    name: '',
    description: '',
    type: 'alloy',
    category: 'equipment',
  };
}

/**
 * P5-FND-MASTERS — plant master data (port of MastersPage).
 * Route: HOD-tier view; write: CEO-tier only. Contractors list-only.
 */
export function FoundationMastersScreen() {
  const { user } = useAuth();
  const canWrite = user ? hasRole(user.role, CEO_TIER_ROLES) : false;

  const [tab, setTab] = useState<Tab>('grades');
  const [plantId, setPlantId] = useState('');
  const [orgId, setOrgId] = useState(user?.organisation_id || '');
  const [grades, setGrades] = useState<MasterGrade[]>([]);
  const [materials, setMaterials] = useState<MasterMaterial[]>([]);
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [customers, setCustomers] = useState<MasterCustomer[]>([]);
  const [delayCodes, setDelayCodes] = useState<MasterDelayCode[]>([]);
  const [contractors, setContractors] = useState<MasterContractor[]>([]);
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

        const [g, m, p, c, d, k] = await Promise.all([
          fetchMasterGrades(),
          fetchMasterMaterials(),
          fetchMasterProducts(),
          fetchMasterCustomers(pid || undefined),
          fetchMasterDelayCodes(pid || undefined),
          fetchMasterContractors(),
        ]);
        setGrades(g);
        setMaterials(m);
        setProducts(p);
        setCustomers(c);
        setDelayCodes(d);
        setContractors(k);
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

  const tabLabel = useMemo(
    () => TABS.find((t) => t.id === tab)?.label ?? tab,
    [tab]
  );

  const rowCount = useMemo(() => {
    switch (tab) {
      case 'grades':
        return grades.length;
      case 'materials':
        return materials.length;
      case 'products':
        return products.length;
      case 'customers':
        return customers.length;
      case 'delay_codes':
        return delayCodes.length;
      case 'contractors':
        return contractors.length;
    }
  }, [tab, grades, materials, products, customers, delayCodes, contractors]);

  const handleCreate = async () => {
    if (!canWrite || tab === 'contractors') return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (tab === 'grades') {
        if (!orgId || !form.code.trim()) throw new Error('Organisation and code are required.');
        await createMasterGrade({
          organisation_id: orgId,
          code: form.code.trim(),
          description: form.description.trim() || undefined,
        });
      } else if (tab === 'materials') {
        if (!orgId || !form.code.trim() || !form.name.trim()) {
          throw new Error('Organisation, code, name, and type are required.');
        }
        await createMasterMaterial({
          organisation_id: orgId,
          type: form.type || 'alloy',
          code: form.code.trim(),
          name: form.name.trim(),
        });
      } else if (tab === 'products') {
        if (!orgId || !form.code.trim() || !form.name.trim()) {
          throw new Error('Organisation, code, and name are required.');
        }
        await createMasterProduct({
          organisation_id: orgId,
          code: form.code.trim(),
          name: form.name.trim(),
        });
      } else if (tab === 'customers') {
        if (!plantId || !form.name.trim()) throw new Error('Plant and name are required.');
        await createMasterCustomer({
          plant_id: plantId,
          name: form.name.trim(),
          code: form.code.trim() || undefined,
        });
      } else if (tab === 'delay_codes') {
        if (!plantId || !form.code.trim() || !form.description.trim()) {
          throw new Error('Plant, code, description, and category are required.');
        }
        await createMasterDelayCode({
          plant_id: plantId,
          code: form.code.trim(),
          description: form.description.trim(),
          category: form.category || 'equipment',
        });
      }
      setForm(emptyForm());
      setMessage(`Added to ${tabLabel}.`);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !refreshing) {
    return <LoadingView message="Loading masters…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Master Data</Text>
      <Text style={styles.subtitle}>
        Grades, materials, products, customers, delay codes. Contractors are managed in Workforce.
      </Text>

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

      {canWrite && tab !== 'contractors' ? (
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Add {tabLabel}</Text>
          {(tab === 'grades' ||
            tab === 'materials' ||
            tab === 'products' ||
            tab === 'customers' ||
            tab === 'delay_codes') && (
            <TextField
              label={tab === 'delay_codes' ? 'Code (max 10)' : 'Code'}
              value={form.code}
              onChangeText={(code) =>
                setForm((f) => ({
                  ...f,
                  code: tab === 'delay_codes' ? code.slice(0, 10) : code,
                }))
              }
              autoCapitalize="characters"
              maxLength={tab === 'delay_codes' ? 10 : undefined}
            />
          )}
          {(tab === 'materials' || tab === 'products' || tab === 'customers') && (
            <TextField
              label="Name"
              value={form.name}
              onChangeText={(name) => setForm((f) => ({ ...f, name }))}
            />
          )}
          {(tab === 'grades' || tab === 'delay_codes') && (
            <TextField
              label="Description"
              value={form.description}
              onChangeText={(description) => setForm((f) => ({ ...f, description }))}
            />
          )}
          {tab === 'materials' ? (
            <SelectSheet
              label="Type"
              value={form.type}
              options={MATERIAL_TYPES}
              onChange={(type) => setForm((f) => ({ ...f, type }))}
            />
          ) : null}
          {tab === 'delay_codes' ? (
            <SelectSheet
              label="Category"
              value={form.category}
              options={DELAY_CATEGORIES}
              onChange={(category) => setForm((f) => ({ ...f, category }))}
            />
          ) : null}
          <Button title="Add" onPress={() => void handleCreate()} loading={saving} />
        </Card>
      ) : null}

      {!canWrite && tab !== 'contractors' ? (
        <Text style={styles.readOnly}>View only — CEO-tier can create master records.</Text>
      ) : null}

      {tab === 'contractors' ? (
        <Text style={styles.readOnly}>Read-only. Manage contractors in Workforce.</Text>
      ) : null}

      {rowCount === 0 ? (
        <EmptyState title={`No ${tabLabel.toLowerCase()}`} description="Nothing to show yet." />
      ) : (
        <View style={styles.list}>
          {tab === 'grades' &&
            grades.map((g) => (
              <Card key={g.id} style={styles.row}>
                <Text style={styles.rowTitle}>{g.code}</Text>
                <Text style={styles.rowMeta}>{g.description || '—'}</Text>
              </Card>
            ))}
          {tab === 'materials' &&
            materials.map((m) => (
              <Card key={m.id} style={styles.row}>
                <Text style={styles.rowTitle}>
                  {m.code} · {m.name}
                </Text>
                <Text style={styles.rowMeta}>type: {m.type}</Text>
              </Card>
            ))}
          {tab === 'products' &&
            products.map((p) => (
              <Card key={p.id} style={styles.row}>
                <Text style={styles.rowTitle}>
                  {p.code} · {p.name}
                </Text>
                <Text style={styles.rowMeta}>{p.is_active ? 'Active' : 'Inactive'}</Text>
              </Card>
            ))}
          {tab === 'customers' &&
            customers.map((c) => (
              <Card key={c.id} style={styles.row}>
                <Text style={styles.rowTitle}>{c.name}</Text>
                <Text style={styles.rowMeta}>
                  {c.code || '—'} · {c.is_active ? 'Active' : 'Inactive'}
                </Text>
              </Card>
            ))}
          {tab === 'delay_codes' &&
            delayCodes.map((d) => (
              <Card key={d.id} style={styles.row}>
                <Text style={styles.rowTitle}>{d.code}</Text>
                <Text style={styles.rowMeta}>
                  {d.description} · {d.category}
                </Text>
              </Card>
            ))}
          {tab === 'contractors' &&
            contractors.map((c) => (
              <Card key={c.id} style={styles.row}>
                <Text style={styles.rowTitle}>
                  {c.code} · {c.name}
                </Text>
                <Text style={styles.rowMeta}>{c.contact_person || '—'}</Text>
              </Card>
            ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
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
  tabActive: {
    backgroundColor: colors.brand,
  },
  tabText: {
    ...typography.caption,
    color: colors.text,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  formCard: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  formTitle: {
    ...typography.section,
    color: colors.text,
  },
  readOnly: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    gap: 2,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  rowMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
