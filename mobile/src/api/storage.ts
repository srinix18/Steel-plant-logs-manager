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

async function getItem(key: string): Promise<string | null> {
  const backend = await getBackend();
  if (backend === 'secure') {
    try {
      return await SecureStore.getItemAsync(key);
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
      return;
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

export async function clearSession(): Promise<void> {
  // Never throw — boot / logout must survive broken SecureStore.
  await Promise.allSettled([deleteItem(TOKEN_KEY), deleteItem(USER_KEY)]);
}
