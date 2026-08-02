import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Memo, Todo } from '../types';
import { colors } from '../theme/colors';
import MemoBody from '../components/MemoBody';
import MemoImage from '../components/MemoImage';

type Page = { kind: 'todos' } | { kind: 'memo'; memo: Memo };

interface Props {
  visible: boolean;
  memos: Memo[];
  onComplete: (memo: Memo) => void;
  todos: Todo[];
  onCompleteTodo: (id: string) => void;
  onClose: () => void;
}

// 기억의 궁전: 지식창고에서 오늘 복습할 카드와 오늘 할 일(미완료)을 플래시카드처럼 한 장씩
// 보여준다. 할일이 있으면 첫 장이 할일 체크리스트 카드, 그다음이 복습 카드들이다.
// 스와이프로 카드를 넘기고, 복습 카드는 "기억완료"를 누르기 전까지 다음에 열 때도 계속 나타난다.
export default function MemoryPalaceScreen({
  visible,
  memos,
  onComplete,
  todos,
  onCompleteTodo,
  onClose,
}: Props) {
  const { width } = useWindowDimensions();
  // FlatList가 가로 페이지 셀에 자동으로 높이를 채워주지 않아(웹에서 특히),
  // 카드가 셀보다 길면 스크롤 없이 그냥 잘린다 — 덱 영역 실측 높이를 재서
  // 각 페이지의 ScrollView에 직접 넘겨준다.
  const [deckHeight, setDeckHeight] = useState(0);
  // "다시보기"로 넘긴 카드의 id. 데이터는 그대로 두고 이번 세션 화면에서만 숨긴다 —
  // 궁전을 다시 열면(visible이 true가 될 때) 비워지므로 그때는 다시 나타난다.
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) setSkippedIds(new Set());
  }, [visible]);

  const visibleMemos = memos.filter((memo) => !skippedIds.has(memo.id));

  const pages: Page[] = [
    ...(todos.length > 0 ? [{ kind: 'todos' as const }] : []),
    ...visibleMemos.map((memo) => ({ kind: 'memo' as const, memo })),
  ];

  const skipCurrent = (id: string) => {
    setSkippedIds((prev) => new Set(prev).add(id));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>기억의 궁전</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.finishText}>마치기</Text>
          </Pressable>
        </View>

        {pages.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.subtext} />
            <Text style={styles.emptyText}>복습할 카드가 없어요</Text>
          </View>
        ) : (
          <>
            <FlatList
              style={styles.deck}
              onLayout={(e) => setDeckHeight(e.nativeEvent.layout.height)}
              data={pages}
              keyExtractor={(item) => (item.kind === 'todos' ? 'todos' : item.memo.id)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                if (item.kind === 'todos') {
                  return (
                    <ScrollView
                      style={{ width, height: deckHeight || undefined }}
                      contentContainerStyle={styles.cardWrap}
                      showsVerticalScrollIndicator={false}
                    >
                      <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <Text style={styles.todoCardTitle}>오늘 할 일</Text>
                        {todos.map((todo) => (
                          <Pressable
                            key={todo.id}
                            style={styles.todoRow}
                            onPress={() => onCompleteTodo(todo.id)}
                          >
                            <Ionicons name="square-outline" size={18} color={colors.subtext} />
                            <Text style={styles.todoRowText}>{todo.title}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  );
                }
                const memo = item.memo;
                return (
                  <ScrollView
                    style={{ width, height: deckHeight || undefined }}
                    contentContainerStyle={styles.cardWrap}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={[styles.card, { backgroundColor: memo.color || colors.card }]}>
                      {memo.imageUris && memo.imageUris.length > 0 && (
                        <MemoImage uris={memo.imageUris} maxHeight={280} />
                      )}
                      <MemoBody memo={memo} textStyle={styles.cardText} />
                      {memo.tags && memo.tags.length > 0 && (
                        <View style={styles.tagRow}>
                          {memo.tags.map((tag) => (
                            <View key={tag} style={styles.tagChip}>
                              <Text style={styles.tagChipText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      <View style={styles.cardActionRow}>
                        <Pressable style={styles.skipButton} onPress={() => skipCurrent(memo.id)}>
                          <Text style={styles.skipButtonText}>다시보기</Text>
                        </Pressable>
                        <Pressable style={styles.completeButton} onPress={() => onComplete(memo)}>
                          <Text style={styles.completeButtonText}>기억완료</Text>
                        </Pressable>
                      </View>
                    </View>
                  </ScrollView>
                );
              }}
            />
            {pages.length > 1 && (
              <Text style={styles.hint}>옆으로 넘겨서 다음 카드를 볼 수 있어요 ({pages.length}장 남음)</Text>
            )}
          </>
        )}
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
    paddingTop: 60,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  finishText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  deck: {
    flex: 1,
  },
  todoCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.subtext,
    marginBottom: 12,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  todoRowText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    color: colors.subtext,
    fontSize: 15,
  },
  cardWrap: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    minHeight: 320,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardText: {
    fontSize: 20,
    color: colors.text,
    lineHeight: 28,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  tagChip: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagChipText: {
    fontSize: 12,
    color: colors.subtext,
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
  },
  skipButton: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  skipButtonText: {
    color: colors.subtext,
    fontWeight: '600',
    fontSize: 15,
  },
  completeButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  hint: {
    textAlign: 'center',
    color: colors.subtext,
    fontSize: 12,
    paddingBottom: 24,
  },
});
