import { useWindowDimensions } from 'react-native';

// PC(넓은 화면)에서만 좌측 사이드바 내비게이션 + 콘텐츠 최대폭 제한을 적용하는 기준값.
// TabNavigator(사이드바 전환)와 ResponsiveScreenContainer(콘텐츠 폭 제한)가 같은 기준을
// 공유해야 두 전환 시점이 어긋나지 않는다.
export const WIDE_BREAKPOINT = 900;

// SidebarTabBar의 고정 폭. 그리드 열 개수 계산(콘텐츠 실제 가용폭 = 창 폭 - 이 값)에도
// 같이 쓰이므로 사이드바 스타일과 별개로 여기서 공유한다.
export const SIDEBAR_WIDTH = 260;

export function useIsWideLayout(): boolean {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT;
}
