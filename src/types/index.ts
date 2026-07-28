export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
  completedAt?: number;
  tags?: string[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Memo {
  id: string;
  text: string;
  imageUri?: string;
  createdAt: number;
  reviewStage: number;
  nextReviewAt: number;
  lastReviewedAt?: number;
  isPinned?: boolean;
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

// Values double as Supabase table names (src/storage/storage.ts).
export const STORAGE_KEYS = {
  TODOS: 'todos',
  MEMOS: 'memos',
  SCHEDULES: 'schedules',
} as const;
