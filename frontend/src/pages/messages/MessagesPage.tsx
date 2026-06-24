import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchInbox,
  fetchMessage,
  fetchNotifications,
  fetchSentMessages,
  fetchSuggestedRecipients,
  markNotificationRead,
  sendMessage,
  uploadMessageAttachment,
  downloadMessageAttachment,
} from '../../api/messages';
import { fetchDepartments } from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { AppMessage, AppNotification, Department, User } from '../../types';
import { isCeoTier, isHr } from '../../utils/roles';
import { resolveRecipientIds, type RecipientToken } from '../../utils/messageRecipients';
import { RecipientComposer } from '../../components/messages/RecipientComposer';
import {
  isMaintenanceAlert,
  maintenanceAlertSubtitle,
  maintenanceAlertTarget,
  maintenanceAlertTitle,
} from '../../utils/maintenanceAlerts';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ImageLightbox } from '../../components/ui/ImageLightbox';

type Tab = 'inbox' | 'sent' | 'alerts' | 'compose';

export function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('inbox');
  const [inbox, setInbox] = useState<AppMessage[]>([]);
  const [sent, setSent] = useState<AppMessage[]>([]);
  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  const [recipients, setRecipients] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [recipientTokens, setRecipientTokens] = useState<RecipientToken[]>([]);
  const [selected, setSelected] = useState<AppMessage | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AppNotification | null>(null);
  const [error, setError] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const reload = async () => {
    const [inboxMsgs, sentMsgs, suggested, notifs, depts] = await Promise.all([
      fetchInbox(),
      fetchSentMessages(),
      fetchSuggestedRecipients(),
      fetchNotifications(),
      fetchDepartments(),
    ]);
    setInbox(inboxMsgs);
    setSent(sentMsgs);
    setRecipients(suggested);
    setDepartments(depts);
    setAlerts(notifs);
  };

  useEffect(() => {
    reload().catch((e) => setError(getErrorMessage(e)));
  }, []);

  const openMessage = async (msg: AppMessage) => {
    try {
      const detail = await fetchMessage(msg.id);
      setSelected(detail);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const openAlert = async (alert: AppNotification) => {
    try {
      setSelectedAlert(alert);
      if (!alert.read_at) {
        await markNotificationRead(alert.id);
        await reload();
      }
      if (!user) return;
      const target = maintenanceAlertTarget(alert, user.role);
      if (target) navigate(target);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const handleSend = async () => {
    try {
      setSending(true);
      setError('');
      const canBroadcast = !!(user && (isCeoTier(user.role) || isHr(user.role)));
      const { recipientIds, isBroadcast } = resolveRecipientIds(recipientTokens, recipients, canBroadcast);
      if (!isBroadcast && recipientIds.length === 0) {
        setError('Add at least one recipient, @all, or a department like @SMS.');
        return;
      }
      const msg = await sendMessage({
        subject,
        body,
        recipient_ids: isBroadcast ? [] : recipientIds,
        is_broadcast: isBroadcast,
      });
      for (const file of pendingFiles) {
        await uploadMessageAttachment(msg.id, file);
      }
      setSubject('');
      setBody('');
      setRecipientTokens([]);
      setPendingFiles([]);
      setTab('sent');
      await reload();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const list = tab === 'inbox' ? inbox : sent;
  const canSend =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    recipientTokens.length > 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Messages &amp; Alerts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Type to find recipients, or use <span className="font-mono">@all</span> /{' '}
          <span className="font-mono">@DEPT_CODE</span> for groups.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex gap-2">
        {(['inbox', 'sent', 'alerts', 'compose'] as Tab[]).map((t) => (
          <Button key={t} variant={tab === t ? 'primary' : 'secondary'} onClick={() => setTab(t)}>
            {t === 'alerts' ? 'Alerts' : t.charAt(0).toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>

      {tab === 'alerts' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="System alerts">
            <div className="space-y-2">
              {alerts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openAlert(a)}
                  className={`w-full rounded-lg border px-3 py-2 text-left hover:bg-slate-50 ${
                    selectedAlert?.id === a.id
                      ? 'border-brand-400 bg-brand-50/60'
                      : a.read_at
                        ? 'border-slate-100'
                        : 'border-brand-200 bg-brand-50/40'
                  }`}
                >
                  <p className="font-medium text-slate-900">{maintenanceAlertTitle(a)}</p>
                  <p className="text-xs text-slate-500">
                    {maintenanceAlertSubtitle(a)}
                    {maintenanceAlertSubtitle(a) ? ' · ' : ''}
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </button>
              ))}
              {alerts.length === 0 && <p className="text-sm text-slate-500">No alerts.</p>}
            </div>
          </Card>

          <Card title="Alert detail">
            {selectedAlert && isMaintenanceAlert(selectedAlert) ? (
              <div>
                <h3 className="font-semibold text-slate-900">{maintenanceAlertTitle(selectedAlert)}</h3>
                <p className="mt-1 text-xs text-slate-500">{new Date(selectedAlert.created_at).toLocaleString()}</p>
                {selectedAlert.maintenance_issue && (
                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    {selectedAlert.maintenance_issue.category && (
                      <p>
                        <span className="text-slate-500">Category:</span>{' '}
                        <span className="capitalize">{selectedAlert.maintenance_issue.category}</span>
                      </p>
                    )}
                    {selectedAlert.maintenance_issue.status && (
                      <p>
                        <span className="text-slate-500">Status:</span>{' '}
                        {selectedAlert.maintenance_issue.status.replace(/_/g, ' ')}
                      </p>
                    )}
                    {selectedAlert.notification_type === 'maintenance_issue_closed' &&
                      selectedAlert.maintenance_issue.closed_by_user && (
                        <p>
                          <span className="text-slate-500">Closed by:</span>{' '}
                          {selectedAlert.maintenance_issue.closed_by_user.full_name}
                        </p>
                      )}
                    {selectedAlert.maintenance_issue.resolution_notes && (
                      <div>
                        <p className="text-slate-500">Resolution</p>
                        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3">
                          {selectedAlert.maintenance_issue.resolution_notes}
                        </p>
                      </div>
                    )}
                    {selectedAlert.maintenance_issue.run_id && user && (
                      <Button
                        variant="secondary"
                        onClick={() => navigate(`/reports/${selectedAlert.maintenance_issue!.run_id}`)}
                      >
                        View related run report
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : selectedAlert ? (
              <div>
                <h3 className="font-semibold text-slate-900">{maintenanceAlertTitle(selectedAlert)}</h3>
                <p className="mt-4 text-sm text-slate-600">{maintenanceAlertSubtitle(selectedAlert)}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select an alert to view details.</p>
            )}
          </Card>
        </div>
      ) : tab === 'compose' ? (
        <Card>
          <div className="space-y-3">
            <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <label className="block text-sm">
              <span className="text-slate-600">Message</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            <RecipientComposer
              eligible={recipients}
              departments={departments}
              tokens={recipientTokens}
              onChange={setRecipientTokens}
            />
            <label className="block text-sm">
              <span className="text-slate-600">Attachments (JPEG, PNG, PDF)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                multiple
                className="mt-1 block w-full text-sm"
                onChange={(e) => setPendingFiles(Array.from(e.target.files ?? []))}
              />
            </label>
            <Button onClick={handleSend} disabled={sending || !canSend}>
              {sending ? 'Sending…' : 'Send message'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={tab === 'inbox' ? 'Inbox' : 'Sent'}>
            <div className="space-y-2">
              {list.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => openMessage(m)}
                  className="w-full rounded-lg border border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <p className="font-medium text-slate-900">{m.subject}</p>
                  <p className="text-xs text-slate-500">
                    {tab === 'inbox' ? m.sender?.full_name : 'You'} · {new Date(m.created_at).toLocaleString()}
                  </p>
                </button>
              ))}
              {list.length === 0 && <p className="text-sm text-slate-500">No messages.</p>}
            </div>
          </Card>

          <Card title="Message detail">
            {selected ? (
              <div>
                <h3 className="font-semibold text-slate-900">{selected.subject}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  From {selected.sender?.full_name} · {new Date(selected.created_at).toLocaleString()}
                </p>
                <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{selected.body}</p>
                {selected.attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-slate-600">Attachments</p>
                    {selected.attachments.map((a) =>
                      a.mime_type.startsWith('image/') ? (
                        <button
                          key={a.id}
                          type="button"
                          onClick={async () => {
                            const url = await downloadMessageAttachment(a.id, a.file_name);
                            if (url) setLightboxSrc(url);
                          }}
                          className="block text-sm text-brand-600 hover:underline"
                        >
                          {a.file_name}
                        </button>
                      ) : (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => downloadMessageAttachment(a.id, a.file_name)}
                          className="block text-sm text-brand-600 hover:underline"
                        >
                          {a.file_name}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select a message to read.</p>
            )}
          </Card>
        </div>
      )}

      {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="Attachment" onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
