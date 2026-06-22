import { useEffect, useState } from 'react';
import {
  fetchInbox,
  fetchMessage,
  fetchSentMessages,
  fetchSuggestedRecipients,
  sendMessage,
  uploadMessageAttachment,
  downloadMessageAttachment,
} from '../../api/messages';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { AppMessage, User } from '../../types';
import { isCeoTier } from '../../utils/roles';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ImageLightbox } from '../../components/ui/ImageLightbox';

type Tab = 'inbox' | 'sent' | 'compose';

export function MessagesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('inbox');
  const [inbox, setInbox] = useState<AppMessage[]>([]);
  const [sent, setSent] = useState<AppMessage[]>([]);
  const [recipients, setRecipients] = useState<User[]>([]);
  const [selected, setSelected] = useState<AppMessage | null>(null);
  const [error, setError] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [broadcast, setBroadcast] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const reload = async () => {
    const [inboxMsgs, sentMsgs, suggested] = await Promise.all([
      fetchInbox(),
      fetchSentMessages(),
      fetchSuggestedRecipients(),
    ]);
    setInbox(inboxMsgs);
    setSent(sentMsgs);
    setRecipients(suggested);
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

  const toggleRecipient = (id: string) => {
    setRecipientIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSend = async () => {
    try {
      setSending(true);
      setError('');
      const msg = await sendMessage({
        subject,
        body,
        recipient_ids: broadcast ? [] : recipientIds,
        is_broadcast: broadcast,
      });
      for (const file of pendingFiles) {
        await uploadMessageAttachment(msg.id, file);
      }
      setSubject('');
      setBody('');
      setRecipientIds([]);
      setBroadcast(false);
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
  const canBroadcast = user && isCeoTier(user.role);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Messages &amp; Alerts</h1>
        <p className="mt-1 text-sm text-slate-500">In-app mail with role-based recipients and attachments.</p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex gap-2">
        {(['inbox', 'sent', 'compose'] as Tab[]).map((t) => (
          <Button key={t} variant={tab === t ? 'primary' : 'secondary'} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>

      {tab === 'compose' ? (
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
            {canBroadcast && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={broadcast} onChange={(e) => setBroadcast(e.target.checked)} />
                Send to entire organisation
              </label>
            )}
            {!broadcast && (
              <div>
                <p className="mb-2 text-sm text-slate-600">Recipients</p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-slate-200 p-2">
                  {recipients.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={recipientIds.includes(r.id)}
                        onChange={() => toggleRecipient(r.id)}
                      />
                      {r.full_name} ({r.role.replace(/_/g, ' ')})
                    </label>
                  ))}
                  {recipients.length === 0 && <p className="text-sm text-slate-500">No eligible recipients.</p>}
                </div>
              </div>
            )}
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
            <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}>
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
