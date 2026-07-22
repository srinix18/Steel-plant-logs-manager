import { router } from 'expo-router';

import { ApiError, getErrorMessage } from '@/src/api/errors';
import { clearSession, getToken } from '@/src/api/storage';

export { ApiError, getErrorMessage };

const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8000/api/v1';

const DEFAULT_TIMEOUT_MS = 30_000;

/** Called by AuthProvider so 401 also clears in-memory user. */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export function getApiBaseUrl(): string {
  return API_URL;
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function handleUnauthorized(url: string) {
  // Wrong password on login is also 401 — do not clear/redirect in that case.
  if (url.includes('/auth/login')) return;
  await clearSession();
  onUnauthorized?.();
  router.replace('/login');
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<{ data: T }> {
  const token = await getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        await handleUnauthorized(path);
      }
      const detail =
        data && typeof data === 'object' && data !== null && 'detail' in data
          ? (data as { detail: unknown }).detail
          : undefined;
      throw new ApiError(typeof detail === 'string' ? detail : `Request failed (${response.status})`, {
        status: response.status,
        detail,
      });
    }

    return { data: data as T };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timed out. Check your connection and try again.', {
        code: 'ECONNABORTED',
      });
    }
    if (error instanceof TypeError) {
      throw new ApiError(
        'Cannot reach the server. Check EXPO_PUBLIC_API_URL and that the API is running.',
        { code: 'NETWORK_ERROR' }
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Drop-in shape used by auth helpers (axios-like). */
export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
