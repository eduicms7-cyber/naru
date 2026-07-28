import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
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
  uri?: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// 새 제스처 라이브러리 없이 두 손가락 사이 거리 변화로 핀치줌을 직접 계산한다(모바일).
// PC에서는 마우스로 두 손가락 제스처를 만들 수 없으니 +/- 버튼으로 같은 scale 값을 조절한다.
export default function ImageViewerModal({ visible, uri, onClose }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const size = useImageSize(uri);
  const [scale, setScale] = useState(1);
  const lastDistance = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      setScale(1);
      lastDistance.current = null;
    }
  }, [visible, uri]);

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

  if (!uri) return null;

  const aspectRatio = size ? size.width / size.height : 3 / 4;
  const boxWidth = screenWidth;
  const boxHeight = Math.min(screenHeight * 0.8, boxWidth / aspectRatio);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>

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
