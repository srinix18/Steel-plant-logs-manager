import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../../api/client';
import {
  createRunRemark,
  fetchRunRemarks,
  replyToRunRemark,
  uploadRemarkAttachment,
} from '../../api/processRuns';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { RunRemark } from '../../types';
import { hasRole, SUPERVISOR_ROLES } from '../../utils/roles';
import { Button } from '../ui/Button';

interface RemarkThreadProps {
  runId: string;
  runState: string;
  readOnly?: boolean;
  compact?: boolean;
}

function RemarkImage({ id, alt, className }: { id: string; alt: string; className: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    apiClient
      .get(`/attachments/${id}`, { responseType: 'blob' })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
      })
      .catch(() => setSrc(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  if (!src) return <span className="text-xs text-slate-400">Loading…</span>;
  return <img src={src} alt={alt} className={className} />;
}

export function RemarkThread({ runId, runState, readOnly, compact }: RemarkThreadProps) {
  const { user } = useAuth();
  const [remarks, setRemarks] = useState<RunRemark[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isSupervisor = user && hasRole(user.role, SUPERVISOR_ROLES);
  const completedStates = ['completed', 'approved', 'closed'];
  const activeStates = ['created', 'in_progress', 'waiting_for_sample', 'refining', 'ready_to_tap'];

  const topLevel = useMemo(() => remarks.filter((r) => !r.parent_id), [remarks]);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, RunRemark[]>();
    for (const r of remarks) {
      if (r.parent_id) {
        const list = map.get(r.parent_id) ?? [];
        list.push(r);
        map.set(r.parent_id, list);
      }
    }
    return map;
  }, [remarks]);

  const melterRemark = topLevel.find((r) => r.role === 'melter');
  const canAddMelterRemark =
    !readOnly && user && !isSupervisor && activeStates.includes(runState) && !melterRemark;
  const canSupervisorReply =
    !readOnly && isSupervisor && completedStates.includes(runState) && melterRemark && !repliesByParent.get(melterRemark.id)?.length;

  const load = async () => {
    try {
      const data = await fetchRunRemarks(runId);
      setRemarks(data);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  useEffect(() => {
    load();
  }, [runId]);

  const submitRemark = async () => {
    if (!body.trim()) return;
    setSaving(true);
    setError('');
    try {
      const created = await createRunRemark(runId, body.trim());
      const file = fileRef.current?.files?.[0];
      setBody('');
      if (file) {
        await uploadRemarkAttachment(runId, created.id, file);
        if (fileRef.current) fileRef.current.value = '';
      }
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const submitReply = async () => {
    if (!melterRemark || !body.trim()) return;
    setSaving(true);
    setError('');
    try {
      await replyToRunRemark(runId, melterRemark.id, body.trim());
      setBody('');
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const uploadToRemark = async (remarkId: string, file: File) => {
    setSaving(true);
    try {
      await uploadRemarkAttachment(runId, remarkId, file);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const renderRemark = (remark: RunRemark) => (
    <div key={remark.id} className={compact ? 'mb-1 text-[8px]' : 'mb-3 rounded-lg border border-slate-100 p-3'}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-800">
          {remark.author?.full_name ?? 'User'}
          {remark.author?.employee_uid ? ` (${remark.author.employee_uid})` : ''}
        </span>
        <span className="text-slate-400">{new Date(remark.created_at).toLocaleString()}</span>
      </div>
      <p className={`mt-1 whitespace-pre-wrap text-slate-700 ${compact ? 'text-[8px]' : 'text-sm'}`}>{remark.body}</p>
      {remark.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {remark.attachments.map((a) => (
            <RemarkImage
              key={a.id}
              id={a.id}
              alt={a.file_name}
              className={compact ? 'h-12 w-12 rounded border object-cover' : 'h-16 w-16 rounded border object-cover'}
            />
          ))}
        </div>
      )}
      {!readOnly && remark.author_id === user?.id && (
        <label className="mt-2 inline-block cursor-pointer text-xs text-brand-600">
          Attach image
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadToRemark(remark.id, file);
            }}
          />
        </label>
      )}
      {(repliesByParent.get(remark.id) ?? []).map(renderRemark)}
    </div>
  );

  return (
    <div className={compact ? 'mb-1' : 'mb-4'}>
      {!compact && <h4 className="mb-2 text-sm font-semibold text-slate-800">Remarks</h4>}
      {compact && <p className="report-section-title">Remarks</p>}
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      {topLevel.length === 0 && <p className={`text-slate-500 ${compact ? 'text-[8px]' : 'text-sm'}`}>No remarks yet.</p>}
      {topLevel.map(renderRemark)}

      {(canAddMelterRemark || canSupervisorReply) && (
        <div className={compact ? 'mt-1 print:hidden' : 'mt-4 print:hidden'}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={compact ? 2 : 3}
            placeholder={canSupervisorReply ? 'Supervisor reply…' : 'Melter remark…'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {canAddMelterRemark && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="text-xs" />
              <Button type="button" disabled={saving || !body.trim()} onClick={submitRemark}>
                {saving ? 'Saving…' : 'Add remark'}
              </Button>
            </div>
          )}
          {canSupervisorReply && (
            <Button type="button" className="mt-2" disabled={saving || !body.trim()} onClick={submitReply}>
              {saving ? 'Saving…' : 'Reply'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
