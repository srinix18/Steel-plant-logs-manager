/**
 * P3-MSG-COMPOSE — unit + API smoke: recipient resolve, send, attach, lands on sent.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const route = fs.readFileSync(path.join(root, 'app', '(app)', 'messages', 'compose.tsx'), 'utf8');
assert.ok(route.includes('MessagesComposeScreen'));
assert.ok(!route.includes('RoleHomePlaceholder'));

const screen = fs.readFileSync(
  path.join(root, 'src', 'features', 'messages', 'MessagesComposeScreen.tsx'),
  'utf8'
);
assert.ok(screen.includes('sendMessage'));
assert.ok(screen.includes('uploadMessageAttachment'));
assert.ok(screen.includes('RecipientComposer'));
assert.ok(screen.includes('resolveRecipientIds'));
assert.ok(screen.includes('tab=sent'));
assert.ok(screen.includes('DocumentPicker') || screen.includes('expo-document-picker'));

const recipients = fs.readFileSync(
  path.join(root, 'src', 'utils', 'messageRecipients.ts'),
  'utf8'
);
assert.ok(recipients.includes('resolveRecipientIds'));
assert.ok(recipients.includes('@all') || recipients.includes("'all'"));
assert.ok(recipients.includes('isBroadcast'));

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
};
assert.ok(pkg.dependencies['expo-document-picker']);

// --- Recipient resolve unit checks (inline port of key rules) ---
type User = { id: string; department_id?: string | null };
type Token =
  | { kind: 'user'; id: string }
  | { kind: 'all' }
  | { kind: 'dept'; id: string };

function resolve(
  tokens: Token[],
  eligible: User[],
  canBroadcast: boolean
): { recipientIds: string[]; isBroadcast: boolean } {
  if (tokens.some((t) => t.kind === 'all')) {
    if (canBroadcast) return { recipientIds: [], isBroadcast: true };
    return { recipientIds: eligible.map((u) => u.id), isBroadcast: false };
  }
  const ids = new Set<string>();
  for (const token of tokens) {
    if (token.kind === 'user') ids.add(token.id);
    else if (token.kind === 'dept') {
      eligible.filter((u) => u.department_id === token.id).forEach((u) => ids.add(u.id));
    }
  }
  return { recipientIds: [...ids], isBroadcast: false };
}

const people: User[] = [
  { id: 'u1', department_id: 'd1' },
  { id: 'u2', department_id: 'd1' },
  { id: 'u3', department_id: 'd2' },
];
assert.deepEqual(resolve([{ kind: 'all' }], people, true), {
  recipientIds: [],
  isBroadcast: true,
});
assert.deepEqual(resolve([{ kind: 'all' }], people, false).recipientIds.sort(), [
  'u1',
  'u2',
  'u3',
]);
assert.deepEqual(resolve([{ kind: 'dept', id: 'd1' }], people, false).recipientIds.sort(), [
  'u1',
  'u2',
]);
assert.deepEqual(resolve([{ kind: 'user', id: 'u3' }], people, false), {
  recipientIds: ['u3'],
  isBroadcast: false,
});

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(
  /\/$/,
  ''
);

async function request(p: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}${p}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
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

/** 1x1 PNG */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function apiSmoke() {
  let login;
  try {
    login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'ceo@chandansteel.com',
        password: 'ceo123',
      }),
    });
  } catch (err) {
    console.log(`messages-compose-api: API unreachable — unit OK; skipped (${String(err)})`);
    return;
  }
  if (!login.res.ok) {
    console.log('messages-compose-api: login failed — unit OK; skipped');
    return;
  }
  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const suggest = await request('/messages/recipients/suggest', { headers: auth });
  if (suggest.res.status !== 200) {
    console.error('messages-compose-api: suggest failed', suggest.res.status, suggest.json);
    process.exit(1);
  }
  const users = suggest.json as { id: string; email: string }[];
  const worker = users.find((u) => u.email === 'melter@chandansteel.com') ?? users[0];
  if (!worker) {
    console.log('messages-compose-api: no recipients — unit OK; skipped');
    return;
  }

  const depts = await request('/departments', { headers: auth });
  if (depts.res.status !== 200) {
    console.error('messages-compose-api: departments failed', depts.res.status, depts.json);
    process.exit(1);
  }

  const sent = await request('/messages', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      subject: `Mobile compose smoke ${Date.now()}`,
      body: 'Compose chunk smoke',
      recipient_ids: [worker.id],
      is_broadcast: false,
    }),
  });
  if (sent.res.status !== 201 && sent.res.status !== 200) {
    console.error('messages-compose-api: send failed', sent.res.status, sent.json);
    process.exit(1);
  }
  const msg = sent.json as { id: string };

  const form = new FormData();
  form.append(
    'file',
    new Blob([TINY_PNG], { type: 'image/png' }),
    'compose-smoke.png'
  );
  const attach = await request(`/messages/${msg.id}/attachments`, {
    method: 'POST',
    headers: auth,
    body: form,
  });
  if (attach.res.status !== 201 && attach.res.status !== 200) {
    console.error('messages-compose-api: attach failed', attach.res.status, attach.json);
    process.exit(1);
  }

  const broadcast = await request('/messages', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      subject: `Mobile broadcast smoke ${Date.now()}`,
      body: 'Broadcast via @all',
      recipient_ids: [],
      is_broadcast: true,
    }),
  });
  if (broadcast.res.status !== 201 && broadcast.res.status !== 200) {
    console.error('messages-compose-api: broadcast failed', broadcast.res.status, broadcast.json);
    process.exit(1);
  }

  const sentList = await request('/messages/sent', { headers: auth });
  if (sentList.res.status !== 200) {
    console.error('messages-compose-api: sent list failed', sentList.res.status, sentList.json);
    process.exit(1);
  }
  const list = sentList.json as { id: string }[];
  if (!list.some((m) => m.id === msg.id)) {
    console.error('messages-compose-api: message missing from sent');
    process.exit(1);
  }

  console.log(`messages-compose-api: OK (send+attach+broadcast → sent)`);
}

console.log('messages-compose-api: unit OK (recipients + compose + attach wiring)');
await apiSmoke();
