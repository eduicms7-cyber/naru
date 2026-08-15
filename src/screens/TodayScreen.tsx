import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ChecklistItem, STORAGE_KEYS, Todo } from '../types';
import { colors, todoCardColors, withOpacity } from '../theme/colors';
import { useAuth } from '../auth/AuthContext';
import { parseTags } from '../utils/tags';
import { formatDateKeyShort, formatShortDate, getMonthMatrix, toDateKey, WEEKDAY_LABELS } from '../utils/date';
import { getPendingTodoCompletions } from '../native/ReviewWidget';
import MemoBody from '../components/MemoBody';
import MemoImage from '../components/MemoImage';
import NoteContentEditor from '../components/NoteContentEditor';
import ResponsiveScreenContainer from '../components/ResponsiveScreenContainer';
import type { TabParamList } from '../navigation/TabNavigator';
import appJson from '../../app.json';

function hasTodoDetail(todo: Todo): boolean {
  return (
    !!todo.detailText?.trim() ||
    (todo.detailChecklistItems?.length ?? 0) > 0 ||
    (todo.detailImageUris?.length ?? 0) > 0
  );
}

function daysUntilDue(dueDate: string, todayKey: string): number {
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date(`${todayKey}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// 완료: 하늘색 30%. 기한 없음: 녹색 30%. 기한 있음: 핑크, 오늘(또는 지난 기한)이 50%이고
// 남은 날짜가 하루씩 늘어날 때마다 10%씩 옅어진다(같은 날짜면 항상 같은 투명도).
function todoCardBackground(todo: Todo, todayKey: string): string {
  if (todo.done) return withOpacity(todoCardColors.done, 0.3);
  if (!todo.dueDate) return withOpacity(todoCardColors.noDueDate, 0.3);
  const daysLeft = Math.max(0, daysUntilDue(todo.dueDate, todayKey));
  return withOpacity(todoCardColors.dueDate, 0.5 - daysLeft * 0.1);
}

// Build-time flag for the login-free, phone-only variant — see CLAUDE.md.
const IS_LOCAL_MODE = process.env.EXPO_PUBLIC_STORAGE_MODE === 'local';

const APP_VERSION = appJson.expo.version;

function formatTodayLabel(): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const now = new Date();
  return `${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;
}

export default function TodayScreen() {
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<TabParamList>>();
  const route = useRoute<RouteProp<TabParamList, '오늘'>>();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(() => new Date().getMonth());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [detailEditorOpen, setDetailEditorOpen] = useState(false);
  const [detailTodoId, setDetailTodoId] = useState<string | null>(null);
  const [detailText, setDetailText] = useState('');
  const [detailImageUris, setDetailImageUris] = useState<string[]>([]);
  const [detailNoteType, setDetailNoteType] = useState<'text' | 'checklist'>('text');
  const [detailChecklistItems, setDetailChecklistItems] = useState<ChecklistItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const items = await loadItems<Todo>(STORAGE_KEYS.TODOS);
        // 잠금화면 "기억의 궁전"에서 완료 체크된 할일이 있으면 여기서 따라잡는다.
        const pendingIds = await getPendingTodoCompletions();
        if (pendingIds.length > 0) {
          const completedAt = Date.now();
          const updated = items.map((t) =>
            pendingIds.includes(t.id) ? { ...t, done: true, completedAt } : t
          );
          setTodos(updated);
          updated
            .filter((t) => pendingIds.includes(t.id))
            .forEach((t) => updateItem(STORAGE_KEYS.TODOS, t));
        } else {
          setTodos(items);
        }
        setLoaded(true);
      })();
    }, [])
  );

  const resetDatePicker = (baseDate: string | null) => {
    const base = baseDate ? new Date(`${baseDate}T00:00:00`) : new Date();
    setPickerYear(base.getFullYear());
    setPickerMonth(base.getMonth());
    setDatePickerOpen(false);
  };

  const openAddForm = () => {
    setEditingId(null);
    setInput('');
    setTagsInput('');
    setDueDate(null);
    resetDatePicker(null);
    setFormOpen(true);
  };

  const openEditForm = (todo: Todo) => {
    setEditingId(todo.id);
    setInput(todo.title);
    setTagsInput((todo.tags ?? []).join(', '));
    setDueDate(todo.dueDate ?? null);
    resetDatePicker(todo.dueDate ?? null);
    setFormOpen(true);
  };

  const shiftPickerMonth = (delta: number) => {
    const next = new Date(pickerYear, pickerMonth + delta, 1);
    setPickerYear(next.getFullYear());
    setPickerMonth(next.getMonth());
  };

  const saveTodo = () => {
    const title = input.trim();
    if (!title) return;
    const tags = parseTags(tagsInput);
    if (editingId) {
      const updated = todos.map((t) =>
        t.id === editingId ? { ...t, title, tags, dueDate: dueDate ?? undefined } : t
      );
      setTodos(updated);
      const changed = updated.find((t) => t.id === editingId);
      if (changed) updateItem(STORAGE_KEYS.TODOS, changed);
    } else {
      const newTodo: Todo = {
        id: Date.now().toString(),
        title,
        done: false,
        createdAt: Date.now(),
        tags,
        dueDate: dueDate ?? undefined,
      };
      setTodos([newTodo, ...todos]);
      createItem(STORAGE_KEYS.TODOS, newTodo);
    }
    setFormOpen(false);
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

  const openDetailEditor = (todo: Todo) => {
    setDetailTodoId(todo.id);
    setDetailText(todo.detailText ?? '');
    setDetailImageUris(todo.detailImageUris ?? []);
    setDetailNoteType(todo.detailNoteType === 'checklist' ? 'checklist' : 'text');
    setDetailChecklistItems(todo.detailChecklistItems ?? []);
    setDetailEditorOpen(true);
  };

  const saveDetail = () => {
    if (!detailTodoId) return;
    const trimmedText = detailText.trim();
    const trimmedItems = detailChecklistItems
      .map((item) => ({ ...item, text: item.text.trim() }))
      .filter((item) => item.text.length > 0);
    const detail = {
      detailText: trimmedText,
      detailImageUris: detailImageUris.length > 0 ? detailImageUris : undefined,
      detailNoteType,
      detailChecklistItems: detailNoteType === 'checklist' ? trimmedItems : [],
    };
    const updated = todos.map((t) => (t.id === detailTodoId ? { ...t, ...detail } : t));
    setTodos(updated);
    const changed = updated.find((t) => t.id === detailTodoId);
    if (changed) updateItem(STORAGE_KEYS.TODOS, changed);
    setDetailEditorOpen(false);
  };

  const toggleDetailChecklistItem = (todoId: string, itemId: string) => {
    const updated = todos.map((t) =>
      t.id === todoId
        ? {
            ...t,
            detailChecklistItems: (t.detailChecklistItems ?? []).map((item) =>
              item.id === itemId ? { ...item, done: !item.done } : item
            ),
          }
        : t
    );
    setTodos(updated);
    const changed = updated.find((t) => t.id === todoId);
    if (changed) updateItem(STORAGE_KEYS.TODOS, changed);
  };

  // 캘린더에서 특정 할일을 탭해 들어온 경우, 그 항목의 수정화면을 바로 연다.
  useEffect(() => {
    const focusId = route.params?.focusTodoId;
    if (!focusId) return;
    const todo = todos.find((t) => t.id === focusId);
    if (todo) {
      openEditForm(todo);
      navigation.setParams({ focusTodoId: undefined });
    }
  }, [route.params?.focusTodoId, todos]);

  const toggleTodo = (id: string) => {
    const updated = todos.map((t) =>
      t.id === id
        ? { ...t, done: !t.done, completedAt: !t.done ? Date.now() : undefined }
        : t
    );
    setTodos(updated);
    const changed = updated.find((t) => t.id === id);
    if (changed) updateItem(STORAGE_KEYS.TODOS, changed);
  };

  const togglePinned = (id: string) => {
    const updated = todos.map((t) => (t.id === id ? { ...t, isPinned: !t.isPinned } : t));
    setTodos(updated);
    const changed = updated.find((t) => t.id === id);
    if (changed) updateItem(STORAGE_KEYS.TODOS, changed);
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((t) => t.id !== id));
    deleteItem(STORAGE_KEYS.TODOS, id);
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    todos.forEach((t) => t.tags?.forEach((tag) => set.add(tag)));
    return Array.from(set);
  }, [todos]);

  const visibleTodos = useMemo(() => {
    const filtered = selectedTag ? todos.filter((t) => t.tags?.includes(selectedTag)) : todos;
    // 별표(고정) 항목이 공지처럼 무조건 맨 위, 그 다음 미완료 → 완료 순.
    // 미완료 항목 안에서는 기한이 빠른 순 → 기한 없음(작성일 내림차순) 순으로,
    // 완료 항목은 완료일 내림차순으로 정렬.
    return [...filtered].sort((a, b) => {
      const pinnedDiff = Number(!!b.isPinned) - Number(!!a.isPinned);
      if (pinnedDiff !== 0) return pinnedDiff;
      const doneDiff = Number(a.done) - Number(b.done);
      if (doneDiff !== 0) return doneDiff;
      if (!a.done) {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.createdAt - a.createdAt;
      }
      return (b.completedAt ?? 0) - (a.completedAt ?? 0);
    });
  }, [todos, selectedTag]);

  if (!loaded) return <View style={styles.container} />;

  const doneCount = todos.filter((t) => t.done).length;
  const todayKey = toDateKey(new Date());

  return (
    <ResponsiveScreenContainer>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.dateLabel}>
            {formatTodayLabel()} · v{APP_VERSION}
          </Text>
          {!IS_LOCAL_MODE && (
            <View style={styles.headerActions}>
              <Pressable onPress={signOut} hitSlop={8} style={styles.headerActionButton}>
                <Ionicons name="log-out-outline" size={20} color={colors.subtext} />
                <Text style={styles.headerActionLabel}>로그아웃</Text>
              </Pressable>
            </View>
          )}
        </View>
        <Text style={styles.title}>오늘 할 일</Text>
        {allTags.length === 0 && todos.length > 0 && (
          <Text style={styles.progress}>
            {doneCount} / {todos.length} 완료
          </Text>
        )}
      </View>

      {allTags.length > 0 && (
        <View style={styles.filterRow}>
          {todos.length > 0 && (
            <Text style={styles.progressInline}>
              {doneCount}/{todos.length}
            </Text>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tagFilterScroll}
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
        </View>
      )}

      <FlatList
        data={visibleTodos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>오늘 할 일을 추가해보세요</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isExpanded = expandedIds.has(item.id);
          const itemHasDetail = hasTodoDetail(item);
          return (
            <View style={[styles.todoCard, { backgroundColor: todoCardBackground(item, todayKey) }]}>
              <View style={styles.todoRow}>
                <Pressable
                  style={styles.checkbox}
                  onPress={() => toggleTodo(item.id)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={item.done ? colors.done : colors.subtext}
                  />
                </Pressable>
                <Pressable style={styles.todoBody} onPress={() => toggleExpanded(item.id)}>
                  <View style={styles.todoTitleRow}>
                    <Text
                      style={[styles.todoText, item.done && styles.todoTextDone]}
                    >
                      {item.title}
                    </Text>
                    {itemHasDetail && (
                      <Ionicons name="document-text-outline" size={14} color={colors.subtext} />
                    )}
                  </View>
                  <Text style={styles.todoMeta}>
                    작성 {formatShortDate(item.createdAt)}
                    {item.done && item.completedAt ? ` · 완료 ${formatShortDate(item.completedAt)}` : ''}
                    {!item.done && item.dueDate ? (
                      <Text style={item.dueDate < todayKey ? styles.dueDateOverdue : styles.dueDateText}>
                        {` · 기한 ${formatDateKeyShort(item.dueDate)}`}
                      </Text>
                    ) : null}
                  </Text>
                  {item.tags && item.tags.length > 0 && (
                    <View style={styles.todoTagRow}>
                      {item.tags.map((tag) => (
                        <View key={tag} style={styles.todoTagChip}>
                          <Text style={styles.todoTagChipText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Pressable>
                <View style={styles.todoActions}>
                  <Pressable onPress={() => togglePinned(item.id)} hitSlop={8}>
                    <Ionicons
                      name={item.isPinned ? 'star' : 'star-outline'}
                      size={20}
                      color={item.isPinned ? colors.star : colors.subtext}
                    />
                  </Pressable>
                  <Pressable onPress={() => openEditForm(item)} hitSlop={8}>
                    <Ionicons name="pencil-outline" size={20} color={colors.subtext} />
                  </Pressable>
                  <Pressable onPress={() => deleteTodo(item.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color={colors.subtext} />
                  </Pressable>
                </View>
              </View>

              {isExpanded && (
                <View style={styles.todoDetailSection}>
                  {itemHasDetail ? (
                    <>
                      {item.detailImageUris && item.detailImageUris.length > 0 && (
                        <MemoImage uris={item.detailImageUris} maxHeight={220} />
                      )}
                      <MemoBody
                        memo={{
                          text: item.detailText ?? '',
                          noteType: item.detailNoteType,
                          checklistItems: item.detailChecklistItems,
                        }}
                        onToggleItem={(itemId) => toggleDetailChecklistItem(item.id, itemId)}
                      />
                    </>
                  ) : (
                    <Text style={styles.todoDetailEmptyText}>상세 내용이 없습니다</Text>
                  )}
                  <Pressable
                    style={styles.detailEditButton}
                    onPress={() => openDetailEditor(item)}
                  >
                    <Ionicons
                      name={itemHasDetail ? 'create-outline' : 'add-circle-outline'}
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.detailEditButtonText}>
                      {itemHasDetail ? '내용 수정' : '내용 추가'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={openAddForm}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView
          style={styles.formOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Pressable onPress={() => setFormOpen(false)}>
                <Text style={styles.formCancel}>취소</Text>
              </Pressable>
              <Text style={styles.formTitle}>{editingId ? '할 일 수정' : '새 할 일'}</Text>
              <Pressable onPress={saveTodo}>
                <Text style={styles.formSave}>저장</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="할 일을 입력하세요"
              placeholderTextColor={colors.subtext}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={saveTodo}
              returnKeyType="done"
              autoFocus
            />
            <TextInput
              style={styles.tagInput}
              placeholder="태그 (쉼표로 구분, 선택)"
              placeholderTextColor={colors.subtext}
              value={tagsInput}
              onChangeText={setTagsInput}
              onSubmitEditing={saveTodo}
              returnKeyType="done"
            />

            <Pressable style={styles.dueDateRow} onPress={() => setDatePickerOpen((v) => !v)}>
              <Ionicons name="calendar-outline" size={16} color={colors.subtext} />
              <Text style={styles.dueDateRowText}>
                {dueDate ? `기한 ${formatDateKeyShort(dueDate)}` : '기한 설정 (선택)'}
              </Text>
              {dueDate && (
                <Pressable onPress={() => setDueDate(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.subtext} />
                </Pressable>
              )}
            </Pressable>

            {datePickerOpen && (
              <View style={styles.datePicker}>
                <View style={styles.datePickerNav}>
                  <Pressable onPress={() => shiftPickerMonth(-1)} hitSlop={8}>
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                  </Pressable>
                  <Text style={styles.datePickerMonthLabel}>
                    {pickerYear}년 {pickerMonth + 1}월
                  </Text>
                  <Pressable onPress={() => shiftPickerMonth(1)} hitSlop={8}>
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </Pressable>
                </View>
                <View style={styles.datePickerWeekRow}>
                  {WEEKDAY_LABELS.map((label) => (
                    <Text key={label} style={styles.datePickerWeekLabel}>
                      {label}
                    </Text>
                  ))}
                </View>
                {getMonthMatrix(pickerYear, pickerMonth).map((week, wi) => (
                  <View key={wi} style={styles.datePickerWeekRow}>
                    {week.map((date, di) => {
                      if (!date) return <View key={di} style={styles.datePickerDayCell} />;
                      const key = toDateKey(date);
                      const selected = key === dueDate;
                      return (
                        <Pressable
                          key={di}
                          style={styles.datePickerDayCell}
                          onPress={() => {
                            setDueDate(key);
                            setDatePickerOpen(false);
                          }}
                        >
                          <View
                            style={[
                              styles.datePickerDayCircle,
                              selected && styles.datePickerDayCircleSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.datePickerDayText,
                                selected && styles.datePickerDayTextSelected,
                              ]}
                            >
                              {date.getDate()}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={detailEditorOpen}
        animationType="slide"
        onRequestClose={() => setDetailEditorOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.detailComposer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.detailComposerHeader, { paddingTop: insets.top + 16 }]}>
            <Pressable onPress={() => setDetailEditorOpen(false)}>
              <Text style={styles.detailComposerCancel}>취소</Text>
            </Pressable>
            <Text style={styles.detailComposerTitle}>할 일 상세 내용</Text>
            <Pressable onPress={saveDetail}>
              <Text style={styles.detailComposerSave}>저장</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.detailComposerScroll}
            contentContainerStyle={styles.detailComposerScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <NoteContentEditor
              noteType={detailNoteType}
              onNoteTypeChange={setDetailNoteType}
              text={detailText}
              onTextChange={setDetailText}
              checklistItems={detailChecklistItems}
              onChecklistItemsChange={setDetailChecklistItems}
              imageUris={detailImageUris}
              onImageUrisChange={setDetailImageUris}
              active={detailEditorOpen}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
    </ResponsiveScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 14,
    color: colors.subtext,
    marginBottom: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerActionButton: {
    alignItems: 'center',
    gap: 2,
  },
  headerActionLabel: {
    fontSize: 10,
    color: colors.subtext,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  progress: {
    marginTop: 6,
    fontSize: 13,
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    marginBottom: 8,
    gap: 10,
  },
  progressInline: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  tagFilterScroll: {
    flex: 1,
  },
  tagFilterContent: {
    alignItems: 'center',
    paddingRight: 20,
    gap: 8,
  },
  tagFilterChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  tagFilterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagFilterChipText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.subtext,
  },
  tagFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  todoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    paddingTop: 2,
  },
  todoBody: {
    flex: 1,
  },
  todoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todoText: {
    fontSize: 16,
    color: colors.text,
  },
  todoTextDone: {
    color: colors.subtext,
    textDecorationLine: 'line-through',
  },
  todoMeta: {
    fontSize: 12,
    color: colors.subtext,
    marginTop: 4,
  },
  todoTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  todoTagChip: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todoTagChipText: {
    fontSize: 11,
    color: colors.subtext,
  },
  todoActions: {
    flexDirection: 'row',
    gap: 14,
    paddingTop: 2,
  },
  todoDetailSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  todoDetailEmptyText: {
    fontSize: 13,
    color: colors.subtext,
  },
  detailEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  detailEditButtonText: {
    fontSize: 13,
    fontWeight: '600',
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
  formOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  formCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 10,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  formCancel: {
    fontSize: 15,
    color: colors.subtext,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  formSave: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  tagInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
  },
  dueDateText: {
    color: colors.primary,
  },
  dueDateOverdue: {
    color: colors.danger,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dueDateRowText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  datePicker: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
  },
  datePickerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingBottom: 8,
  },
  datePickerMonthLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    minWidth: 90,
    textAlign: 'center',
  },
  datePickerWeekRow: {
    flexDirection: 'row',
  },
  datePickerWeekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: colors.subtext,
    paddingVertical: 4,
  },
  datePickerDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  datePickerDayCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerDayCircleSelected: {
    backgroundColor: colors.primary,
  },
  datePickerDayText: {
    fontSize: 13,
    color: colors.text,
  },
  datePickerDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  detailComposer: {
    flex: 1,
    backgroundColor: colors.card,
  },
  detailComposerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailComposerCancel: {
    fontSize: 16,
    color: colors.subtext,
  },
  detailComposerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  detailComposerSave: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  detailComposerScroll: {
    flex: 1,
  },
  detailComposerScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
});
