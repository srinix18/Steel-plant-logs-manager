import { useState } from 'react';
import { getErrorMessage } from '../../api/client';
import {
  commitImportJob,
  downloadImportErrorReport,
  downloadImportTemplate,
  fetchImportPreview,
  triggerTemplateDownload,
  uploadImportFile,
  validateImportJob,
  type ImportJob,
  type ImportJobRow,
} from '../../api/imports';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Table } from '../ui/Table';

const STEPS = ['Template', 'Upload', 'Preview', 'Validate', 'Commit'] as const;
type Step = (typeof STEPS)[number];

type Props = {
  moduleKey: string;
  title?: string;
  onClose: () => void;
  onComplete?: () => void;
};

export function ImportWizard({ moduleKey, title, onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>('Template');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [rows, setRows] = useState<ImportJobRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [commitResult, setCommitResult] = useState<{ imported: number; failed: number; skipped: number } | null>(null);

  const stepIndex = STEPS.indexOf(step);

  const handleDownloadTemplate = async () => {
    setBusy(true);
    setError('');
    try {
      const blob = await downloadImportTemplate(moduleKey);
      triggerTemplateDownload(blob, `${moduleKey}_import_template.xlsx`);
      setStep('Upload');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const uploaded = await uploadImportFile(moduleKey, file);
      setJob(uploaded);
      const preview = await fetchImportPreview(uploaded.id);
      setRows(preview.rows);
      setColumns(preview.columns);
      setStep('Preview');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleValidate = async () => {
    if (!job) return;
    setBusy(true);
    setError('');
    try {
      const result = await validateImportJob(job.id);
      setJob(result.job);
      setRows(result.rows);
      setValidCount(result.valid_count);
      setInvalidCount(result.invalid_count);
      setStep('Validate');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!job) return;
    setBusy(true);
    setError('');
    try {
      const result = await commitImportJob(job.id);
      setJob(result.job);
      setCommitResult({ imported: result.imported, failed: result.failed, skipped: result.skipped });
      setStep('Commit');
      onComplete?.();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadErrors = async () => {
    if (!job) return;
    try {
      const blob = await downloadImportErrorReport(job.id);
      triggerTemplateDownload(blob, `${moduleKey}_import_errors.xlsx`);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {title ?? `Import ${moduleKey.replace(/_/g, ' ')}`}
          </h2>
          <div className="mt-3 flex gap-2">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  i <= stepIndex ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {i + 1}. {s}
              </span>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

          {step === 'Template' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Download the Excel template, fill in your data, then upload in the next step.
              </p>
              <Button onClick={handleDownloadTemplate} disabled={busy}>
                {busy ? 'Downloading…' : 'Download template'}
              </Button>
              <div>
                <Button variant="secondary" onClick={() => setStep('Upload')}>
                  Skip — I already have the file
                </Button>
              </div>
            </div>
          )}

          {step === 'Upload' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Select the completed Excel file to upload.</p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="block w-full text-sm"
                onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
                disabled={busy}
              />
              {busy && <p className="text-sm text-slate-500">Uploading and parsing…</p>}
            </div>
          )}

          {step === 'Preview' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Preview of {rows.length} row{rows.length !== 1 ? 's' : ''} from{' '}
                <span className="font-medium">{job?.file_name}</span>
              </p>
              <Card className="overflow-x-auto">
                <Table
                  data={rows.slice(0, 50)}
                  emptyMessage="No rows parsed."
                  columns={[
                    { key: 'row', header: '#', render: (r) => String(r.row_number) },
                    ...columns.slice(0, 6).map((col) => ({
                      key: col,
                      header: col,
                      render: (r: ImportJobRow) => String(r.raw_data[col] ?? '—'),
                    })),
                    {
                      key: 'status',
                      header: 'Status',
                      render: (r) => r.status,
                    },
                  ]}
                />
              </Card>
              {rows.length > 50 && (
                <p className="text-xs text-slate-500">Showing first 50 of {rows.length} rows.</p>
              )}
            </div>
          )}

          {step === 'Validate' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <p className="text-xs font-medium uppercase text-slate-500">Valid rows</p>
                  <p className="mt-1 text-2xl font-bold text-green-600">{validCount}</p>
                </Card>
                <Card>
                  <p className="text-xs font-medium uppercase text-slate-500">Invalid rows</p>
                  <p className="mt-1 text-2xl font-bold text-red-600">{invalidCount}</p>
                </Card>
              </div>
              {invalidCount > 0 && (
                <Button variant="secondary" onClick={handleDownloadErrors}>
                  Download error report
                </Button>
              )}
              {invalidCount > 0 && (
                <Card className="overflow-x-auto">
                  <p className="mb-2 text-sm font-medium text-slate-700">Invalid rows</p>
                  <Table
                    data={rows.filter((r) => r.status === 'invalid').slice(0, 20)}
                    emptyMessage="No invalid rows."
                    columns={[
                      { key: 'row', header: '#', render: (r) => String(r.row_number) },
                      {
                        key: 'errors',
                        header: 'Errors',
                        render: (r) =>
                          Array.isArray(r.errors)
                            ? r.errors.map((e) => (typeof e === 'string' ? e : JSON.stringify(e))).join('; ')
                            : '—',
                      },
                    ]}
                  />
                </Card>
              )}
            </div>
          )}

          {step === 'Commit' && commitResult && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-green-700">Import committed successfully.</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <p className="text-xs text-slate-500">Imported</p>
                  <p className="text-xl font-bold">{commitResult.imported}</p>
                </Card>
                <Card>
                  <p className="text-xs text-slate-500">Failed</p>
                  <p className="text-xl font-bold text-red-600">{commitResult.failed}</p>
                </Card>
                <Card>
                  <p className="text-xs text-slate-500">Skipped</p>
                  <p className="text-xl font-bold">{commitResult.skipped}</p>
                </Card>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between border-t border-slate-200 px-6 py-4">
          <Button variant="secondary" onClick={onClose}>
            {step === 'Commit' ? 'Close' : 'Cancel'}
          </Button>
          <div className="flex gap-2">
            {step === 'Preview' && (
              <Button onClick={handleValidate} disabled={busy || !job}>
                {busy ? 'Validating…' : 'Validate'}
              </Button>
            )}
            {step === 'Validate' && (
              <Button onClick={handleCommit} disabled={busy || validCount === 0}>
                {busy ? 'Committing…' : `Commit ${validCount} row${validCount !== 1 ? 's' : ''}`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
