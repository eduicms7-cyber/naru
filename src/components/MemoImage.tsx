import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useImageSize } from '../utils/useImageSize';
import ImageViewerModal from './ImageViewerModal';

interface Props {
  uris: string[];
  maxHeight?: number;
  style?: StyleProp<ViewStyle>;
}

// 지식창고 카드/작성화면/기억의 궁전이 함께 쓰는 이미지 표시. 한 장이면 잘리지 않게 원본
// 비율대로 세로 크기를 맞추고(최대 maxHeight), 여러 장이면 가로 스크롤 썸네일로 보여준다.
// 탭하면 ImageViewerModal이 열리고, 여러 장이면 스와이프로 다른 장을 넘겨볼 수 있다.
export default function MemoImage({ uris, maxHeight = 260, style }: Props) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (!uris || uris.length === 0) return null;

  return (
    <>
      {uris.length === 1 ? (
        <SingleImage uri={uris[0]} maxHeight={maxHeight} style={style} onPress={() => setViewerIndex(0)} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.thumbRow, style]}
          contentContainerStyle={styles.thumbRowContent}
        >
          {uris.map((uri, index) => (
            <Pressable key={`${uri}-${index}`} onPress={() => setViewerIndex(index)}>
              <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>
      )}
      <ImageViewerModal
        visible={viewerIndex !== null}
        uris={uris}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
}

function SingleImage({
  uri,
  maxHeight,
  style,
  onPress,
}: {
  uri: string;
  maxHeight: number;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  const size = useImageSize(uri);
  const aspectRatio = size ? size.width / size.height : 4 / 3;

  return (
    <Pressable onPress={onPress}>
      <View style={[styles.wrap, { aspectRatio, maxHeight }, style]}>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      </View>
    </Pressable>
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
  thumbRow: {
    marginBottom: 10,
  },
  thumbRowContent: {
    gap: 8,
  },
  thumb: {
    width: 120,
    height: 120,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
});
