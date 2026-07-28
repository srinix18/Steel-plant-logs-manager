import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { User } from '@/src/types/user';

export const TOKEN_KEY = 'moi_access_token';
export const USER_KEY = 'moi_user';

type StorageBackend = 'secure' | 'async';

let backendPromise: Promise<StorageBackend> | null = null;

/**
 * Prefer SecureStore on native when the Expo Go / native module is healthy.
 * Fall back to AsyncStorage on web or when SecureStore methods are missing
 * (avoids: ExpoSecureStore.default.deleteValueWithKeyAsync is not a function).
 * P6-SEC: session secrets use SecureStore when available; clearSession wipes both.
 */
async function resolveBackend(): Promise<StorageBackend> {
  if (Platform.OS === 'web') return 'async';

  try {
    const available = await SecureStore.isAvailableAsync();
    if (!available) return 'async';
    // Probe that the native methods Expo Go actually exposes are callable.
    await SecureStore.getItemAsync('__moi_secure_probe__');
    return 'secure';
  } catch {
    return 'async';
  }
}

function getBackend(): Promise<StorageBackend> {
  if (!backendPromise) backendPromise = resolveBackend();
  return backendPromise;
}

/** Test / diagnostics — never log returned secrets. */
export async function getSessionStorageBackend(): Promise<StorageBackend> {
  return getBackend();
}

async function getItem(key: string): Promise<string | null> {
  const backend = await getBackend();
  if (backend === 'secure') {
    try {
      const fromSecure = await SecureStore.getItemAsync(key);
      if (fromSecure != null) return fromSecure;
      // Migrate leftover AsyncStorage copy (older builds) into SecureStore.
      const legacy = await AsyncStorage.getItem(key);
      if (legacy != null) {
        await SecureStore.setItemAsync(key, legacy);
        await AsyncStorage.removeItem(key);
        return legacy;
      }
      return null;
    } catch {
      backendPromise = Promise.resolve('async');
      return AsyncStorage.getItem(key);
    }
  }
  return AsyncStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  const backend = await getBackend();
  if (backend === 'secure') {
    try {
      await SecureStore.setItemAsync(key, value);
      // P6-SEC: do not leave a plaintext AsyncStorage twin.
      await AsyncStorage.removeItem(key);
      return;
    } catch {
      backendPromise = Promise.resolve('async');
    }
  }
  await AsyncStorage.setItem(key, value);
}

async function deleteItem(key: string): Promise<void> {
  const backend = await getBackend();
  if (backend === 'secure') {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      backendPromise = Promise.resolve('async');
    }
  }
  await AsyncStorage.removeItem(key);
}

export async function getToken(): Promise<string | null> {
  return getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await setItem(TOKEN_KEY, token);
}

export async function getStoredUser(): Promise<User | null> {
  const raw = await getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function setStoredUser(user: User): Promise<void> {
  await setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Logout / 401 — wipe SecureStore and AsyncStorage for session keys
 * so a fallback backend cannot resurrect a cleared token.
 */
export async function clearSession(): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined),
    SecureStore.deleteItemAsync(USER_KEY).catch(() => undefined),
    AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]),
  ]);
}
