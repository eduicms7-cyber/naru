import React, { useState } from 'react';
import { Image, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useImageSize } from '../utils/useImageSize';
import ImageViewerModal from './ImageViewerModal';

interface Props {
  uri: string;
  maxHeight?: number;
  style?: StyleProp<ViewStyle>;
}

// 지식창고 카드/작성화면/기억의 궁전이 함께 쓰는 이미지 표시. 잘리지 않게 원본 비율대로
// 세로 크기를 맞추고(최대 maxHeight), 탭하면 전체화면으로 확대해서 볼 수 있다.
export default function MemoImage({ uri, maxHeight = 260, style }: Props) {
  const size = useImageSize(uri);
  const [viewerOpen, setViewerOpen] = useState(false);
  const aspectRatio = size ? size.width / size.height : 4 / 3;

  return (
    <>
      <Pressable onPress={() => setViewerOpen(true)}>
        <View style={[styles.wrap, { aspectRatio, maxHeight }, style]}>
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        </View>
      </Pressable>
      <ImageViewerModal visible={viewerOpen} uri={uri} onClose={() => setViewerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
