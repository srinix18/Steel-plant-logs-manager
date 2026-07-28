/**
 * P6-SEC — unit: no tokens in logs; SecureStore session; HTTPS prod; 401 clears session.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertProductionApiUrl,
  isLocalDevApiUrl,
  logLineLooksSensitive,
  requiresHttpsApiUrl,
  sanitizeUrlForLog,
} from '../src/api/security.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

assert.equal(isLocalDevApiUrl('http://192.168.0.10:8000/api/v1'), true);
assert.equal(isLocalDevApiUrl('http://10.0.2.2:8000/api/v1'), true);
assert.equal(isLocalDevApiUrl('http://localhost:8000/api/v1'), true);
assert.equal(isLocalDevApiUrl('https://api.example.com/api/v1'), false);
assert.equal(requiresHttpsApiUrl('https://api.example.com/api/v1'), false);
assert.equal(requiresHttpsApiUrl('http://api.example.com/api/v1'), true);
assert.equal(requiresHttpsApiUrl('http://192.168.1.1:8000/api/v1'), false);

assert.equal(
  sanitizeUrlForLog('https://api.example.com/api/v1/auth/login?x=1'),
  'https://api.example.com/api/v1/auth/login'
);
assert.equal(logLineLooksSensitive('Authorization: Bearer abc.def'), true);
assert.equal(logLineLooksSensitive('access_token=secret'), true);
assert.equal(logLineLooksSensitive('[moi-api] GET https://x/api/v1/runs'), false);

// assertProductionApiUrl is a no-op under Node (no __DEV__ false) — just callable.
assertProductionApiUrl('https://api.example.com/api/v1');

const client = fs.readFileSync(path.join(root, 'src/api/client.ts'), 'utf8');
assert.ok(client.includes('clearSession'), '401 path clears session');
assert.ok(client.includes('handleUnauthorized') || client.includes('/auth/login'), 'login 401 exempt');
assert.ok(client.includes('sanitizeUrlForLog'), 'dev logs sanitize URLs');
assert.ok(client.includes('assertProductionApiUrl'), 'prod HTTPS check wired');
assert.ok(!/console\.(log|debug|info)\([^)]*access_token/i.test(client), 'no access_token in logs');
assert.ok(!/console\.(log|debug|info)\([^)]*Bearer/i.test(client), 'no Bearer in logs');

const storage = fs.readFileSync(path.join(root, 'src/api/storage.ts'), 'utf8');
assert.ok(storage.includes('SecureStore'), 'SecureStore used');
assert.ok(storage.includes('clearSession'), 'clearSession exists');
assert.ok(storage.includes('AsyncStorage.multiRemove') || storage.includes('multiRemove'), 'clear wipes AsyncStorage');
assert.ok(storage.includes('TOKEN_KEY'), 'token key');
assert.ok(
  storage.includes('removeItem(key)') || storage.includes("AsyncStorage.removeItem"),
  'secure write strips AsyncStorage twin'
);

const auth = fs.readFileSync(path.join(root, 'src/auth/AuthContext.tsx'), 'utf8');
assert.ok(auth.includes('clearSession'), 'logout/boot clears session');
assert.ok(auth.includes('setUnauthorizedHandler'), '401 clears in-memory user');
assert.ok(auth.includes('logout'), 'logout exported');

const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
assert.ok(
  String(eas.build.preview.env.EXPO_PUBLIC_API_URL).startsWith('https://'),
  'preview HTTPS'
);
assert.ok(
  String(eas.build.production.env.EXPO_PUBLIC_API_URL).startsWith('https://'),
  'production HTTPS'
);

// Spot-check src/ for console logs that look sensitive (api + auth only).
for (const rel of ['src/api', 'src/auth']) {
  const dir = path.join(root, rel);
  for (const name of fs.readdirSync(dir)) {
    if (!/\.(ts|tsx)$/.test(name)) continue;
    const src = fs.readFileSync(path.join(dir, name), 'utf8');
    for (const line of src.split('\n')) {
      if (!line.includes('console.')) continue;
      assert.ok(
        !logLineLooksSensitive(line) || line.includes('logLineLooksSensitive'),
        `sensitive log in ${rel}/${name}: ${line.trim()}`
      );
    }
  }
}

console.log('test-sec: OK');
