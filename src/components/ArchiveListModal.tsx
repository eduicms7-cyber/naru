import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface Props<T extends { id: string }> {
  visible: boolean;
  title: string;
  emptyText: string;
  items: T[];
  onClose: () => void;
  // 항목 하나의 본문(제목/날짜/태그 등)만 그리며, 보관 해제/삭제 버튼은 이 컴포넌트가 공통으로 붙인다.
  renderItem: (item: T) => React.ReactNode;
  onUnarchive: (item: T) => void;
  onDelete: (item: T) => void;
}

// 오늘/지식창고 두 화면이 공유하는 보관함 모달 UI. 화면별 항목 렌더링만 renderItem으로 주입받고,
// 보관 해제/삭제 버튼과 레이아웃은 여기서 공통으로 처리한다.
export default function ArchiveListModal<T extends { id: string }>({
  visible,
  title,
  emptyText,
  items,
  onClose,
  renderItem,
  onUnarchive,
  onDelete,
}: Props<T>) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </View>
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowBody}>{renderItem(item)}</View>
              <View style={styles.rowActions}>
                <Pressable onPress={() => onUnarchive(item)} hitSlop={8} style={styles.actionButton}>
                  <Ionicons name="arrow-undo-outline" size={18} color={colors.primary} />
                  <Text style={styles.actionButtonText}>보관 해제</Text>
                </Pressable>
                <Pressable onPress={() => onDelete(item)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color={colors.subtext} />
                </Pressable>
              </View>
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  closeText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    color: colors.subtext,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  rowBody: {
    flex: 1,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
