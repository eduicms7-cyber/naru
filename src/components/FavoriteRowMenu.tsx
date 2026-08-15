import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// 사이드바(PC) 즐겨찾기 항목 전용 "⋯" 액션시트. 모바일 즐겨찾기 화면은
// 기존 화살표/펜/휴지통 아이콘을 그대로 쓰므로 이 컴포넌트를 쓰지 않는다.
interface FavoriteRowMenuProps {
  visible: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onClose: () => void;
}

export default function FavoriteRowMenu({
  visible,
  canMoveUp,
  canMoveDown,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onClose,
}: FavoriteRowMenuProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Pressable style={styles.item} onPress={onMoveUp} disabled={!canMoveUp}>
            <Ionicons name="chevron-up" size={18} color={canMoveUp ? colors.text : colors.border} />
            <Text style={[styles.itemText, !canMoveUp && styles.itemTextDisabled]}>위로</Text>
          </Pressable>
          <Pressable style={styles.item} onPress={onMoveDown} disabled={!canMoveDown}>
            <Ionicons
              name="chevron-down"
              size={18}
              color={canMoveDown ? colors.text : colors.border}
            />
            <Text style={[styles.itemText, !canMoveDown && styles.itemTextDisabled]}>아래로</Text>
          </Pressable>
          <Pressable style={styles.item} onPress={onEdit}>
            <Ionicons name="pencil-outline" size={18} color={colors.text} />
            <Text style={styles.itemText}>수정</Text>
          </Pressable>
          <Pressable style={styles.item} onPress={onDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={[styles.itemText, styles.deleteText]}>삭제</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: 200,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  itemText: {
    fontSize: 15,
    color: colors.text,
  },
  itemTextDisabled: {
    color: colors.border,
  },
  deleteText: {
    color: colors.danger,
  },
});
