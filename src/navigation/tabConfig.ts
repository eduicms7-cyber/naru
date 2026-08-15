import { Ionicons } from '@expo/vector-icons';

// TabNavigator(기본 탭바)와 SidebarTabBar(PC 사이드바)가 공유하는 라우트 타입/아이콘.
// 별도 파일로 분리해 TabNavigator <-> SidebarTabBar 간 require 순환 참조를 피한다.
export type TabParamList = {
  오늘: { focusTodoId?: string } | undefined;
  지식창고: { focusMemoId?: string } | undefined;
  캘린더: undefined;
  즐겨찾기: undefined;
};

export const ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  오늘: 'today-outline',
  지식창고: 'library-outline',
  캘린더: 'calendar-outline',
  즐겨찾기: 'star-outline',
};
