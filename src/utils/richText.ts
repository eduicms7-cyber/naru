import { ChecklistItem, Memo } from '../types';

export interface FormattedSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
}

// 굵게 **텍스트**, 취소선 ~~텍스트~~, 기울임 _텍스트_ — 중첩 서식은 지원하지 않는다.
const FORMAT_PATTERN = /\*\*(.+?)\*\*|~~(.+?)~~|_(.+?)_/g;

export function parseInlineFormatting(input: string): FormattedSegment[] {
  const segments: FormattedSegment[] = [];
  let lastIndex = 0;
  for (const match of input.matchAll(FORMAT_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ text: input.slice(lastIndex, index) });
    }
    if (match[1] !== undefined) segments.push({ text: match[1], bold: true });
    else if (match[2] !== undefined) segments.push({ text: match[2], strike: true });
    else if (match[3] !== undefined) segments.push({ text: match[3], italic: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ text: input }];
}

// 알림/잠금화면처럼 서식 마크업을 해석하지 못하는 곳에 넘길 평문.
export function stripFormatting(input: string): string {
  return input
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/_(.+?)_/g, '$1');
}

export function checklistSummary(items: ChecklistItem[]): string {
  return items.map((item) => `${item.done ? '☑' : '☐'} ${item.text}`).join('\n');
}

export interface TextBlock {
  level: 0 | 1 | 2 | 3;
  segments: FormattedSegment[];
}

const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/;

// 줄 단위로 # / ## / ### 제목 표시를 인식해 블록으로 나눈다. 전체(펼침) 표시용.
export function parseBlocks(input: string): TextBlock[] {
  return input.split('\n').map((line) => {
    const match = line.match(HEADING_PATTERN);
    if (match) {
      return { level: match[1].length as 1 | 2 | 3, segments: parseInlineFormatting(match[2]) };
    }
    return { level: 0 as const, segments: parseInlineFormatting(line) };
  });
}

// 목록 미리보기처럼 한 줄로 눌러 담을 때 쓰는, 제목 기호만 제거한 평문.
export function stripHeadingMarkers(input: string): string {
  return input.replace(/^#{1,3}\s+/gm, '');
}

// 알림/잠금화면/캘린더처럼 카드를 한 줄로 요약해야 하는 곳에서 공용으로 쓰는 요약 텍스트.
export function memoSummaryText(memo: Pick<Memo, 'noteType' | 'text' | 'checklistItems'>): string {
  if (memo.noteType === 'checklist') {
    const summary = checklistSummary(memo.checklistItems ?? []);
    return summary.length > 0 ? summary : '체크리스트';
  }
  return memo.text.length > 0 ? stripFormatting(memo.text) : '이미지 메모';
}
