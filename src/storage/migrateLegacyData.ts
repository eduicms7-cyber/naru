import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createItem } from './storage';
import { Memo, ScheduleEvent, STORAGE_KEYS, Todo } from '../types';

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
    loadLegacy<Todo>(LEGACY_KEYS.TODOS),
    loadLegacy<Memo>(LEGACY_KEYS.MEMOS),
    loadLegacy<ScheduleEvent>(LEGACY_KEYS.SCHEDULES),
  ]);

  if (todos.length === 0 && memos.length === 0 && schedules.length === 0) return;

  await Promise.all([
    ...todos.map((item) => createItem(STORAGE_KEYS.TODOS, item)),
    ...memos.map((item) => createItem(STORAGE_KEYS.MEMOS, item)),
    ...schedules.map((item) => createItem(STORAGE_KEYS.SCHEDULES, item)),
  ]);

  await Promise.all([
    AsyncStorage.removeItem(LEGACY_KEYS.TODOS),
    AsyncStorage.removeItem(LEGACY_KEYS.MEMOS),
    AsyncStorage.removeItem(LEGACY_KEYS.SCHEDULES),
  ]);
}
