export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
  completedAt?: number;
  tags?: string[];
  isPinned?: boolean;
  // 기한 (선택), YYYY-MM-DD. 목록 정렬 시 고정 다음으로, 기한이 빠른 항목이 먼저 온다.
  dueDate?: string;
  // 지식창고 글쓰기 UI를 그대로 재사용하는 할일 상세 내용. 지식창고(memos)에는 절대
  // 나타나지 않고 이 할일에만 붙어 있음 — MemoryPalaceScreen/spacedRepetition 대상이 아님.
  detailText?: string;
  detailImageUris?: string[];
  detailNoteType?: 'text' | 'checklist';
  detailChecklistItems?: ChecklistItem[];
}

export interface Memo {
  id: string;
  text: string;
  // 카드 하나에 여러 장 첨부 가능. 구버전 데이터(단일 image_uri)는 storage.ts에서
  // 배열로 변환해서 채워준다.
  imageUris?: string[];
  createdAt: number;
  reviewStage: number;
  nextReviewAt: number;
  lastReviewedAt?: number;
  isPinned?: boolean;
  // 그리드 최상단 고정 + 매일 복습 대상으로 강제 편입(다음 복습일과 무관하게 매일 다시 나타남).
  // isPinned(구글킵 스타일 위치 고정)과는 별개 개념 — 핀 아이콘으로 켠다.
  dailyPin?: boolean;
  tags?: string[];
  color?: string;
  noteType?: 'text' | 'checklist';
  checklistItems?: ChecklistItem[];
}

export interface ScheduleEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  createdAt: number;
}

export interface Favorite {
  id: string;
  title: string;
  url: string;
  order: number;
  createdAt: number;
}

// Values double as Supabase table names (src/storage/storage.ts).
export const STORAGE_KEYS = {
  TODOS: 'todos',
  MEMOS: 'memos',
  SCHEDULES: 'schedules',
  FAVORITES: 'favorites',
} as const;
