import { Memo } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

// Review spacing modeled on the Ebbinghaus forgetting curve.
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 90];

export function newMemoReviewFields(now: number): Pick<Memo, 'reviewStage' | 'nextReviewAt'> {
  return {
    reviewStage: 0,
    nextReviewAt: now + REVIEW_INTERVALS_DAYS[0] * DAY_MS,
  };
}

export function isDueForReview(memo: Memo, now: number): boolean {
  // dailyPin 카드는 망각곡선 간격을 무시하고 항상 오늘의 복습 대상이다.
  return memo.dailyPin === true || memo.nextReviewAt <= now;
}

export function markRemembered(memo: Memo, now: number): Memo {
  const nextStage = Math.min(memo.reviewStage + 1, REVIEW_INTERVALS_DAYS.length - 1);
  return {
    ...memo,
    reviewStage: nextStage,
    nextReviewAt: now + REVIEW_INTERVALS_DAYS[nextStage] * DAY_MS,
    lastReviewedAt: now,
  };
}

export function markForgot(memo: Memo, now: number): Memo {
  return {
    ...memo,
    reviewStage: 0,
    nextReviewAt: now + REVIEW_INTERVALS_DAYS[0] * DAY_MS,
    lastReviewedAt: now,
  };
}
