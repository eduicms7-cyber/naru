import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Memo, ScheduleEvent, STORAGE_KEYS, Todo } from '../types';

type TableName = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

async function getUserId(): Promise<string | null> {
  // getSession() reads the persisted session locally; unlike getUser() it doesn't
  // need a network round-trip, so the cache fallback below still works offline.
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function rowToTodo(row: any): Todo {
  return {
    id: row.id,
    title: row.title,
    done: row.done,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    tags: row.tags ?? undefined,
  };
}

function todoToRow(item: Todo, userId: string) {
  return {
    id: item.id,
    user_id: userId,
    title: item.title,
    done: item.done,
    created_at: item.createdAt,
    completed_at: item.completedAt ?? null,
    tags: item.tags ?? [],
  };
}

function rowToMemo(row: any): Memo {
  return {
    id: row.id,
    text: row.text,
    imageUri: row.image_uri ?? undefined,
    createdAt: row.created_at,
    reviewStage: row.review_stage,
    nextReviewAt: row.next_review_at,
    lastReviewedAt: row.last_reviewed_at ?? undefined,
    isPinned: row.is_pinned ?? undefined,
    tags: row.tags ?? undefined,
    color: row.color ?? undefined,
    noteType: row.note_type ?? 'text',
    checklistItems: row.checklist_items ?? undefined,
  };
}

function memoToRow(item: Memo, userId: string) {
  return {
    id: item.id,
    user_id: userId,
    text: item.text,
    image_uri: item.imageUri ?? null,
    created_at: item.createdAt,
    review_stage: item.reviewStage,
    next_review_at: item.nextReviewAt,
    last_reviewed_at: item.lastReviewedAt ?? null,
    is_pinned: item.isPinned ?? false,
    tags: item.tags ?? [],
    color: item.color ?? null,
    note_type: item.noteType ?? 'text',
    checklist_items: item.checklistItems ?? [],
  };
}

function rowToSchedule(row: any): ScheduleEvent {
  return { id: row.id, date: row.date, title: row.title, createdAt: row.created_at };
}

function scheduleToRow(item: ScheduleEvent, userId: string) {
  return { id: item.id, user_id: userId, date: item.date, title: item.title, created_at: item.createdAt };
}

function rowsToItems<T>(table: TableName, rows: any[]): T[] {
  switch (table) {
    case STORAGE_KEYS.TODOS:
      return rows.map(rowToTodo) as unknown as T[];
    case STORAGE_KEYS.MEMOS:
      return rows.map(rowToMemo) as unknown as T[];
    case STORAGE_KEYS.SCHEDULES:
      return rows.map(rowToSchedule) as unknown as T[];
    default:
      return [];
  }
}

// Memo images come in as local file://(native) or blob:/data:(web) URIs from the picker.
// Those paths don't exist on other devices, so upload them to Storage and swap in the
// public URL. Already-synced (http/https) URIs are left untouched.
async function ensureUploadedImage(uri: string | undefined, userId: string): Promise<string | undefined> {
  if (!uri || /^https?:\/\//.test(uri)) return uri;
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const ext = blob.type?.split('/')?.[1] || 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('memo-images')
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
    if (error) throw error;
    return supabase.storage.from('memo-images').getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.warn('이미지 업로드 실패, 로컬 경로를 그대로 사용합니다:', e);
    return uri;
  }
}

// Memos need the async image upload above; todos/schedules convert synchronously.
async function buildRows<T>(table: TableName, items: T[], userId: string): Promise<any[]> {
  switch (table) {
    case STORAGE_KEYS.TODOS:
      return (items as unknown as Todo[]).map((item) => todoToRow(item, userId));
    case STORAGE_KEYS.SCHEDULES:
      return (items as unknown as ScheduleEvent[]).map((item) => scheduleToRow(item, userId));
    case STORAGE_KEYS.MEMOS: {
      const memoItems = items as unknown as Memo[];
      return Promise.all(
        memoItems.map(async (item) => {
          const imageUri = await ensureUploadedImage(item.imageUri, userId);
          return memoToRow({ ...item, imageUri }, userId);
        })
      );
    }
    default:
      return [];
  }
}

// Offline cache: lets the app show the last-synced data and queue edits when the
// network call to Supabase fails, instead of silently showing an empty list and
// losing whatever was just typed. The cache always holds the full current list
// (matching the upsert+delete-the-rest sync below), so a later successful save
// from any screen naturally carries any offline edits along with it.
function cacheKey(table: TableName, userId: string) {
  return `naru_cache_${table}_${userId}`;
}

function pendingKey(table: TableName, userId: string) {
  return `naru_pending_${table}_${userId}`;
}

async function readCache<T>(table: TableName, userId: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(cacheKey(table, userId));
  return raw ? JSON.parse(raw) : [];
}

async function writeCache<T>(table: TableName, userId: string, items: T[]): Promise<void> {
  await AsyncStorage.setItem(cacheKey(table, userId), JSON.stringify(items));
}

async function pushRows(table: TableName, userId: string, rows: any[]): Promise<void> {
  if (rows.length > 0) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }
  let deleteQuery = supabase.from(table).delete().eq('user_id', userId);
  if (rows.length > 0) {
    const keepIds = rows.map((row) => `"${row.id}"`).join(',');
    deleteQuery = deleteQuery.not('id', 'in', `(${keepIds})`);
  }
  const { error } = await deleteQuery;
  if (error) throw error;
}

export async function loadItems<T>(table: TableName): Promise<T[]> {
  const userId = await getUserId();
  if (!userId) return [];

  // A previous saveItems couldn't reach the server — retry it before fetching,
  // so we don't overwrite local edits with stale server data.
  if (await AsyncStorage.getItem(pendingKey(table, userId))) {
    try {
      const cached = await readCache<T>(table, userId);
      await pushRows(table, userId, await buildRows(table, cached, userId));
      await AsyncStorage.removeItem(pendingKey(table, userId));
    } catch {
      return readCache<T>(table, userId);
    }
  }

  const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
  if (error || !data) return readCache<T>(table, userId);

  const items = rowsToItems<T>(table, data);
  await writeCache(table, userId, items);
  return items;
}

export async function saveItems<T>(table: TableName, items: T[]): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const rows = await buildRows(table, items, userId);

  // Cache the resolved version (memo image URIs may have just changed) immediately,
  // so the edit survives even if the network push below fails.
  await writeCache(table, userId, rowsToItems<T>(table, rows));

  try {
    await pushRows(table, userId, rows);
    await AsyncStorage.removeItem(pendingKey(table, userId));
  } catch (e) {
    console.warn('Supabase 저장 실패, 다음 동기화 때 다시 시도합니다:', e);
    await AsyncStorage.setItem(pendingKey(table, userId), '1');
  }
}
