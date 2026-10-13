import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { getErrorMessage } from '@/src/api/client';
import {
  commitImport,
  downloadImportTemplate,
  previewAndValidate,
  uploadImportFile,
  type ImportCommit,
  type ImportFilePick,
  type ImportValidation,
} from '@/src/api/imports';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { Screen } from '@/src/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';

const MODULE = 'employees';

/** Bulk-load the whole user base from one Excel file: template, pick file, check, create. */
export function EmployeeImportScreen() {
  const [file, setFile] = useState<ImportFilePick | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [check, setCheck] = useState<ImportValidation | null>(null);
  const [result, setResult] = useState<ImportCommit | null>(null);
  const [busy, setBusy] = useState<'template' | 'check' | 'create' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setJobId(null);
    setCheck(null);
    setResult(null);
    setError(null);
  };

  const getTemplate = async () => {
    setBusy('template');
    setError(null);
    setMessage(null);
    try {
      const uri = await downloadImportTemplate(MODULE, 'Ulti-Met_employee_upload_template.xlsx');
      if (!(await Sharing.isAvailableAsync())) {
        setMessage(`Saved: ${uri}`);
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Employee upload template',
      });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const pickAndCheck = async () => {
    setError(null);
    setMessage(null);
    setResult(null);
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    const chosen: ImportFilePick = {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType || 'application/octet-stream',
    };
    setFile(chosen);
    setBusy('check');
    try {
      const job = await uploadImportFile(MODULE, chosen);
      setJobId(job.id);
      setCheck(await previewAndValidate(job.id));
    } catch (e) {
      setCheck(null);
      setError(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (!jobId) return;
    setBusy('create');
    setError(null);
    try {
      setResult(await commitImport(jobId));
      setCheck(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const problems = check?.rows.filter((r) => r.errors.length > 0) ?? [];

  return (
    <Screen scroll>
      <Text style={styles.title}>Upload employees from Excel</Text>
      <Text style={styles.sub}>
        Fill the template once with your whole team and upload it. Every person is created with their login, shift and salary.
      </Text>

      <Card style={styles.card}>
        <Text style={styles.step}>1. Get the template</Text>
        <Text style={styles.hint}>
          An Excel file with a guide, drop-down lists and example rows. Send it to whoever keeps your staff list.
        </Text>
        <Button title="Download template" variant="secondary" loading={busy === 'template'} onPress={() => void getTemplate()} />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.step}>2. Upload the filled file</Text>
        <Text style={styles.hint}>Every row is checked first. Nothing is created until you confirm.</Text>
        <Button
          title={file ? 'Choose a different file' : 'Choose Excel file'}
          loading={busy === 'check'}
          onPress={() => void pickAndCheck()}
        />
        {file ? <Text style={styles.file}>{file.name}</Text> : null}
      </Card>

      {error ? <ErrorBanner message={error} /> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}

      {check ? (
        <Card style={styles.card}>
          <Text style={styles.step}>3. Check and confirm</Text>
          <View style={styles.badges}>
            <Badge label={`${check.valid_count} ready`} tone="success" />
            {check.invalid_count > 0 ? <Badge label={`${check.invalid_count} need fixing`} tone="danger" /> : null}
          </View>
          {problems.slice(0, 30).map((r) => (
            <View key={r.id} style={styles.problem}>
              <Text style={styles.problemRow}>
                Row {r.row_number}: {String(r.raw_data.full_name || r.raw_data.email || '')}
              </Text>
              {r.errors.map((e, i) => (
                <Text key={i} style={styles.problemText}>
                  - {e}
                </Text>
              ))}
            </View>
          ))}
          {problems.length > 30 ? (
            <Text style={styles.hint}>...and {problems.length - 30} more rows with problems.</Text>
          ) : null}
          {check.invalid_count > 0 ? (
            <Text style={styles.hint}>
              Rows with problems are skipped. Fix them in the Excel file and upload again. People already created are not duplicated.
            </Text>
          ) : null}
          <Button
            title={`Create ${check.valid_count} employee${check.valid_count === 1 ? '' : 's'}`}
            disabled={check.valid_count === 0}
            loading={busy === 'create'}
            onPress={() => void create()}
          />
        </Card>
      ) : null}

      {result ? (
        <Card style={styles.card}>
          <Text style={styles.step}>Done</Text>
          <View style={styles.badges}>
            <Badge label={`${result.imported} created`} tone="success" />
            {result.failed > 0 ? <Badge label={`${result.failed} failed`} tone="danger" /> : null}
          </View>
          <Text style={styles.hint}>Find them under Employees. Share each email and password with the person privately.</Text>
          <Button title="Upload another file" variant="secondary" onPress={reset} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  card: { marginBottom: spacing.md, gap: spacing.sm },
  step: { ...typography.section, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted },
  file: { ...typography.body, color: colors.text },
  ok: { ...typography.body, color: colors.success, marginBottom: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  problem: { gap: 2, paddingVertical: spacing.xs },
  problemRow: { ...typography.body, color: colors.text, fontWeight: '600' },
  problemText: { ...typography.caption, color: colors.danger },
});
