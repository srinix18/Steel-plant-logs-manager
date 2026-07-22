import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const uiDir = path.join(root, 'src', 'components', 'ui');

const required = [
  'Button.tsx',
  'TextField.tsx',
  'SelectSheet.tsx',
  'DateTimeField.tsx',
  'Card.tsx',
  'Badge.tsx',
  'ListRow.tsx',
  'EmptyState.tsx',
  'LoadingView.tsx',
  'ErrorBanner.tsx',
  'StickyFooter.tsx',
  'Screen.tsx',
  'SegmentedTabs.tsx',
  'index.ts',
];

for (const file of required) {
  assert.ok(fs.existsSync(path.join(uiDir, file)), `missing ${file}`);
}

const login = fs.readFileSync(path.join(root, 'app', 'login.tsx'), 'utf8');
assert.ok(login.includes("from '@/src/components/ui/TextField'"));
assert.ok(login.includes("from '@/src/components/ui/Button'"));
assert.ok(login.includes('size="lg"'));

const messages = fs.readFileSync(
  path.join(root, 'app', '(app)', 'messages', 'index.tsx'),
  'utf8'
);
assert.ok(messages.includes('ListRow'));
assert.ok(messages.includes('SegmentedTabs'));

const selectSheet = fs.readFileSync(path.join(uiDir, 'SelectSheet.tsx'), 'utf8');
assert.ok(!selectSheet.includes('ReactNode'), 'SelectSheet should not reference ReactNode leftover');

console.log(`ui primitives: ok (${required.length - 1} components + barrel)`);
