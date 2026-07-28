/**
 * P6-SEC — API URL / logging helpers (no secrets in logs).
 */

const LOCAL_DEV_HOST =
  /^(https?:\/\/)?(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?/i;

/** Hosts allowed over HTTP (Expo Go LAN / emulator). Never for store builds. */
export function isLocalDevApiUrl(url: string): boolean {
  return LOCAL_DEV_HOST.test(url.trim());
}

/** Preview/production EAS profiles must use HTTPS. */
export function requiresHttpsApiUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return true;
  if (u.startsWith('https://')) return false;
  return !isLocalDevApiUrl(u);
}

/**
 * In release builds, warn when EXPO_PUBLIC_API_URL is plain HTTP (non-local).
 * Dev / Expo Go LAN stays HTTP.
 */
export function assertProductionApiUrl(url: string): void {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (isDev) return;
  if (!requiresHttpsApiUrl(url)) return;
  // Do not print the full URL with query secrets — path only.
  const safe = sanitizeUrlForLog(url);
  // eslint-disable-next-line no-console
  console.warn(
    `[moi-sec] Release builds must use HTTPS for EXPO_PUBLIC_API_URL (got ${safe}). Set eas.json production.env.`
  );
}

/** Strip query/hash; never log Authorization or tokens. */
export function sanitizeUrlForLog(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url.split('?')[0]?.split('#')[0] ?? '[invalid-url]';
  }
}

/** True if a log line looks like it contains a bearer token / access_token. */
export function logLineLooksSensitive(line: string): boolean {
  return /access[_-]?token|bearer\s+[a-z0-9._-]+|authorization\s*:/i.test(line);
}
