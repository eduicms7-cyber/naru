import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsWideLayout } from '../utils/layout';
import { colors } from '../theme/colors';

interface ResponsiveScreenContainerProps {
  children: React.ReactNode;
  // 오늘/캘린더처럼 한 줄로 읽는 목록은 680px로 가운데 정렬 제한(기본값)이 읽기 좋지만,
  // 지식창고처럼 그리드로 여러 카드를 늘어놓는 화면은 폭을 제한할 이유가 없어 'none'으로 끈다.
  maxWidth?: number | 'none';
}

// 좁은 화면(모바일)에서는 순수 패스스루라 기존 레이아웃에 영향이 없고,
// 넓은 화면(PC)에서만 콘텐츠를 가운데 정렬 + 최대폭으로 제한한다.
// 바깥 View가 전체 폭 배경을 채워서, 가운데 박스 양옆 여백이 내비게이션 기본
// 배경색(회색조가 미세하게 다름)이 아니라 앱 배경색으로 보이게 한다.
export default function ResponsiveScreenContainer({
  children,
  maxWidth = 680,
}: ResponsiveScreenContainerProps) {
  const isWide = useIsWideLayout();
  if (!isWide) return <>{children}</>;
  return (
    <View style={styles.outer}>
      <View style={[styles.wide, maxWidth !== 'none' && { maxWidth, alignSelf: 'center' }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  wide: {
    flex: 1,
    width: '100%',
  },
});
