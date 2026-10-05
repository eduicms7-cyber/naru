import { ChecklistItem, Memo } from '../types';

export interface FormattedSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  url?: string;
}

// 굵게 **텍스트**, 취소선 ~~텍스트~~, 기울임 _텍스트_ — 중첩 서식은 지원하지 않는다.
const FORMAT_PATTERN = /\*\*(.+?)\*\*|~~(.+?)~~|_(.+?)_/g;

const URL_PATTERN = /https?:\/\/[^\s]+/g;
// URL 뒤에 붙는 문장부호(마침표, 쉼표, 괄호 닫기 등)는 링크에서 제외하고 일반 텍스트로 남긴다.
const URL_TRAILING_PUNCTUATION = /[)\].,!?;:'"]+$/;

// 서식이 적용된 한 조각의 텍스트 안에서 URL만 골라 별도 세그먼트로 쪼갠다(서식은 유지).
function splitUrls(
  text: string,
  base: Pick<FormattedSegment, 'bold' | 'italic' | 'strike'>
): FormattedSegment[] {
  const parts: FormattedSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ ...base, text: text.slice(lastIndex, index) });
    }
    let url = match[0];
    const trailingMatch = url.match(URL_TRAILING_PUNCTUATION);
    const trailing = trailingMatch ? trailingMatch[0] : '';
    if (trailing) url = url.slice(0, url.length - trailing.length);
    parts.push({ ...base, text: url, url });
    if (trailing) parts.push({ ...base, text: trailing });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ ...base, text: text.slice(lastIndex) });
  }
  return parts;
}

export function parseInlineFormatting(input: string): FormattedSegment[] {
  const rawSegments: FormattedSegment[] = [];
  let lastIndex = 0;
  for (const match of input.matchAll(FORMAT_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      rawSegments.push({ text: input.slice(lastIndex, index) });
    }
    if (match[1] !== undefined) rawSegments.push({ text: match[1], bold: true });
    else if (match[2] !== undefined) rawSegments.push({ text: match[2], strike: true });
    else if (match[3] !== undefined) rawSegments.push({ text: match[3], italic: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < input.length) {
    rawSegments.push({ text: input.slice(lastIndex) });
  }

  const segments = rawSegments.flatMap((seg) =>
    splitUrls(seg.text, { bold: seg.bold, italic: seg.italic, strike: seg.strike })
  );
  return segments.length > 0 ? segments : [{ text: input }];
}

// 본문에 `---`(하이픈 3개 이상)만 있는 줄은 구분선. 라이트너 박스에서는 그 위를 질문,
// 아래를 답으로 쓰고, 다른 화면에서는 가로줄로 그린다.
const DIVIDER_LINE_PATTERN = /^\s*-{3,}\s*$/;
const DIVIDER_LINES_PATTERN = /^\s*-{3,}\s*$/gm;

export function isDividerLine(line: string): boolean {
  return DIVIDER_LINE_PATTERN.test(line);
}

// 첫 번째 구분선 기준으로 질문/답을 나눈다. 구분선이 없으면 null.
export function splitQuestionAnswer(input: string): { question: string; answer: string } | null {
  const lines = input.split('\n');
  const index = lines.findIndex(isDividerLine);
  if (index < 0) return null;
  return {
    question: lines.slice(0, index).join('\n').trim(),
    answer: lines.slice(index + 1).join('\n').trim(),
  };
}

// 알림/잠금화면처럼 서식 마크업을 해석하지 못하는 곳에 넘길 평문.
export function stripFormatting(input: string): string {
  return input
    .replace(DIVIDER_LINES_PATTERN, '')
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
  divider?: boolean;
}

const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/;

// 줄 단위로 # / ## / ### 제목 표시를 인식해 블록으로 나눈다. 전체(펼침) 표시용.
export function parseBlocks(input: string): TextBlock[] {
  return input.split('\n').map((line) => {
    if (isDividerLine(line)) return { level: 0 as const, segments: [], divider: true };
    const match = line.match(HEADING_PATTERN);
    if (match) {
      return { level: match[1].length as 1 | 2 | 3, segments: parseInlineFormatting(match[2]) };
    }
    return { level: 0 as const, segments: parseInlineFormatting(line) };
  });
}

// 목록 미리보기처럼 한 줄로 눌러 담을 때 쓰는, 제목 기호만 제거한 평문.
export function stripHeadingMarkers(input: string): string {
  return input.replace(/^#{1,3}\s+/gm, '').replace(DIVIDER_LINES_PATTERN, '');
}

// 알림/잠금화면/캘린더처럼 카드를 한 줄로 요약해야 하는 곳에서 공용으로 쓰는 요약 텍스트.
export function memoSummaryText(memo: Pick<Memo, 'noteType' | 'text' | 'checklistItems'>): string {
  if (memo.noteType === 'checklist') {
    const summary = checklistSummary(memo.checklistItems ?? []);
    return summary.length > 0 ? summary : '체크리스트';
  }
  return memo.text.length > 0 ? stripFormatting(memo.text) : '이미지 메모';
}
