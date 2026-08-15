import { useWindowDimensions } from 'react-native';

// PC(넓은 화면)에서만 좌측 사이드바 내비게이션 + 콘텐츠 최대폭 제한을 적용하는 기준값.
// TabNavigator(사이드바 전환)와 ResponsiveScreenContainer(콘텐츠 폭 제한)가 같은 기준을
// 공유해야 두 전환 시점이 어긋나지 않는다.
export const WIDE_BREAKPOINT = 900;

export function useIsWideLayout(): boolean {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT;
}
