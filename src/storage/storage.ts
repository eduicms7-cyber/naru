import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { Favorite, Memo, ScheduleEvent, STORAGE_KEYS, Todo } from '../types';
import * as localStorage from './localStorage';

type TableName = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// Build-time flag for the login-free, phone-only variant — see CLAUDE.md.
// When set, every exported function below delegates to localStorage.ts (AsyncStorage only,
// no Supabase) and the cloud logic underneath never runs.
const IS_LOCAL_MODE = process.env.EXPO_PUBLIC_STORAGE_MODE === 'local';

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
  // image_uris(신규 배열 컬럼)이 있으면 그걸 쓰고, 없으면 구버전 단일 컬럼(image_uri)을
  // 배열의 첫 원소로 변환해서 하위호환을 지킨다.
  const legacyUris: string[] | undefined = row.image_uris;
  const imageUris =
    legacyUris && legacyUris.length > 0
      ? legacyUris
      : row.image_uri
      ? [row.image_uri]
      : undefined;
  return {
    id: row.id,
    text: row.text,
    imageUris,
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
    image_uris: item.imageUris ?? [],
    // 구버전(단일 이미지) 컬럼도 당분간 병행 기록 — 롤백/외부 조회 대비.
    image_uri: item.imageUris?.[0] ?? null,
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

function rowToFavorite(row: any): Favorite {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    order: row.position,
    createdAt: row.created_at,
  };
}

function favoriteToRow(item: Favorite, userId: string) {
  return {
    id: item.id,
    user_id: userId,
    title: item.title,
    url: item.url,
    position: item.order,
    created_at: item.createdAt,
  };
}

function rowsToItems<T>(table: TableName, rows: any[]): T[] {
  switch (table) {
    case STORAGE_KEYS.TODOS:
      return rows.map(rowToTodo) as unknown as T[];
    case STORAGE_KEYS.MEMOS:
      return rows.map(rowToMemo) as unknown as T[];
    case STORAGE_KEYS.SCHEDULES:
      return rows.map(rowToSchedule) as unknown as T[];
    case STORAGE_KEYS.FAVORITES:
      return rows.map(rowToFavorite) as unknown as T[];
    default:
      return [];
  }
}

function extensionFromUri(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  return match ? match[1].toLowerCase() : 'jpg';
}

// Memo images come in as local file://(native) or blob:/data:(web) URIs from the picker.
// Those paths don't exist on other devices, so upload them to Storage and swap in the
// public URL. Already-synced (http/https) URIs are left untouched.
async function ensureUploadedImage(uri: string, userId: string): Promise<string> {
  if (/^https?:\/\//.test(uri)) return uri;
  // Multiple images can upload concurrently (Promise.all below), so Date.now() alone
  // could collide within the same millisecond — add a random suffix to keep paths unique.
  const basePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = blob.type?.split('/')?.[1] || 'jpg';
      const path = `${basePath}.${ext}`;
      const { error } = await supabase.storage
        .from('memo-images')
        .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
      if (error) throw error;
      return supabase.storage.from('memo-images').getPublicUrl(path).data.publicUrl;
    }

    // React Native/Android에서는 fetch(uri).blob()이 로컬 file:// 경로를 신뢰성 있게
    // 읽지 못하는(빈 blob이 되는 등) 잘 알려진 문제가 있다 — base64로 직접 읽어서
    // ArrayBuffer로 변환한 뒤 업로드하는 Supabase 공식 권장 방식을 대신 사용한다.
    const ext = extensionFromUri(uri);
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const path = `${basePath}.${ext}`;
    const { error } = await supabase.storage
      .from('memo-images')
      .upload(path, decode(base64), { contentType, upsert: true });
    if (error) throw error;
    return supabase.storage.from('memo-images').getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.warn('이미지 업로드 실패, 로컬 경로를 그대로 사용합니다:', e);
    return uri;
  }
}

async function ensureUploadedImages(uris: string[] | undefined, userId: string): Promise<string[] | undefined> {
  if (!uris || uris.length === 0) return uris;
  return Promise.all(uris.map((uri) => ensureUploadedImage(uri, userId)));
}

// Memos need the async image upload above; todos/schedules convert synchronously.
async function buildRow<T>(table: TableName, item: T, userId: string): Promise<any> {
  switch (table) {
    case STORAGE_KEYS.TODOS:
      return todoToRow(item as unknown as Todo, userId);
    case STORAGE_KEYS.SCHEDULES:
      return scheduleToRow(item as unknown as ScheduleEvent, userId);
    case STORAGE_KEYS.FAVORITES:
      return favoriteToRow(item as unknown as Favorite, userId);
    case STORAGE_KEYS.MEMOS: {
      const memoItem = item as unknown as Memo;
      const imageUris = await ensureUploadedImages(memoItem.imageUris, userId);
      return memoToRow({ ...memoItem, imageUris }, userId);
    }
    default:
      return null;
  }
}

// Offline cache: lets the app show the last-synced data even when the network call to
// Supabase fails. The cache is fully replaced whenever loadItems successfully fetches the
// server list (server is the source of truth), and incrementally patched by
// createItem/updateItem/deleteItem so an offline edit is visible immediately.
function cacheKey(table: TableName, userId: string) {
  return `naru_cache_${table}_${userId}`;
}

// Queue of individual create/update/delete operations that failed to reach Supabase.
// Unlike the old "push the whole list, delete whatever's missing" approach, replaying this
// queue can only ever touch the specific rows it recorded — it can never delete a row that
// another device created while this device was offline.
function pendingOpsKey(table: TableName, userId: string) {
  return `naru_pending_ops_${table}_${userId}`;
}

type PendingOp = { type: 'create' | 'update'; row: any } | { type: 'delete'; id: string };

// Local cache may still hold memos saved before the multi-image change (single `imageUri`
// field). Normalize those into `imageUris` so callers never need to know about the legacy shape.
function normalizeCachedMemo(item: any): Memo {
  if (item && item.imageUris === undefined && item.imageUri) {
    const { imageUri, ...rest } = item;
    return { ...rest, imageUris: [imageUri] };
  }
  return item as Memo;
}

async function readCache<T>(table: TableName, userId: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(cacheKey(table, userId));
  if (!raw) return [];
  const items = JSON.parse(raw);
  if (table === STORAGE_KEYS.MEMOS) {
    return (items as any[]).map(normalizeCachedMemo) as unknown as T[];
  }
  return items;
}

async function writeCache<T>(table: TableName, userId: string, items: T[]): Promise<void> {
  await AsyncStorage.setItem(cacheKey(table, userId), JSON.stringify(items));
}

async function cacheUpsert<T extends { id: string }>(table: TableName, userId: string, item: T): Promise<void> {
  const items = await readCache<T>(table, userId);
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index >= 0) {
    items[index] = item;
  } else {
    items.unshift(item);
  }
  await writeCache(table, userId, items);
}

async function cacheRemove<T extends { id: string }>(table: TableName, userId: string, id: string): Promise<void> {
  const items = await readCache<T>(table, userId);
  await writeCache(table, userId, items.filter((item) => item.id !== id));
}

async function readPendingOps(table: TableName, userId: string): Promise<PendingOp[]> {
  const raw = await AsyncStorage.getItem(pendingOpsKey(table, userId));
  return raw ? JSON.parse(raw) : [];
}

async function writePendingOps(table: TableName, userId: string, ops: PendingOp[]): Promise<void> {
  if (ops.length === 0) {
    await AsyncStorage.removeItem(pendingOpsKey(table, userId));
  } else {
    await AsyncStorage.setItem(pendingOpsKey(table, userId), JSON.stringify(ops));
  }
}

async function enqueuePendingOp(table: TableName, userId: string, op: PendingOp): Promise<void> {
  const ops = await readPendingOps(table, userId);
  ops.push(op);
  await writePendingOps(table, userId, ops);
}

async function applyPendingOp(table: TableName, userId: string, op: PendingOp): Promise<void> {
  if (op.type === 'delete') {
    const { error } = await supabase.from(table).delete().eq('id', op.id).eq('user_id', userId);
    if (error) throw error;
    return;
  }
  // 재생 시점에는 이전 시도가 실제로는 서버에 반영됐을 수도 있으니(응답만 유실),
  // insert 대신 upsert로 멱등하게 재시도한다.
  const { error } = await supabase.from(table).upsert(op.row, { onConflict: 'id' });
  if (error) throw error;
}

// Retries queued ops one at a time, in order, keeping only the ones that still fail.
// This never touches rows outside the queue, so it can't wipe out another device's edits.
export async function flushPendingOps(table: TableName, userId: string): Promise<void> {
  const ops = await readPendingOps(table, userId);
  if (ops.length === 0) return;
  const remaining: PendingOp[] = [];
  for (const op of ops) {
    try {
      await applyPendingOp(table, userId, op);
    } catch {
      remaining.push(op);
    }
  }
  await writePendingOps(table, userId, remaining);
}

export async function loadItems<T>(table: TableName): Promise<T[]> {
  if (IS_LOCAL_MODE) return localStorage.loadItems<T>(table);

  const userId = await getUserId();
  if (!userId) return [];

  // 서버에서 전체 목록을 새로 받아오기 전에, 이전에 실패해서 큐에 쌓인 개별
  // 생성/수정/삭제 작업을 먼저 재생한다.
  await flushPendingOps(table, userId);

  const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
  if (error || !data) return readCache<T>(table, userId);

  const items = rowsToItems<T>(table, data);
  await writeCache(table, userId, items);
  return items;
}

export async function createItem<T extends { id: string }>(table: TableName, item: T): Promise<void> {
  if (IS_LOCAL_MODE) return localStorage.createItem(table, item);

  const userId = await getUserId();
  if (!userId) return;

  const row = await buildRow(table, item, userId);
  const resolvedItem = rowsToItems<T>(table, [row])[0];
  // 네트워크 성공 여부와 무관하게, 방금 입력한 내용이 화면 재진입 시에도 보이도록 먼저 캐시에 반영.
  await cacheUpsert(table, userId, resolvedItem);

  try {
    const { error } = await supabase.from(table).insert(row);
    if (error) throw error;
  } catch (e) {
    console.warn('Supabase 생성 실패, 다음 동기화 때 다시 시도합니다:', e);
    await enqueuePendingOp(table, userId, { type: 'create', row });
  }
}

export async function updateItem<T extends { id: string }>(table: TableName, item: T): Promise<void> {
  if (IS_LOCAL_MODE) return localStorage.updateItem(table, item);

  const userId = await getUserId();
  if (!userId) return;

  const row = await buildRow(table, item, userId);
  const resolvedItem = rowsToItems<T>(table, [row])[0];
  await cacheUpsert(table, userId, resolvedItem);

  try {
    const { error } = await supabase.from(table).update(row).eq('id', row.id);
    if (error) throw error;
  } catch (e) {
    console.warn('Supabase 수정 실패, 다음 동기화 때 다시 시도합니다:', e);
    await enqueuePendingOp(table, userId, { type: 'update', row });
  }
}

export async function deleteItem(table: TableName, id: string): Promise<void> {
  if (IS_LOCAL_MODE) return localStorage.deleteItem(table, id);

  const userId = await getUserId();
  if (!userId) return;

  await cacheRemove(table, userId, id);

  try {
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
  } catch (e) {
    console.warn('Supabase 삭제 실패, 다음 동기화 때 다시 시도합니다:', e);
    await enqueuePendingOp(table, userId, { type: 'delete', id });
  }
}
