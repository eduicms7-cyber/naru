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
  onPinchStart,
  onPinchEnd,
}: {
  uri: string;
  pageWidth: number;
  screenHeight: number;
  onPinchStart?: () => void;
  onPinchEnd?: () => void;
}) {
  const size = useImageSize(uri);
  const [scale, setScale] = useState(1);
  const [touchCount, setTouchCount] = useState(0);
  const lastDistance = useRef<number | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      // 이미지가 여러 장이면 이 페이지가 가로 스와이프용 FlatList 안에 들어있어서,
      // 손가락 두 개를 뗐다 붙였다 하는 핀치 제스처를 FlatList의 가로 스크롤 제스처가
      // 먼저 가로채 버리는 경우가 있었다. onStartShouldSet(Capture)를 둘 다 써서
      // 두 번째 손가락이 닿는 즉시(움직이기 전에) 이 PanResponder가 선점하도록 한다.
      onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
      onStartShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length === 2,
      // 이 손가락 두 개 제스처가 진행되는 동안은 바깥 FlatList의 가로 스크롤도
      // 아예 꺼버려서, 혹시 responder를 뺏기더라도 애초에 경쟁할 대상이 없게 한다.
      onPanResponderGrant: () => {
        onPinchStart?.();
      },
      // 기본값은 "누가 달라고 하면 넘겨준다"라, responder를 잡은 뒤에도 바깥
      // FlatList가 다시 뺏어갈 수 있었다 — 핀치 도중엔 절대 안 넘겨주도록 거절.
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
        onPinchEnd?.();
      },
      onPanResponderTerminate: () => {
        lastDistance.current = null;
        onPinchEnd?.();
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

      {/* 임시 디버그 표시 — 핀치줌 원인 확인용, 확인되면 뺄 것 */}
      <Text style={styles.debugText}>
        touches: {touchCount} / scale: {scale.toFixed(2)}
      </Text>

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
  const [pinching, setPinching] = useState(false);

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
          scrollEnabled={!pinching}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={safeInitialIndex}
          getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          renderItem={({ item }) => (
            <ZoomableImagePage
              uri={item}
              pageWidth={screenWidth}
              screenHeight={screenHeight}
              onPinchStart={() => setPinching(true)}
              onPinchEnd={() => setPinching(false)}
            />
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
  debugText: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
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
