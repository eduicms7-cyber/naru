import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// 구글 파비콘 서비스 — 별도 백엔드 없이 도메인만으로 아이콘을 받아올 수 있고,
// <Image>로 표시하는 것뿐이라 웹에서도 CORS 문제 없이 동작한다.
function getFaviconUrl(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return null;
  }
}

export default function FavoriteIcon({ url, size = 28 }: { url: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const faviconUrl = failed ? null : getFaviconUrl(url);
  const dimensionStyle = { width: size, height: size, borderRadius: size > 20 ? 6 : 4 };

  if (!faviconUrl) {
    return (
      <View style={[styles.faviconFallback, dimensionStyle]}>
        <Ionicons name="link-outline" size={Math.round(size * 0.57)} color={colors.subtext} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: faviconUrl }}
      style={dimensionStyle}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  faviconFallback: {
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
