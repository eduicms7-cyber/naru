import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../types';

type TableName = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// Local-only mode (EXPO_PUBLIC_STORAGE_MODE=local): no login, no Supabase — everything
// lives in a single AsyncStorage array per table. Mirrors storage.ts's exported signatures
// exactly so screens never need to know which mode is active.
function localKey(table: TableName): string {
  return `naru_local_${table}`;
}

async function readAll<T>(table: TableName): Promise<T[]> {
  const raw = await AsyncStorage.getItem(localKey(table));
  return raw ? JSON.parse(raw) : [];
}

async function writeAll<T>(table: TableName, items: T[]): Promise<void> {
  await AsyncStorage.setItem(localKey(table), JSON.stringify(items));
}

export async function loadItems<T>(table: TableName): Promise<T[]> {
  return readAll<T>(table);
}

export async function createItem<T extends { id: string }>(table: TableName, item: T): Promise<void> {
  const items = await readAll<T>(table);
  items.unshift(item);
  await writeAll(table, items);
}

export async function updateItem<T extends { id: string }>(table: TableName, item: T): Promise<void> {
  const items = await readAll<T>(table);
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index >= 0) {
    items[index] = item;
  } else {
    items.unshift(item);
  }
  await writeAll(table, items);
}

export async function deleteItem(table: TableName, id: string): Promise<void> {
  const items = await readAll<{ id: string }>(table);
  await writeAll(
    table,
    items.filter((item) => item.id !== id)
  );
}
