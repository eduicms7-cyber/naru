import { NativeModules, Platform } from 'react-native';
import { Memo } from '../types';
import { memoSummaryText } from '../utils/richText';

interface ReviewWidgetNativeModule {
  showReview(title: string, body: string): void;
  clearReview(): void;
  requestPermission(): Promise<boolean>;
  setDueMemos(memosJson: string): void;
  getPendingCompletions(): Promise<string[]>;
  setTodos(todosJson: string): void;
  getPendingTodoCompletions(): Promise<string[]>;
  startWakeMonitor(): void;
  canUseFullScreenIntent(): Promise<boolean>;
  openFullScreenIntentSettings(): void;
}

const nativeModule = NativeModules.ReviewWidget as ReviewWidgetNativeModule | undefined;

export function showReview(title: string, body: string): void {
  if (Platform.OS === 'android' && nativeModule) {
    nativeModule.showReview(title, body);
  }
}

export function clearReview(): void {
  if (Platform.OS === 'android' && nativeModule) {
    nativeModule.clearReview();
  }
}

export async function requestReviewPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && nativeModule) {
    return nativeModule.requestPermission();
  }
  return false;
}

export function setDueMemos(
  memos: { id: string; text: string; color?: string; imageUris?: string[] }[]
): void {
  if (Platform.OS === 'android' && nativeModule) {
    nativeModule.setDueMemos(JSON.stringify(memos));
  }
}

// 오늘 복습할 카드 목록을 잠금화면 슬라이드/알림에 반영한다. 지식창고와 라이트너 박스 탭이
// 둘 다 복습 일정을 바꾸므로, 어느 쪽에서 바꿔도 잠금화면이 바로 따라오도록 공용으로 둔다.
export function syncDueMemosToNative(dueMemos: Memo[]): void {
  setDueMemos(
    dueMemos.map((m) => ({
      id: m.id,
      text: memoSummaryText(m),
      color: m.color,
      imageUris: m.imageUris,
    }))
  );
  if (dueMemos.length === 0) {
    clearReview();
  } else {
    showReview(`오늘 복습할 카드 (${dueMemos.length})`, memoSummaryText(dueMemos[0]));
  }
}

// 잠금화면 "기억의 궁전"에서 기억완료 처리된 메모 id 목록을 가져오고, 네이티브 쪽 대기열은 비운다.
export async function getPendingCompletions(): Promise<string[]> {
  if (Platform.OS === 'android' && nativeModule) {
    return nativeModule.getPendingCompletions();
  }
  return [];
}

// 기억의 궁전(잠금화면/앱 내)에 오늘 해야 할(미완료) 할일 목록을 전달한다.
export function setTodos(todos: { id: string; title: string }[]): void {
  if (Platform.OS === 'android' && nativeModule) {
    nativeModule.setTodos(JSON.stringify(todos));
  }
}

// 잠금화면 "기억의 궁전"에서 완료 체크된 할일 id 목록을 가져오고, 네이티브 쪽 대기열은 비운다.
export async function getPendingTodoCompletions(): Promise<string[]> {
  if (Platform.OS === 'android' && nativeModule) {
    return nativeModule.getPendingTodoCompletions();
  }
  return [];
}

export function startWakeMonitor(): void {
  if (Platform.OS === 'android' && nativeModule) {
    nativeModule.startWakeMonitor();
  }
}

// 기억의 궁전 잠금화면 풀스크린 슬라이드는 안드로이드의 "전체 화면 알림" 권한이 있어야
// 화면이 켜질 때 잠금화면 위로 뜬다. 꺼져 있으면 설정 화면을 한 번 열어 켜달라고 안내한다.
export async function ensureFullScreenIntentPermission(): Promise<void> {
  if (Platform.OS !== 'android' || !nativeModule) return;
  const allowed = await nativeModule.canUseFullScreenIntent();
  if (!allowed) {
    nativeModule.openFullScreenIntentSettings();
  }
}
