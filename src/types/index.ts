export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
}

export interface Memo {
  id: string;
  text: string;
  imageUri?: string;
  createdAt: number;
  reviewStage: number;
  nextReviewAt: number;
  lastReviewedAt?: number;
  isPriority?: boolean;
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
