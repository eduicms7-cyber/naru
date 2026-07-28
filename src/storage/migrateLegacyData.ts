import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { saveItems } from './storage';
import { STORAGE_KEYS } from '../types';

// Pre-Supabase builds stored data under these AsyncStorage keys (see storage.ts history).
// Web never had AsyncStorage data, so this only matters on native.
const LEGACY_KEYS = {
  TODOS: '@naru/todos',
  MEMOS: '@naru/memos',
  SCHEDULES: '@naru/schedules',
} as const;

async function loadLegacy<T>(key: string): Promise<T[]> {
  try {
    const json = await AsyncStorage.getItem(key);
    return json ? (JSON.parse(json) as T[]) : [];
  } catch {
    return [];
  }
}

// One-time upload of any pre-existing local data into Supabase right after the first
// successful login. Safe to call on every login: it's a no-op once AsyncStorage is empty.
export async function migrateLegacyDataIfNeeded(): Promise<void> {
  if (Platform.OS === 'web') return;

  const [todos, memos, schedules] = await Promise.all([
    loadLegacy(LEGACY_KEYS.TODOS),
    loadLegacy(LEGACY_KEYS.MEMOS),
    loadLegacy(LEGACY_KEYS.SCHEDULES),
  ]);

  if (todos.length === 0 && memos.length === 0 && schedules.length === 0) return;

  await Promise.all([
    todos.length > 0 ? saveItems(STORAGE_KEYS.TODOS, todos) : Promise.resolve(),
    memos.length > 0 ? saveItems(STORAGE_KEYS.MEMOS, memos) : Promise.resolve(),
    schedules.length > 0 ? saveItems(STORAGE_KEYS.SCHEDULES, schedules) : Promise.resolve(),
  ]);

  await Promise.all([
    AsyncStorage.removeItem(LEGACY_KEYS.TODOS),
    AsyncStorage.removeItem(LEGACY_KEYS.MEMOS),
    AsyncStorage.removeItem(LEGACY_KEYS.SCHEDULES),
  ]);
}
