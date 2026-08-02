import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
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
import { STORAGE_KEYS, Todo } from '../types';
import { colors } from '../theme/colors';
import { useAuth } from '../auth/AuthContext';
import { parseTags } from '../utils/tags';
import { formatShortDate } from '../utils/date';
import { getPendingTodoCompletions } from '../native/ReviewWidget';
import type { TabParamList } from '../navigation/TabNavigator';
import appJson from '../../app.json';

const APK_DOWNLOAD_URL = 'https://github.com/eduicms7-cyber/naru/releases/latest/download/app-release.apk';
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

  const openAddForm = () => {
    setEditingId(null);
    setInput('');
    setTagsInput('');
    setFormOpen(true);
  };

  const openEditForm = (todo: Todo) => {
    setEditingId(todo.id);
    setInput(todo.title);
    setTagsInput((todo.tags ?? []).join(', '));
    setFormOpen(true);
  };

  const saveTodo = () => {
    const title = input.trim();
    if (!title) return;
    const tags = parseTags(tagsInput);
    if (editingId) {
      const updated = todos.map((t) => (t.id === editingId ? { ...t, title, tags } : t));
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
      };
      setTodos([newTodo, ...todos]);
      createItem(STORAGE_KEYS.TODOS, newTodo);
    }
    setFormOpen(false);
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

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((t) => t.id !== id));
    deleteItem(STORAGE_KEYS.TODOS, id);
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    todos.forEach((t) => t.tags?.forEach((tag) => set.add(tag)));
    return Array.from(set);
  }, [todos]);

  const visibleTodos = useMemo(
    () => (selectedTag ? todos.filter((t) => t.tags?.includes(selectedTag)) : todos),
    [todos, selectedTag]
  );

  if (!loaded) return <View style={styles.container} />;

  const doneCount = todos.filter((t) => t.done).length;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.dateLabel}>
            {formatTodayLabel()} · v{APP_VERSION}
          </Text>
          <View style={styles.headerActions}>
            {Platform.OS === 'web' && (
              <Pressable
                onPress={() => Linking.openURL(APK_DOWNLOAD_URL)}
                hitSlop={8}
                style={styles.headerActionButton}
              >
                <Ionicons name="download-outline" size={20} color={colors.subtext} />
                <Text style={styles.headerActionLabel}>앱 다운로드</Text>
              </Pressable>
            )}
            <Pressable onPress={signOut} hitSlop={8} style={styles.headerActionButton}>
              <Ionicons name="log-out-outline" size={20} color={colors.subtext} />
              <Text style={styles.headerActionLabel}>로그아웃</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.title}>오늘 할 일</Text>
        {todos.length > 0 && (
          <Text style={styles.progress}>
            {doneCount} / {todos.length} 완료
          </Text>
        )}
      </View>

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
        data={visibleTodos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>오늘 할 일을 추가해보세요</Text>
          </View>
        }
        renderItem={({ item }) => (
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
            <View style={styles.todoBody}>
              <Text
                style={[
                  styles.todoText,
                  item.done && styles.todoTextDone,
                ]}
              >
                {item.title}
              </Text>
              <Text style={styles.todoMeta}>
                작성 {formatShortDate(item.createdAt)}
                {item.done && item.completedAt ? ` · 완료 ${formatShortDate(item.completedAt)}` : ''}
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
            </View>
            <View style={styles.todoActions}>
              <Pressable onPress={() => openEditForm(item)} hitSlop={8}>
                <Ionicons name="pencil-outline" size={20} color={colors.subtext} />
              </Pressable>
              <Pressable onPress={() => deleteTodo(item.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={colors.subtext} />
              </Pressable>
            </View>
          </View>
        )}
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
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
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
  todoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 12,
  },
  checkbox: {
    paddingTop: 2,
  },
  todoBody: {
    flex: 1,
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
});
