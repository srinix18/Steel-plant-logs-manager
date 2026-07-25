/**
 * Generates Expo Router placeholder screens for every drawer link.
 *
 * Node ESM needs explicit .ts extensions when importing app sources.
 * Run via: npm run gen:nav
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const appDir = path.join(root, 'app', '(app)');

async function loadRoutes() {
  // Patch relative imports to include .ts for Node, then import.
  const files = [
    path.join(root, 'src', 'auth', 'roles.ts'),
    path.join(root, 'src', 'nav', 'buildDrawerNav.ts'),
  ];
  const backups = files.map((f) => ({ f, raw: fs.readFileSync(f, 'utf8') }));
  try {
    for (const { f, raw } of backups) {
      const patched = raw
        .replaceAll("from '../types/user'", "from '../types/user.ts'")
        .replaceAll("from '../auth/roles'", "from '../auth/roles.ts'");
      fs.writeFileSync(f, patched);
    }
    const mod = await import(pathToFileURL(path.join(root, 'src/nav/buildDrawerNav.ts')).href);
    return mod.allPlaceholderRoutes() as Array<{
      label: string;
      href: string;
      nextChunk: string;
    }>;
  } finally {
    for (const { f, raw } of backups) {
      fs.writeFileSync(f, raw);
    }
  }
}

function hrefToFile(href: string): string {
  const rest = href.replace(/^\/\(app\)\//, '').replace(/^\//, '');
  const parts = rest.split('/');
  if (parts.length === 1) {
    return path.join(parts[0], 'index.tsx');
  }
  return `${parts.join(path.sep)}.tsx`;
}

function escape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

const routes = await loadRoutes();
let written = 0;

for (const route of routes) {
  const rel = hrefToFile(route.href);
  const abs = path.join(appDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  if (route.href === '/profile' || route.href === '/(app)/profile') {
    continue;
  }

  // Implemented screens — do not overwrite with RoleHomePlaceholder.
  const hrefNorm = route.href.replace(/^\/\(app\)/, '') || route.href;
  const implemented = new Set([
    '/shift',
    '/my-runs',
    '/peel',
    '/messages',
    '/profile',
    '/admin/departments',
    '/supervisor',
    '/hod',
    '/safety/scan',
    '/safety/dashboard',
    '/safety/inspections',
    '/safety/sops',
    '/safety/incidents',
    '/maintenance',
  ]);
  if (implemented.has(hrefNorm) || implemented.has(route.href)) {
    continue;
  }

  const leaf = route.href.replace(/^\/\(app\)\//, '').replace(/^\//, '');
  if (!leaf.includes('/')) {
    const sibling = path.join(appDir, `${leaf}.tsx`);
    if (fs.existsSync(sibling)) fs.unlinkSync(sibling);
  }

  const body = `import { RoleHomePlaceholder } from '@/src/components/RoleHomePlaceholder';

export default function Screen() {
  return (
    <RoleHomePlaceholder
      title="${escape(route.label)}"
      description="Placeholder for ${escape(route.label)}. Full screen lands in a later plan chunk."
      nextChunk="${escape(route.nextChunk)}"
    />
  );
}
`;
  fs.writeFileSync(abs, body, 'utf8');
  written += 1;
}

console.log(`generate-nav-screens: wrote ${written} files`);
