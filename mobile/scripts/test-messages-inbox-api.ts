/**
 * P3-MSG-INBOX — unit + API smoke: inbox/sent/detail (+ optional attachment download path).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(path.join(root, 'app', '(app)', 'messages', 'index.tsx'), 'utf8');
assert.ok(route.includes('MessagesInboxScreen'));
assert.ok(!route.includes('DEMO_INBOX'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const detailRoute = fs.readFileSync(
  path.join(root, 'app', '(app)', 'messages', '[id].tsx'),
  'utf8'
);
assert.ok(detailRoute.includes('MessageDetailScreen'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'messages', 'MessagesInboxScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('fetchInbox'));
assert.ok(screen.includes('fetchSentMessages'));
assert.ok(screen.includes('Inbox'));
assert.ok(screen.includes('Sent'));
assert.ok(screen.includes('/(app)/messages/'));

const detail = fs.readFileSync(
  path.join(root, 'src', 'features', 'messages', 'MessageDetailScreen.tsx'),
  'utf8'
);
assert.ok(detail.includes('fetchMessage'));
assert.ok(detail.includes('downloadMessageAttachment'));
assert.ok(detail.includes('lightbox') || detail.includes('Lightbox'));
assert.ok(detail.includes('Sharing'));

const api = fs.readFileSync(path.join(root, 'src', 'api', 'messages.ts'), 'utf8');
assert.ok(api.includes('/messages/inbox'));
assert.ok(api.includes('/messages/sent'));
assert.ok(api.includes('/messages/attachments/'));

assert.ok(fs.existsSync(path.join(root, 'app', '(app)', 'messages', 'alerts.tsx')));
assert.ok(fs.existsSync(path.join(root, 'app', '(app)', 'messages', 'compose.tsx')));

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(
  /\/$/,
  ''
);

async function request(p: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}${p}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json };
}

async function login(email: string, password: string) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.res.ok) return null;
  return (res.json as { access_token: string }).access_token;
}

async function apiSmoke() {
  let ceoToken;
  try {
    ceoToken = await login('ceo@chandansteel.com', 'ceo123');
  } catch (err) {
    console.log(`messages-inbox-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!ceoToken) {
    console.log('messages-inbox-api: CEO login failed — unit OK; skipped');
    return;
  }
  const ceoAuth = { Authorization: `Bearer ${ceoToken}` };

  const workerToken = await login('melter@chandansteel.com', 'worker123');
  if (!workerToken) {
    console.log('messages-inbox-api: worker login failed — unit OK; skipped');
    return;
  }
  const workerAuth = { Authorization: `Bearer ${workerToken}` };

  const meWorker = await request('/auth/me', { headers: workerAuth });
  if (!meWorker.res.ok) {
    console.error('messages-inbox-api: worker me failed', meWorker.json);
    process.exit(1);
  }
  const workerId = (meWorker.json as { id: string }).id;

  const sent = await request('/messages', {
    method: 'POST',
    headers: ceoAuth,
    body: JSON.stringify({
      subject: `Mobile inbox smoke ${Date.now()}`,
      body: 'P3-MSG-INBOX smoke body',
      recipient_ids: [workerId],
      is_broadcast: false,
    }),
  });
  if (sent.res.status !== 201 && sent.res.status !== 200) {
    console.error('messages-inbox-api: send failed', sent.res.status, sent.json);
    process.exit(1);
  }
  const msg = sent.json as { id: string; subject: string };

  const ceoSent = await request('/messages/sent', { headers: ceoAuth });
  if (ceoSent.res.status !== 200) {
    console.error('messages-inbox-api: sent list failed', ceoSent.res.status, ceoSent.json);
    process.exit(1);
  }
  const sentList = ceoSent.json as { id: string }[];
  if (!sentList.some((m) => m.id === msg.id)) {
    console.error('messages-inbox-api: message missing from CEO sent');
    process.exit(1);
  }

  const inbox = await request('/messages/inbox', { headers: workerAuth });
  if (inbox.res.status !== 200) {
    console.error('messages-inbox-api: inbox failed', inbox.res.status, inbox.json);
    process.exit(1);
  }
  const inboxList = inbox.json as { id: string; subject: string; sender?: { full_name?: string } }[];
  if (!inboxList.some((m) => m.id === msg.id)) {
    console.error('messages-inbox-api: message missing from worker inbox');
    process.exit(1);
  }

  const detail = await request(`/messages/${msg.id}`, { headers: workerAuth });
  if (detail.res.status !== 200) {
    console.error('messages-inbox-api: detail failed', detail.res.status, detail.json);
    process.exit(1);
  }
  const body = detail.json as {
    subject: string;
    body: string;
    attachments?: unknown[];
    sender?: { full_name?: string };
  };
  if (body.subject !== msg.subject || !body.body.includes('smoke')) {
    console.error('messages-inbox-api: detail mismatch', body);
    process.exit(1);
  }
  if (!Array.isArray(body.attachments)) {
    console.error('messages-inbox-api: attachments not array', body);
    process.exit(1);
  }

  console.log(`messages-inbox-api: OK (sent→inbox→detail ${msg.id})`);
}

console.log('messages-inbox-api: unit OK (Inbox/Sent + detail + attachments wiring)');
await apiSmoke();
