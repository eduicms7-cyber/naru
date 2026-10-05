import { Memo } from '../types';
import { splitQuestionAnswer, stripFormatting } from '../utils/richText';

const DAY_MS = 24 * 60 * 60 * 1000;

// 라이트너 박스: Box 1~5, 박스 번호가 곧 reviewStage. 기억의 궁전(spacedRepetition.ts)과
// 같은 reviewStage/nextReviewAt 필드를 공유하므로, 한쪽에서 복습하면 다른 쪽 일정도 함께 바뀐다.
// Box N의 복습 간격 = LEITNER_INTERVALS_DAYS[N - 1].
export const LEITNER_INTERVALS_DAYS = [1, 3, 7, 14, 30];
export const LEITNER_BOX_COUNT = LEITNER_INTERVALS_DAYS.length;

// 새 카드(reviewStage 0)나 기억의 궁전 6단계(5)를 넘는 값도 1~5 범위로 맞춘다.
export function getLeitnerBox(memo: Pick<Memo, 'reviewStage'>): number {
  return Math.min(LEITNER_BOX_COUNT, Math.max(1, memo.reviewStage));
}

export function isLeitnerDue(memo: Pick<Memo, 'nextReviewAt'>, now: number): boolean {
  return memo.nextReviewAt <= now;
}

// 정답: 다음 박스로 승급(최대 Box 5), 그 박스 간격만큼 뒤로 복습일을 미룬다.
export function markLeitnerCorrect(memo: Memo, now: number): Memo {
  const nextBox = Math.min(getLeitnerBox(memo) + 1, LEITNER_BOX_COUNT);
  return {
    ...memo,
    reviewStage: nextBox,
    nextReviewAt: now + LEITNER_INTERVALS_DAYS[nextBox - 1] * DAY_MS,
    lastReviewedAt: now,
  };
}

// 오답: Box 1로 강등하고 오늘 바로 다시 복습 대상이 되게 한다.
export function markLeitnerWrong(memo: Memo, now: number): Memo {
  return {
    ...memo,
    reviewStage: 1,
    nextReviewAt: now,
    lastReviewedAt: now,
  };
}

export interface Flashcard {
  // 앞면에 보여줄 질문(서식 기호를 뗀 평문).
  question: string;
  // 질문이 아니라 힌트(이미지만 있는 카드의 태그 등)라서 흐리게 보여줘야 하는지.
  isHint: boolean;
  // `---` 구분선이 있을 때 그 아래 답 부분. 없으면 뒷면에 카드 전체를 보여준다.
  answerText?: string;
  // 앞뒷면이 사실상 같은 한 줄 카드는 뒤집지 않고 바로 알고 있음/모름을 묻는다.
  needsFlip: boolean;
}

// 지식창고 카드는 질문/답 필드가 따로 없어서, 본문 모양에 따라 앞/뒷면을 정한다.
// 1) `---` 줄이 있으면 위=질문, 아래=답  2) 여러 줄이면 첫 줄=질문, 뒷면=카드 전체
// 3) 체크리스트는 제목(없으면 첫 항목)=질문  4) 이미지만 있으면 태그를 힌트로.
export function getFlashcard(memo: Memo): Flashcard {
  const hasImages = (memo.imageUris?.length ?? 0) > 0;
  const tagHint = memo.tags && memo.tags.length > 0 ? memo.tags.map((t) => `#${t}`).join(' ') : '';

  if (memo.noteType === 'checklist') {
    const title = stripFormatting(memo.text).trim();
    const firstItem = stripFormatting(memo.checklistItems?.[0]?.text ?? '').trim();
    const question = title || firstItem;
    return question
      ? { question, isHint: false, needsFlip: true }
      : { question: tagHint || '체크리스트', isHint: true, needsFlip: true };
  }

  const split = splitQuestionAnswer(memo.text);
  if (split && split.question) {
    return {
      question: stripFormatting(split.question).trim(),
      isHint: false,
      answerText: split.answer,
      needsFlip: true,
    };
  }

  const lines = stripFormatting(memo.text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { question: tagHint || '이 이미지를 떠올려 보세요', isHint: true, needsFlip: true };
  }
  if (lines.length === 1 && !hasImages) {
    return { question: lines[0], isHint: false, needsFlip: false };
  }
  return { question: lines[0], isHint: false, needsFlip: true };
}

// Fisher–Yates 셔플. 원본 배열은 건드리지 않는다.
export function shuffleCards<T>(cards: T[]): T[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
