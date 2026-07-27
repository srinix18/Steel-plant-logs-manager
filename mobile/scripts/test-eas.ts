/**
 * P6-EAS — unit: eas.json profiles (APK/AAB) + EXPO_PUBLIC_API_URL + project id.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const easPath = path.join(root, 'eas.json');
assert.ok(fs.existsSync(easPath), 'eas.json missing');
const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));

assert.ok(eas.build?.preview, 'preview profile');
assert.ok(eas.build?.production, 'production profile');
assert.equal(eas.build.preview.android?.buildType, 'apk', 'preview APK');
assert.equal(eas.build.production.android?.buildType, 'app-bundle', 'production AAB');

for (const profile of ['development', 'preview', 'production'] as const) {
  const env = eas.build[profile]?.env;
  assert.ok(env?.EXPO_PUBLIC_API_URL, `${profile} EXPO_PUBLIC_API_URL`);
  assert.ok(
    String(env.EXPO_PUBLIC_API_URL).includes('/api/v1'),
    `${profile} API URL should include /api/v1`
  );
}
assert.ok(
  String(eas.build.preview.env.EXPO_PUBLIC_API_URL).startsWith('https://'),
  'preview should use https placeholder for staging'
);
assert.ok(
  String(eas.build.production.env.EXPO_PUBLIC_API_URL).startsWith('https://'),
  'production should use https'
);

const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const projectId = appJson.expo?.extra?.eas?.projectId;
assert.ok(projectId && typeof projectId === 'string', 'EAS projectId in app.json');
assert.match(projectId, /^[0-9a-f-]{36}$/i);

const appConfig = fs.readFileSync(path.join(root, 'app.config.js'), 'utf8');
assert.ok(appConfig.includes('EXPO_PUBLIC_API_URL'));
assert.ok(appConfig.includes('apiUrl'));
assert.ok(appConfig.includes(projectId) || appConfig.includes('projectId'));

const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
assert.ok(envExample.includes('EXPO_PUBLIC_API_URL'));
assert.ok(envExample.includes('EAS') || envExample.includes('eas build'));

const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
assert.ok(readme.includes('eas build'));
assert.ok(readme.includes('--profile preview') || readme.includes('profile preview'));
assert.ok(readme.includes('--profile production') || readme.includes('profile production'));
assert.ok(readme.includes('EXPO_PUBLIC_API_URL'));

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.ok(pkg.scripts?.['eas:preview'] || pkg.scripts?.['eas:build:preview']);
assert.ok(pkg.scripts?.['eas:production'] || pkg.scripts?.['eas:build:production']);

console.log(
  `eas: OK (projectId=${projectId}; preview=apk; production=aab; env wired)`
);
console.log('test-eas: OK');
