import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { getErrorMessage } from '@/src/api/client';
import {
  downloadFoundationDocument,
  fetchFoundationDocuments,
  uploadFoundationDocument,
  type DocumentPick,
  type FoundationDocument,
} from '@/src/api/foundation';
import { fetchDepartments, fetchPlants } from '@/src/api/lookups';
import { useAuth } from '@/src/auth/AuthContext';
import { HOD_TIER_ROLES, HR_ROLES, hasRole } from '@/src/auth/roles';
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
import { colors, spacing, typography } from '@/src/theme/tokens';

const CATEGORIES = [
  { value: 'sop', label: 'sop' },
  { value: 'work_instruction', label: 'work instruction' },
  { value: 'safety_procedure', label: 'safety procedure' },
  { value: 'quality_document', label: 'quality document' },
  { value: 'maintenance_manual', label: 'maintenance manual' },
  { value: 'training_material', label: 'training material' },
];

type FormState = {
  title: string;
  version: string;
  department_id: string;
  category: string;
  file: DocumentPick | null;
};

function emptyForm(deptId: string): FormState {
  return {
    title: '',
    version: '1.0',
    department_id: deptId,
    category: 'sop',
    file: null,
  };
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ');
}

/**
 * P5-FND-DOCS — department documents (port of DocumentsPage).
 * List + download for all auth users; upload HOD-tier or HR.
 */
export function FoundationDocumentsScreen() {
  const { user } = useAuth();
  const canUpload = !!(
    user &&
    (hasRole(user.role, HOD_TIER_ROLES) || hasRole(user.role, HR_ROLES))
  );

  const [plantId, setPlantId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [docs, setDocs] = useState<FoundationDocument[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(''));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
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
        if (!plantId && pid) setPlantId(pid);
        const [list, depts] = await Promise.all([
          fetchFoundationDocuments({ plant_id: pid || undefined }),
          fetchDepartments(pid || undefined),
        ]);
        setDocs(list);
        setDepartments(depts);
      } catch (e) {
        setError(getErrorMessage(e));
        setDocs([]);
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

  const deptOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` })),
    [departments]
  );

  const openUpload = () => {
    setForm(emptyForm(departments[0]?.id || ''));
    setShowUpload(true);
    setMessage(null);
    setError(null);
  };

  const pickFile = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setForm((f) => ({
      ...f,
      file: {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || 'application/octet-stream',
      },
    }));
  };

  const submitUpload = async () => {
    if (!plantId || !form.department_id || !form.title.trim() || !form.file) {
      setError('Plant, department, title, and file are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await uploadFoundationDocument({
        plant_id: plantId,
        department_id: form.department_id,
        category: form.category,
        title: form.title.trim(),
        version: form.version.trim() || '1.0',
        file: form.file,
      });
      setShowUpload(false);
      setForm(emptyForm(departments[0]?.id || ''));
      setMessage(`Uploaded: ${created.title}`);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const onDownload = async (doc: FoundationDocument) => {
    setDownloadingId(doc.id);
    setError(null);
    try {
      const uri = await downloadFoundationDocument(doc.id, doc.file_name);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        setMessage(`Saved: ${uri}`);
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: doc.mime_type || undefined,
        dialogTitle: doc.file_name,
      });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading && !refreshing) {
    return <LoadingView message="Loading documents…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Department Documents</Text>
          <Text style={styles.subtitle}>SOPs, work instructions, and safety documents.</Text>
        </View>
        {canUpload ? <Button title="Upload" onPress={openUpload} size="sm" /> : null}
      </View>

      {!canUpload ? (
        <Text style={styles.readOnly}>View & download only — HOD/HR can upload.</Text>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {showUpload && canUpload ? (
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Upload document</Text>
          <TextField
            label="Title"
            value={form.title}
            onChangeText={(title) => setForm((f) => ({ ...f, title }))}
          />
          <TextField
            label="Version"
            value={form.version}
            onChangeText={(version) => setForm((f) => ({ ...f, version }))}
          />
          {deptOptions.length === 0 ? (
            <Text style={styles.hint}>No departments available.</Text>
          ) : (
            <SelectSheet
              label="Department"
              value={form.department_id}
              options={deptOptions}
              onChange={(department_id) => setForm((f) => ({ ...f, department_id }))}
            />
          )}
          <SelectSheet
            label="Category"
            value={form.category}
            options={CATEGORIES}
            onChange={(category) => setForm((f) => ({ ...f, category }))}
          />
          <Text style={styles.hint}>
            File: {form.file ? form.file.name : 'None selected'}
          </Text>
          <Button title="Pick file" variant="secondary" onPress={() => void pickFile()} />
          <View style={styles.formActions}>
            <Button
              title="Upload"
              onPress={() => void submitUpload()}
              loading={saving}
              disabled={!form.file || deptOptions.length === 0}
            />
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setShowUpload(false)}
              disabled={saving}
            />
          </View>
        </Card>
      ) : null}

      {docs.length === 0 ? (
        <EmptyState title="No documents uploaded" description="Nothing to show yet." />
      ) : (
        <View style={styles.list}>
          {docs.map((d) => (
            <Card key={d.id} style={styles.row}>
              <Text style={styles.rowTitle}>{d.title}</Text>
              <View style={styles.badges}>
                <Badge label={formatCategory(d.category)} tone="neutral" />
                <Badge label={`v${d.version}`} tone="brand" />
              </View>
              <Text style={styles.rowMeta}>{d.file_name}</Text>
              <Text style={styles.rowMeta}>By: {d.uploader_name || '—'}</Text>
              <Button
                title="Download"
                size="sm"
                variant="secondary"
                onPress={() => void onDownload(d)}
                loading={downloadingId === d.id}
              />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: { flex: 1 },
  title: { ...typography.title, color: colors.text },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  readOnly: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  formCard: { marginBottom: spacing.md, gap: spacing.sm },
  formTitle: { ...typography.section, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  list: { gap: spacing.sm },
  row: { gap: spacing.xs },
  rowTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  rowMeta: { ...typography.caption, color: colors.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
