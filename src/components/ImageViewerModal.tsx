import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useImageSize } from '../utils/useImageSize';

interface Props {
  visible: boolean;
  uris: string[];
  initialIndex?: number;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// 이미지 한 장을 보여주는 페이지. 새 제스처 라이브러리 없이 두 손가락 사이 거리 변화로
// 핀치줌을 직접 계산한다(모바일). PC에서는 마우스로 두 손가락 제스처를 만들 수 없으니
// +/- 버튼으로 같은 scale 값을 조절한다.
function ZoomableImagePage({
  uri,
  pageWidth,
  screenHeight,
}: {
  uri: string;
  pageWidth: number;
  screenHeight: number;
}) {
  const size = useImageSize(uri);
  const [scale, setScale] = useState(1);
  const lastDistance = useRef<number | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length !== 2) return;
        const dx = touches[0].pageX - touches[1].pageX;
        const dy = touches[0].pageY - touches[1].pageY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (lastDistance.current != null) {
          const delta = distance / lastDistance.current;
          setScale((s) => clamp(s * delta, MIN_SCALE, MAX_SCALE));
        }
        lastDistance.current = distance;
      },
      onPanResponderRelease: () => {
        lastDistance.current = null;
      },
      onPanResponderTerminate: () => {
        lastDistance.current = null;
      },
    })
  ).current;

  const aspectRatio = size ? size.width / size.height : 3 / 4;
  const boxWidth = pageWidth;
  const boxHeight = Math.min(screenHeight * 0.8, boxWidth / aspectRatio);

  return (
    <View style={[styles.page, { width: pageWidth, height: screenHeight }]}>
      <View style={styles.imageArea} {...panResponder.panHandlers}>
        <Image
          source={{ uri }}
          style={{ width: boxWidth, height: boxHeight, transform: [{ scale }] }}
          resizeMode="contain"
        />
      </View>

      {Platform.OS === 'web' && (
        <View style={styles.zoomControls}>
          <Pressable
            style={styles.zoomButton}
            onPress={() => setScale((s) => clamp(s - SCALE_STEP, MIN_SCALE, MAX_SCALE))}
          >
            <Text style={styles.zoomButtonText}>−</Text>
          </Pressable>
          <Text style={styles.zoomLabel}>{Math.round(scale * 100)}%</Text>
          <Pressable
            style={styles.zoomButton}
            onPress={() => setScale((s) => clamp(s + SCALE_STEP, MIN_SCALE, MAX_SCALE))}
          >
            <Text style={styles.zoomButtonText}>+</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// 전체화면 이미지 뷰어. 이미지가 여러 장이면 가로 스와이프로 다음/이전 장을 넘겨볼 수 있고,
// 각 장은 독립적으로 핀치줌 상태를 갖는다.
export default function ImageViewerModal({ visible, uris, initialIndex = 0, onClose }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // 모달을 다시 열 때마다 리스트를 새로 마운트해서 확대 상태/스크롤 위치를 초기화한다.
  const [mountKey, setMountKey] = useState(0);
  const safeInitialIndex = clamp(initialIndex, 0, Math.max(uris.length - 1, 0));
  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex);

  useEffect(() => {
    if (visible) {
      setMountKey((k) => k + 1);
      setCurrentIndex(safeInitialIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible || uris.length === 0) return null;

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setCurrentIndex(clamp(index, 0, uris.length - 1));
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>

        {uris.length > 1 && (
          <Text style={styles.counter}>
            {currentIndex + 1} / {uris.length}
          </Text>
        )}

        <FlatList
          key={mountKey}
          style={styles.list}
          data={uris}
          keyExtractor={(uri, index) => `${uri}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={safeInitialIndex}
          getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          renderItem={({ item }) => (
            <ZoomableImagePage uri={item} pageWidth={screenWidth} screenHeight={screenHeight} />
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 6,
  },
  counter: {
    position: 'absolute',
    top: 56,
    left: 20,
    zIndex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    flex: 1,
    width: '100%',
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomControls: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  zoomLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    minWidth: 44,
    textAlign: 'center',
  },
});
