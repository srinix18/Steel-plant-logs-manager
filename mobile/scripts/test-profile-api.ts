/**
 * Smoke: login → GET /auth/me → PATCH /auth/me → GET again.
 * Skips if API unreachable.
 */
const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(
  /\/$/,
  ''
);

async function request(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
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

async function main() {
  let login;
  try {
    login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@logbook.app', password: 'admin123' }),
    });
  } catch (err) {
    console.log(`profile-api: API unreachable at ${API_URL} — skipped (${String(err)})`);
    process.exit(0);
  }

  if (!login.res.ok) {
    console.error('profile-api: login failed', login.json);
    process.exit(1);
  }

  const token = (login.json as { access_token: string }).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  const me = await request('/auth/me', { headers: auth });
  if (!me.res.ok) {
    console.error('profile-api: GET /auth/me failed', me.json);
    process.exit(1);
  }

  const user = me.json as {
    full_name: string;
    phone?: string | null;
    designation?: string | null;
    date_of_joining?: string | null;
  };

  const marker = `MOI-P107-${Date.now().toString().slice(-6)}`;
  const patch = await request('/auth/me', {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      full_name: user.full_name,
      phone: user.phone || undefined,
      designation: user.designation || 'System Admin',
      // keep joining date if present
      date_of_joining: user.date_of_joining?.slice(0, 10) || undefined,
      // use phone as a harmless round-trip field when empty
      ...(user.phone ? {} : { phone: marker.slice(0, 12) }),
    }),
  });

  if (!patch.res.ok) {
    console.error('profile-api: PATCH /auth/me failed', patch.json);
    process.exit(1);
  }

  const again = await request('/auth/me', { headers: auth });
  if (!again.res.ok) {
    console.error('profile-api: GET after PATCH failed', again.json);
    process.exit(1);
  }

  console.log('profile-api: ok (GET + PATCH /auth/me)');
}

main();
