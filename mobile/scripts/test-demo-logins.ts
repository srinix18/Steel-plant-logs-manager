/**
 * Hits POST /auth/login for every LOGINS.md seed account.
 * Skips (exit 0) if API is unreachable so local UI work isn't blocked.
 */
import { ALL_DEMO_LOGINS } from '../src/auth/demoAccounts.ts';
import { getRoleHomeHref } from '../src/auth/roleHome.ts';
import type { UserRole } from '../src/types/user.ts';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(
  /\/$/,
  ''
);

async function tryLogin(
  email: string,
  password: string
): Promise<{ ok: boolean; detail: string; role?: UserRole }> {
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const text = await res.text();
    let detail = text;
    try {
      const json = JSON.parse(text) as {
        detail?: unknown;
        access_token?: string;
        user?: { role?: UserRole };
      };
      if (res.ok && json.access_token && json.user?.role) {
        const home = getRoleHomeHref(json.user.role);
        return { ok: true, detail: `${json.user.role} → ${home}`, role: json.user.role };
      }
      detail = typeof json.detail === 'string' ? json.detail : text;
    } catch {
      // keep raw text
    }
    return { ok: false, detail: `${res.status} ${detail}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const probe = await tryLogin('admin@logbook.app', 'admin123');
  if (!probe.ok && /fetch failed|ECONNREFUSED|network|Failed to fetch|Cannot reach/i.test(probe.detail)) {
    console.log(`demo-logins: API unreachable at ${API_URL} — skipped (${probe.detail})`);
    process.exit(0);
  }

  let failed = 0;
  for (const account of ALL_DEMO_LOGINS) {
    const result = await tryLogin(account.email, account.password);
    if (result.ok) {
      console.log(`ok  ${account.email} → ${result.detail}`);
    } else {
      failed += 1;
      console.error(`FAIL ${account.email} → ${result.detail}`);
    }
  }

  if (failed > 0) {
    console.error(`demo-logins: ${failed}/${ALL_DEMO_LOGINS.length} failed`);
    process.exit(1);
  }
  console.log(`demo-logins: all ${ALL_DEMO_LOGINS.length} accounts signed in`);
}

main();
