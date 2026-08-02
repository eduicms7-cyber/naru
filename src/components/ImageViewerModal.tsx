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

// 이미지 한 장을 보여주는 페이지. scale은 부모(ImageViewerModal)가 소유 — 핀치 제스처
// 자체는 FlatList 바깥을 감싸는 View에서 잡는다(이유는 아래 panResponder 주석 참고).
function ZoomableImagePage({
  uri,
  pageWidth,
  screenHeight,
  scale,
}: {
  uri: string;
  pageWidth: number;
  screenHeight: number;
  scale: number;
}) {
  const size = useImageSize(uri);
  const aspectRatio = size ? size.width / size.height : 3 / 4;
  const boxWidth = pageWidth;
  const boxHeight = Math.min(screenHeight * 0.8, boxWidth / aspectRatio);

  return (
    <View style={[styles.page, { width: pageWidth, height: screenHeight }]}>
      <View style={styles.imageArea}>
        <Image
          source={{ uri }}
          style={{ width: boxWidth, height: boxHeight, transform: [{ scale }] }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

// 전체화면 이미지 뷰어. 이미지가 여러 장이면 가로 스와이프로 다음/이전 장을 넘겨볼 수 있고,
// 두 손가락으로 핀치줌할 수 있다.
export default function ImageViewerModal({ visible, uris, initialIndex = 0, onClose }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // 모달을 다시 열 때마다 리스트를 새로 마운트해서 스크롤 위치를 초기화한다.
  const [mountKey, setMountKey] = useState(0);
  const safeInitialIndex = clamp(initialIndex, 0, Math.max(uris.length - 1, 0));
  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex);
  const [scale, setScale] = useState(1);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [touchCount, setTouchCount] = useState(0);
  const lastDistance = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      setMountKey((k) => k + 1);
      setCurrentIndex(safeInitialIndex);
      setScale(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // 핀치 제스처를 FlatList의 renderItem 안(자식)이 아니라 FlatList를 감싸는 이 View에
  // 붙인다 — 안드로이드 네이티브 가로 스크롤 뷰가 자식 쪽 PanResponder보다 먼저
  // 터치를 가로채 버려서(JS까지 아예 안 넘어옴), 자식에 아무리 onStartShouldSet를
  // 걸어도 호출조차 안 되는 문제가 있었다. 감싸는 쪽에서 잡으면 FlatList가 터치를
  // 가로채기 전에 이 레벨에서 먼저 responder가 될 수 있다.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
      onStartShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length === 2,
      onPanResponderGrant: () => {
        setScrollEnabled(false);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        setTouchCount(touches.length);
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
        setScrollEnabled(true);
      },
      onPanResponderTerminate: () => {
        lastDistance.current = null;
        setScrollEnabled(true);
      },
    })
  ).current;

  if (!visible || uris.length === 0) return null;

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setCurrentIndex(clamp(index, 0, uris.length - 1));
    setScale(1);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay} {...panResponder.panHandlers}>
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>

        {uris.length > 1 && (
          <Text style={styles.counter}>
            {currentIndex + 1} / {uris.length}
          </Text>
        )}

        {/* 임시 디버그 표시 — 핀치줌 원인 확인용, 확인되면 뺄 것 */}
        <Text style={styles.debugText}>
          touches: {touchCount} / scale: {scale.toFixed(2)}
        </Text>

        <FlatList
          key={mountKey}
          style={styles.list}
          data={uris}
          keyExtractor={(uri, index) => `${uri}-${index}`}
          horizontal
          pagingEnabled
          scrollEnabled={scrollEnabled}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={safeInitialIndex}
          getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          renderItem={({ item, index }) => (
            <ZoomableImagePage
              uri={item}
              pageWidth={screenWidth}
              screenHeight={screenHeight}
              scale={index === currentIndex ? scale : 1}
            />
          )}
        />

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
  debugText: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    zIndex: 1,
    color: '#FFD54F',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
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
