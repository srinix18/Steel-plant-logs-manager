import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchDepartments } from '@/src/api/lookups';
import {
  createContractor,
  createContractWorker,
  fetchContractors,
  fetchContractWorkers,
  updateContractor,
  updateContractWorker,
  type Contractor,
  type ContractWorker,
} from '@/src/api/workforce';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SegmentedTabs } from '@/src/components/ui/SegmentedTabs';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import type { Department } from '@/src/types/platform';
import { colors, spacing, typography } from '@/src/theme/tokens';

type TabKey = 'contractors' | 'workers';
type FormMode =
  | { kind: 'none' }
  | { kind: 'company'; editing: Contractor | null }
  | { kind: 'worker'; editing: ContractWorker | null };

/**
 * P4-WF-CON — Contractors + contract workers (port of WorkforceContractorsPage).
 * Adds edit + worker activate (API-supported; web only toggles company active).
 */
export function WorkforceContractorsScreen() {
  const [tab, setTab] = useState<TabKey>('contractors');
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [workers, setWorkers] = useState<ContractWorker[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>({ kind: 'none' });

  const [companyForm, setCompanyForm] = useState({
    code: '',
    name: '',
    contact_person: '',
    phone: '',
  });
  const [workerForm, setWorkerForm] = useState({
    contractor_id: '',
    full_name: '',
    department_id: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [c, w, d] = await Promise.all([
        fetchContractors(),
        fetchContractWorkers(),
        fetchDepartments(),
      ]);
      setContractors(c);
      setWorkers(w);
      setDepartments(d);
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

  const contractorOptions = useMemo(
    () => contractors.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
    [contractors]
  );
  const deptOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments]
  );

  const openAddCompany = () => {
    setCompanyForm({ code: '', name: '', contact_person: '', phone: '' });
    setFormMode({ kind: 'company', editing: null });
  };

  const openEditCompany = (c: Contractor) => {
    setCompanyForm({
      code: c.code,
      name: c.name,
      contact_person: c.contact_person ?? '',
      phone: c.phone ?? '',
    });
    setFormMode({ kind: 'company', editing: c });
  };

  const openAddWorker = () => {
    setWorkerForm({
      contractor_id: contractors[0]?.id ?? '',
      full_name: '',
      department_id: departments[0]?.id ?? '',
      phone: '',
    });
    setFormMode({ kind: 'worker', editing: null });
  };

  const openEditWorker = (w: ContractWorker) => {
    setWorkerForm({
      contractor_id: w.contractor_id,
      full_name: w.full_name,
      department_id: w.department_id,
      phone: w.phone ?? '',
    });
    setFormMode({ kind: 'worker', editing: w });
  };

  const saveCompany = async () => {
    setError(null);
    if (!companyForm.code.trim() || !companyForm.name.trim()) {
      setError('Code and name are required.');
      return;
    }
    setSaving(true);
    try {
      if (formMode.kind === 'company' && formMode.editing) {
        await updateContractor(formMode.editing.id, {
          name: companyForm.name.trim(),
          contact_person: companyForm.contact_person.trim() || null,
          phone: companyForm.phone.trim() || null,
        });
      } else {
        await createContractor({
          code: companyForm.code.trim(),
          name: companyForm.name.trim(),
          contact_person: companyForm.contact_person.trim() || undefined,
          phone: companyForm.phone.trim() || undefined,
        });
      }
      setFormMode({ kind: 'none' });
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const saveWorker = async () => {
    setError(null);
    if (!workerForm.full_name.trim()) {
      setError('Worker name is required.');
      return;
    }
    if (!workerForm.contractor_id || !workerForm.department_id) {
      setError('Contractor and department are required.');
      return;
    }
    setSaving(true);
    try {
      if (formMode.kind === 'worker' && formMode.editing) {
        await updateContractWorker(formMode.editing.id, {
          full_name: workerForm.full_name.trim(),
          department_id: workerForm.department_id,
          phone: workerForm.phone.trim() || null,
        });
      } else {
        await createContractWorker({
          contractor_id: workerForm.contractor_id,
          full_name: workerForm.full_name.trim(),
          department_id: workerForm.department_id,
          phone: workerForm.phone.trim() || undefined,
        });
      }
      setFormMode({ kind: 'none' });
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleCompanyActive = async (c: Contractor) => {
    setBusyId(c.id);
    setError(null);
    try {
      await updateContractor(c.id, { is_active: !c.is_active });
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const toggleWorkerActive = async (w: ContractWorker) => {
    setBusyId(w.id);
    setError(null);
    try {
      await updateContractWorker(w.id, { is_active: !w.is_active });
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  if (formMode.kind === 'company') {
    const editing = formMode.editing;
    return (
      <Screen scroll>
        <Text style={styles.title}>{editing ? 'Edit contractor' : 'Add contractor'}</Text>
        {error ? (
          <View style={styles.banner}>
            <ErrorBanner message={error} />
          </View>
        ) : null}
        {editing ? (
          <Text style={styles.codeHint}>Code: {editing.code} (not editable)</Text>
        ) : (
          <TextField
            label="Code"
            value={companyForm.code}
            onChangeText={(code) => setCompanyForm((f) => ({ ...f, code }))}
            autoCapitalize="characters"
          />
        )}
        <TextField
          label="Name"
          value={companyForm.name}
          onChangeText={(name) => setCompanyForm((f) => ({ ...f, name }))}
        />
        <TextField
          label="Contact person"
          value={companyForm.contact_person}
          onChangeText={(contact_person) => setCompanyForm((f) => ({ ...f, contact_person }))}
        />
        <TextField
          label="Phone"
          value={companyForm.phone}
          onChangeText={(phone) => setCompanyForm((f) => ({ ...f, phone }))}
          keyboardType="phone-pad"
        />
        <View style={styles.actions}>
          <Button
            title="Cancel"
            variant="secondary"
            size="lg"
            style={styles.actionBtn}
            onPress={() => setFormMode({ kind: 'none' })}
          />
          <Button
            title={saving ? 'Saving…' : 'Save'}
            size="lg"
            style={styles.actionBtn}
            disabled={saving}
            onPress={() => void saveCompany()}
          />
        </View>
      </Screen>
    );
  }

  if (formMode.kind === 'worker') {
    const editing = formMode.editing;
    return (
      <Screen scroll>
        <Text style={styles.title}>
          {editing ? 'Edit contract worker' : 'Add contract worker'}
        </Text>
        {error ? (
          <View style={styles.banner}>
            <ErrorBanner message={error} />
          </View>
        ) : null}
        {editing ? (
          <Text style={styles.codeHint}>
            Company:{' '}
            {contractors.find((c) => c.id === editing.contractor_id)?.name ??
              editing.contractor_name ??
              '—'}{' '}
            (not editable)
          </Text>
        ) : (
          <SelectSheet
            label="Contractor"
            options={contractorOptions}
            value={workerForm.contractor_id || null}
            onChange={(contractor_id) => setWorkerForm((f) => ({ ...f, contractor_id }))}
            placeholder="Select contractor"
          />
        )}
        <TextField
          label="Worker name"
          value={workerForm.full_name}
          onChangeText={(full_name) => setWorkerForm((f) => ({ ...f, full_name }))}
        />
        <SelectSheet
          label="Department"
          options={deptOptions}
          value={workerForm.department_id || null}
          onChange={(department_id) => setWorkerForm((f) => ({ ...f, department_id }))}
          placeholder="Select department"
        />
        <TextField
          label="Phone"
          value={workerForm.phone}
          onChangeText={(phone) => setWorkerForm((f) => ({ ...f, phone }))}
          keyboardType="phone-pad"
        />
        <View style={styles.actions}>
          <Button
            title="Cancel"
            variant="secondary"
            size="lg"
            style={styles.actionBtn}
            onPress={() => setFormMode({ kind: 'none' })}
          />
          <Button
            title={saving ? 'Saving…' : 'Save'}
            size="lg"
            style={styles.actionBtn}
            disabled={saving}
            onPress={() => void saveWorker()}
          />
        </View>
      </Screen>
    );
  }

  if (loading && contractors.length === 0 && workers.length === 0) {
    return <LoadingView message="Loading contractors…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Contractors</Text>
      <Text style={styles.sub}>Contractor companies and contract workers.</Text>

      <SegmentedTabs
        segments={[
          { key: 'contractors', label: 'Companies' },
          { key: 'workers', label: 'Workers' },
        ]}
        value={tab}
        onChange={(k) => setTab(k as TabKey)}
      />

      <Button
        title={tab === 'contractors' ? 'Add contractor' : 'Add contract worker'}
        size="lg"
        style={styles.addBtn}
        onPress={tab === 'contractors' ? openAddCompany : openAddWorker}
      />

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {tab === 'contractors' ? (
        contractors.length === 0 ? (
          <EmptyState title="No contractors yet." description="Add a company to get started." />
        ) : (
          contractors.map((c) => (
            <Card key={c.id} style={styles.card}>
              <View style={styles.rowTop}>
                <View style={styles.titles}>
                  <Text style={styles.name}>{c.name}</Text>
                  <Text style={styles.meta}>{c.code}</Text>
                </View>
                <Badge
                  label={c.is_active ? 'Active' : 'Inactive'}
                  tone={c.is_active ? 'success' : 'neutral'}
                />
              </View>
              <Text style={styles.line}>Contact: {c.contact_person ?? '—'}</Text>
              <Text style={styles.line}>Phone: {c.phone ?? '—'}</Text>
              <View style={styles.rowActions}>
                <Button
                  title="Edit"
                  variant="secondary"
                  size="sm"
                  onPress={() => openEditCompany(c)}
                />
                <Button
                  title={c.is_active ? 'Deactivate' : 'Activate'}
                  variant="secondary"
                  size="sm"
                  disabled={busyId === c.id}
                  onPress={() => void toggleCompanyActive(c)}
                />
              </View>
            </Card>
          ))
        )
      ) : workers.length === 0 ? (
        <EmptyState
          title="No contract workers yet."
          description="Add a worker linked to a company."
        />
      ) : (
        workers.map((w) => (
          <Card key={w.id} style={styles.card}>
            <View style={styles.rowTop}>
              <View style={styles.titles}>
                <Text style={styles.name}>{w.full_name}</Text>
                <Text style={styles.meta}>{w.contractor_name ?? '—'}</Text>
              </View>
              <Badge
                label={w.is_active ? 'Active' : 'Inactive'}
                tone={w.is_active ? 'success' : 'neutral'}
              />
            </View>
            <Text style={styles.line}>Dept: {w.department_code ?? '—'}</Text>
            <Text style={styles.line}>Phone: {w.phone ?? '—'}</Text>
            <View style={styles.rowActions}>
              <Button
                title="Edit"
                variant="secondary"
                size="sm"
                onPress={() => openEditWorker(w)}
              />
              <Button
                title={w.is_active ? 'Deactivate' : 'Activate'}
                variant="secondary"
                size="sm"
                disabled={busyId === w.id}
                onPress={() => void toggleWorkerActive(w)}
              />
            </View>
          </Card>
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
  addBtn: { marginTop: spacing.md, marginBottom: spacing.md },
  banner: { marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titles: { flex: 1 },
  name: { ...typography.body, fontWeight: '700', color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  line: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  codeHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  actionBtn: { flexGrow: 1, flexBasis: '40%' },
});
