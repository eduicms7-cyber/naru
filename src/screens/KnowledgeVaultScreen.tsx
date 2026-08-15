import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NavigationProp, RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createItem, deleteItem, loadItems, updateItem } from '../storage/storage';
import { ChecklistItem, Memo, STORAGE_KEYS, Todo } from '../types';
import { colors, cardColors } from '../theme/colors';
import { isDueForReview, markRemembered, newMemoReviewFields } from '../memory/spacedRepetition';
import {
  clearReview,
  ensureFullScreenIntentPermission,
  getPendingCompletions,
  requestReviewPermission,
  setDueMemos,
  setTodos,
  showReview,
  startWakeMonitor,
} from '../native/ReviewWidget';
import { memoSummaryText } from '../utils/richText';
import { parseTags } from '../utils/tags';
import { formatShortDate } from '../utils/date';
import MemoBody from '../components/MemoBody';
import MemoImage from '../components/MemoImage';
import NoteContentEditor from '../components/NoteContentEditor';
import { showAlert } from '../utils/alert';
import MemoryPalaceScreen from './MemoryPalaceScreen';
import ResponsiveScreenContainer from '../components/ResponsiveScreenContainer';
import { useIsWideLayout } from '../utils/layout';
import type { TabParamList } from '../navigation/TabNavigator';

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

export default function KnowledgeVaultScreen() {
  const isWide = useIsWideLayout();
  const numColumns = isWide ? 2 : 1;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<TabParamList>>();
  const route = useRoute<RouteProp<TabParamList, '지식창고'>>();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [color, setColor] = useState<string | undefined>(undefined);
  const [tagsInput, setTagsInput] = useState('');
  const [noteType, setNoteType] = useState<'text' | 'checklist'>('text');
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [now, setNow] = useState(Date.now());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [palaceOpen, setPalaceOpen] = useState(false);
  // 표시용이 아니라 기억의 궁전(잠금화면/앱 내)에 오늘 할 일을 전달하고 완료 체크를 반영하기 위한 값.
  const [todayTodos, setTodayTodos] = useState<Todo[]>([]);

  const dueMemos = useMemo(
    () => memos.filter((m) => isDueForReview(m, now)),
    [memos, now]
  );

  const sortedMemos = useMemo(
    () => [...memos].sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned)),
    [memos]
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    memos.forEach((m) => m.tags?.forEach((tag) => set.add(tag)));
    return Array.from(set);
  }, [memos]);

  const visibleMemos = useMemo(
    () =>
      selectedTag ? sortedMemos.filter((m) => m.tags?.includes(selectedTag)) : sortedMemos,
    [sortedMemos, selectedTag]
  );

  useEffect(() => {
    requestReviewPermission();
    startWakeMonitor();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      (async () => {
        const items = await loadItems<Memo>(STORAGE_KEYS.MEMOS);
        // 잠금화면 "기억의 궁전"에서 기억완료 처리된 카드가 있으면 여기서 따라잡는다.
        const pendingIds = await getPendingCompletions();
        if (pendingIds.length > 0) {
          const completedAt = Date.now();
          const updated = items.map((m) =>
            pendingIds.includes(m.id) ? markRemembered(m, completedAt) : m
          );
          setMemos(updated);
          updated
            .filter((m) => pendingIds.includes(m.id))
            .forEach((m) => updateItem(STORAGE_KEYS.MEMOS, m));
        } else {
          setMemos(items);
        }
        setLoaded(true);
      })();
      // 표시용이 아니라 기억의 궁전에 오늘 할 일을 전달하기 위한 로드 (완료 반영 자체는 TodayScreen이 담당).
      (async () => {
        const items = await loadItems<Todo>(STORAGE_KEYS.TODOS);
        setTodayTodos(items);
      })();
    }, [])
  );

  const incompleteTodos = useMemo(() => todayTodos.filter((t) => !t.done), [todayTodos]);

  useEffect(() => {
    const dueForNative = dueMemos.map((m) => ({
      id: m.id,
      text: memoSummaryText(m),
      color: m.color,
      imageUris: m.imageUris,
    }));
    setDueMemos(dueForNative);
    if (dueMemos.length === 0) {
      clearReview();
    } else {
      showReview(`오늘 복습할 카드 (${dueMemos.length})`, memoSummaryText(dueMemos[0]));
    }
  }, [dueMemos]);

  useEffect(() => {
    setTodos(incompleteTodos.map((t) => ({ id: t.id, title: t.title })));
  }, [incompleteTodos]);

  const askedFullScreenPermission = useRef(false);
  useEffect(() => {
    if ((dueMemos.length > 0 || incompleteTodos.length > 0) && !askedFullScreenPermission.current) {
      askedFullScreenPermission.current = true;
      ensureFullScreenIntentPermission();
    }
  }, [dueMemos, incompleteTodos]);

  const completeTodoFromPalace = (id: string) => {
    const updated = todayTodos.map((t) =>
      t.id === id ? { ...t, done: true, completedAt: Date.now() } : t
    );
    setTodayTodos(updated);
    const changed = updated.find((t) => t.id === id);
    if (changed) updateItem(STORAGE_KEYS.TODOS, changed);
  };

  const openComposer = () => {
    setEditingId(null);
    setText('');
    setImageUris([]);
    setColor(undefined);
    setTagsInput('');
    setNoteType('text');
    setChecklistItems([]);
    setComposerOpen(true);
  };

  const openEditor = (item: Memo) => {
    setEditingId(item.id);
    setText(item.text);
    setImageUris(item.imageUris ?? []);
    setColor(item.color);
    setTagsInput((item.tags ?? []).join(', '));
    setNoteType(item.noteType === 'checklist' ? 'checklist' : 'text');
    setChecklistItems(item.checklistItems ?? []);
    setComposerOpen(true);
  };

  // 캘린더에서 특정 카드를 탭해 들어온 경우, 그 카드의 수정화면을 바로 연다.
  useEffect(() => {
    const focusId = route.params?.focusMemoId;
    if (!focusId) return;
    const memo = memos.find((m) => m.id === focusId);
    if (memo) {
      openEditor(memo);
      navigation.setParams({ focusMemoId: undefined });
    }
  }, [route.params?.focusMemoId, memos]);

  const saveMemo = () => {
    const trimmed = text.trim();
    const trimmedItems = checklistItems
      .map((item) => ({ ...item, text: item.text.trim() }))
      .filter((item) => item.text.length > 0);
    const hasContent =
      noteType === 'checklist'
        ? trimmedItems.length > 0 || imageUris.length > 0 || !!trimmed
        : !!trimmed || imageUris.length > 0;
    if (!hasContent) return;
    const tags = parseTags(tagsInput);
    const shared = {
      text: trimmed,
      imageUris: imageUris.length > 0 ? imageUris : undefined,
      color,
      tags,
      noteType,
      checklistItems: noteType === 'checklist' ? trimmedItems : [],
    };
    if (editingId) {
      const updated = memos.map((m) => (m.id === editingId ? { ...m, ...shared } : m));
      setMemos(updated);
      const changed = updated.find((m) => m.id === editingId);
      if (changed) updateItem(STORAGE_KEYS.MEMOS, changed);
    } else {
      const createdAt = Date.now();
      const newMemo: Memo = {
        id: createdAt.toString(),
        ...shared,
        createdAt,
        ...newMemoReviewFields(createdAt),
      };
      setMemos([newMemo, ...memos]);
      createItem(STORAGE_KEYS.MEMOS, newMemo);
    }
    setComposerOpen(false);
  };

  const toggleChecklistItem = (memoId: string, itemId: string) => {
    const updated = memos.map((m) =>
      m.id === memoId
        ? {
            ...m,
            checklistItems: (m.checklistItems ?? []).map((item) =>
              item.id === itemId ? { ...item, done: !item.done } : item
            ),
          }
        : m
    );
    setMemos(updated);
    const changed = updated.find((m) => m.id === memoId);
    if (changed) updateItem(STORAGE_KEYS.MEMOS, changed);
  };

  const addTagToInput = (tag: string) => {
    const current = parseTags(tagsInput);
    if (current.includes(tag)) return;
    setTagsInput(current.concat(tag).join(', '));
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const togglePinned = (id: string) => {
    const updated = memos.map((m) => {
      if (m.id !== id) return m;
      const isPinned = !m.isPinned;
      // 고정을 켜면 그 카드를 바로 오늘 복습 대상(기억의 궁전)으로 당긴다.
      return isPinned
        ? { ...m, isPinned, reviewStage: 0, nextReviewAt: Date.now() }
        : { ...m, isPinned };
    });
    setMemos(updated);
    const changed = updated.find((m) => m.id === id);
    if (changed) updateItem(STORAGE_KEYS.MEMOS, changed);
    // dueMemos는 포커스 시에만 갱신되는 `now` state 기준이라, 여기서도 갱신해줘야
    // 방금 고정한 카드가 바로 due로 반영된다.
    setNow(Date.now());
  };

  const deleteMemo = (id: string) => {
    showAlert('삭제', '이 카드를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          setMemos(memos.filter((m) => m.id !== id));
          deleteItem(STORAGE_KEYS.MEMOS, id);
        },
      },
    ]);
  };

  const handlePalaceComplete = (memo: Memo) => {
    const updated = markRemembered(memo, Date.now());
    setMemos(memos.map((m) => (m.id === updated.id ? updated : m)));
    updateItem(STORAGE_KEYS.MEMOS, updated);
    setNow(Date.now());
  };

  if (!loaded) return <View style={styles.container} />;

  return (
    <ResponsiveScreenContainer>
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>지식창고</Text>
        <Pressable style={styles.palaceButton} onPress={() => setPalaceOpen(true)}>
          <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
          <Text style={styles.palaceButtonText}>기억의 궁전</Text>
        </Pressable>
      </View>

      {dueMemos.length > 0 && (
        <Pressable style={styles.reviewBanner} onPress={() => setPalaceOpen(true)}>
          <Ionicons name="sparkles" size={18} color={colors.primary} />
          <Text style={styles.reviewBannerText}>오늘 복습할 카드 {dueMemos.length}장 보기</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
        </Pressable>
      )}

      {allTags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagFilterRow}
          contentContainerStyle={styles.tagFilterContent}
        >
          <Pressable
            style={[styles.tagFilterChip, !selectedTag && styles.tagFilterChipActive]}
            onPress={() => setSelectedTag(null)}
          >
            <Text style={[styles.tagFilterChipText, !selectedTag && styles.tagFilterChipTextActive]}>
              전체
            </Text>
          </Pressable>
          {allTags.map((tag) => (
            <Pressable
              key={tag}
              style={[styles.tagFilterChip, selectedTag === tag && styles.tagFilterChipActive]}
              onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
            >
              <Text
                style={[
                  styles.tagFilterChipText,
                  selectedTag === tag && styles.tagFilterChipTextActive,
                ]}
              >
                {tag}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={visibleMemos}
        key={numColumns}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>아직 쌓인 지식이 없어요</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isExpanded = expandedIds.has(item.id);
          return (
            <Pressable
              style={[
                styles.memoCard,
                numColumns > 1 && styles.memoCardGrid,
                item.color ? { backgroundColor: item.color } : null,
              ]}
              onPress={() => toggleExpanded(item.id)}
            >
              {item.imageUris && item.imageUris.length > 0 && (
                <MemoImage uris={item.imageUris} maxHeight={260} />
              )}
              <MemoBody
                memo={item}
                onToggleItem={(itemId) => toggleChecklistItem(item.id, itemId)}
                numberOfLines={item.noteType === 'checklist' ? undefined : isExpanded ? undefined : 3}
              />
              {item.tags && item.tags.length > 0 && (
                <View style={styles.cardTagRow}>
                  {item.tags.map((tag) => (
                    <View key={tag} style={styles.cardTagChip}>
                      <Text style={styles.cardTagChipText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.memoFooter}>
                <Text style={styles.memoDate}>{formatDate(item.createdAt)}</Text>
                <View style={styles.memoFooterRight}>
                  <Text style={styles.memoNextReview}>
                    다음 복습 {formatShortDate(item.nextReviewAt)}
                  </Text>
                  <Pressable onPress={() => togglePinned(item.id)} hitSlop={8}>
                    <Ionicons
                      name={item.isPinned ? 'star' : 'star-outline'}
                      size={18}
                      color={item.isPinned ? colors.star : colors.subtext}
                    />
                  </Pressable>
                  <Pressable onPress={() => openEditor(item)} hitSlop={8}>
                    <Ionicons name="pencil-outline" size={18} color={colors.subtext} />
                  </Pressable>
                  <Pressable onPress={() => deleteMemo(item.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.subtext} />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={openComposer}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <Modal visible={composerOpen} animationType="slide" onRequestClose={() => setComposerOpen(false)}>
        <KeyboardAvoidingView
          style={styles.composer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.composerHeader}>
            <Pressable onPress={() => setComposerOpen(false)}>
              <Text style={styles.composerCancel}>취소</Text>
            </Pressable>
            <Text style={styles.composerTitle}>{editingId ? '카드 수정' : '새 카드'}</Text>
            <Pressable onPress={saveMemo}>
              <Text style={styles.composerSave}>저장</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.composerScroll}
            contentContainerStyle={styles.composerScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <NoteContentEditor
              noteType={noteType}
              onNoteTypeChange={setNoteType}
              text={text}
              onTextChange={setText}
              checklistItems={checklistItems}
              onChecklistItemsChange={setChecklistItems}
              imageUris={imageUris}
              onImageUrisChange={setImageUris}
              active={composerOpen}
            />

            <Text style={styles.composerSectionLabel}>색상</Text>
            <View style={styles.colorRow}>
              {cardColors.map((c) => (
                <Pressable
                  key={c}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    color === c && styles.colorSwatchSelected,
                    color === undefined && c === cardColors[0] && styles.colorSwatchSelected,
                  ]}
                  onPress={() => setColor(c === cardColors[0] ? undefined : c)}
                />
              ))}
            </View>

            <Text style={styles.composerSectionLabel}>카테고리(태그)</Text>
            <TextInput
              style={styles.tagInput}
              placeholder="쉼표로 구분해서 입력 (예: 영어, 자격증)"
              placeholderTextColor={colors.subtext}
              value={tagsInput}
              onChangeText={setTagsInput}
            />
            {allTags.length > 0 && (
              <View style={styles.tagSuggestionRow}>
                {allTags.map((tag) => (
                  <Pressable key={tag} style={styles.tagSuggestionChip} onPress={() => addTagToInput(tag)}>
                    <Text style={styles.tagSuggestionChipText}>{tag}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <MemoryPalaceScreen
        visible={palaceOpen}
        memos={dueMemos}
        onComplete={handlePalaceComplete}
        todos={incompleteTodos}
        onCompleteTodo={completeTodoFromPalace}
        onClose={() => setPalaceOpen(false)}
      />
    </View>
    </ResponsiveScreenContainer>
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
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  palaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAF1FF',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  palaceButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
    flexGrow: 1,
  },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: '#EAF1FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  reviewBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  tagFilterRow: {
    maxHeight: 40,
    marginBottom: 8,
  },
  tagFilterContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tagFilterChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  tagFilterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagFilterChipText: {
    fontSize: 13,
    color: colors.subtext,
  },
  tagFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  memoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  memoCardGrid: {
    width: '48%',
  },
  memoText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
  },
  cardTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  cardTagChip: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardTagChipText: {
    fontSize: 11,
    color: colors.subtext,
  },
  memoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  memoDate: {
    fontSize: 12,
    color: colors.subtext,
  },
  memoFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memoNextReview: {
    fontSize: 12,
    color: colors.primary,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  composer: {
    flex: 1,
    backgroundColor: colors.card,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  composerCancel: {
    fontSize: 16,
    color: colors.subtext,
  },
  composerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  composerSave: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  composerScroll: {
    flex: 1,
  },
  composerScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  composerSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.subtext,
    marginTop: 8,
    marginBottom: 8,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorSwatchSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  tagInput: {
    fontSize: 14,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  tagSuggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  tagSuggestionChip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  tagSuggestionChipText: {
    fontSize: 12,
    color: colors.subtext,
  },
});
