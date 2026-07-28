import { NativeModules, Platform } from 'react-native';

interface ReviewWidgetNativeModule {
  showReview(title: string, body: string): void;
  clearReview(): void;
  requestPermission(): Promise<boolean>;
  setPriorityMemos(memosJson: string): void;
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

export function setPriorityMemos(memos: { id: string; text: string }[]): void {
  if (Platform.OS === 'android' && nativeModule) {
    nativeModule.setPriorityMemos(JSON.stringify(memos));
  }
}

export function startWakeMonitor(): void {
  if (Platform.OS === 'android' && nativeModule) {
    nativeModule.startWakeMonitor();
  }
}

// 공지 잠금화면 슬라이드쇼는 안드로이드의 "전체 화면 알림" 권한이 있어야
// 화면이 켜질 때 잠금화면 위로 뜬다. 꺼져 있으면 설정 화면을 한 번 열어 켜달라고 안내한다.
export async function ensureFullScreenIntentPermission(): Promise<void> {
  if (Platform.OS !== 'android' || !nativeModule) return;
  const allowed = await nativeModule.canUseFullScreenIntent();
  if (!allowed) {
    nativeModule.openFullScreenIntentSettings();
  }
}
