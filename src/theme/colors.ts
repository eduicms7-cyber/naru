// Build-time flag for the login-free, phone-only variant — see CLAUDE.md.
// 클라우드/로컬 두 앱을 폰에 나란히 설치했을 때 화면만 보고도 구분할 수 있도록
// 포인트 컬러(primary)만 로컬 버전은 진한 녹색으로 바꾼다.
const IS_LOCAL_MODE = process.env.EXPO_PUBLIC_STORAGE_MODE === 'local';

export const colors = {
  background: '#F7F8FA',
  card: '#FFFFFF',
  primary: IS_LOCAL_MODE ? '#256D3B' : '#5B8DEF',
  text: '#1C1C1E',
  subtext: '#8E8E93',
  border: '#E5E5EA',
  danger: '#FF3B30',
  done: '#34C759',
  star: '#F5A623',
};

// 지식창고 카드 배경색 프리셋 (구글킵 스타일). 첫 번째 값은 "색상 없음"(기본 카드색) 취급.
export const cardColors = [
  '#FFFFFF',
  '#FFF4CE',
  '#FDE2E4',
  '#E2F0CB',
  '#D7E3FC',
  '#F1E3F3',
  '#FFE5D4',
  '#DCEEEE',
];

// 오늘 탭 할일 카드 배경 — 기한 임박도/완료 여부에 따라 아래 opacity를 곱해 rgba로 씀.
export const todoCardColors = {
  dueDate: '#FF8FA3', // 기한 있음: 핑크 계열, 기한이 가까울수록 진하게(1.0) ~ 멀수록 옅게
  noDueDate: '#4CAF50', // 기한 없음: 녹색, 50%
  done: '#4FC3F7', // 완료: 하늘색, 50%
};

export function withOpacity(hex: string, opacity: number): string {
  const clamped = Math.min(1, Math.max(0, opacity));
  const value = parseInt(hex.replace('#', ''), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}
