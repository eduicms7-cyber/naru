import React, { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadItems, saveItems } from '../storage/storage';
import { STORAGE_KEYS, Todo } from '../types';
import { colors } from '../theme/colors';
import { useAuth } from '../auth/AuthContext';

function formatTodayLabel(): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const now = new Date();
  return `${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;
}

export default function TodayScreen() {
  const { signOut } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const items = await loadItems<Todo>(STORAGE_KEYS.TODOS);
        setTodos(items);
        setLoaded(true);
      })();
    }, [])
  );

  const persist = useCallback((items: Todo[]) => {
    setTodos(items);
    saveItems(STORAGE_KEYS.TODOS, items);
  }, []);

  const addTodo = () => {
    const title = input.trim();
    if (!title) return;
    const newTodo: Todo = {
      id: Date.now().toString(),
      title,
      done: false,
      createdAt: Date.now(),
    };
    persist([newTodo, ...todos]);
    setInput('');
  };

  const toggleTodo = (id: string) => {
    persist(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const deleteTodo = (id: string) => {
    persist(todos.filter((t) => t.id !== id));
  };

  if (!loaded) return <View style={styles.container} />;

  const doneCount = todos.filter((t) => t.done).length;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.dateLabel}>{formatTodayLabel()}</Text>
          <Pressable onPress={signOut} hitSlop={8}>
            <Text style={styles.signOutText}>로그아웃</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>오늘 할 일</Text>
        {todos.length > 0 && (
          <Text style={styles.progress}>
            {doneCount} / {todos.length} 완료
          </Text>
        )}
      </View>

      <FlatList
        data={todos}
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
            <Text
              style={[
                styles.todoText,
                item.done && styles.todoTextDone,
              ]}
            >
              {item.title}
            </Text>
            <Pressable onPress={() => deleteTodo(item.id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.subtext} />
            </Pressable>
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="할 일을 입력하세요"
          placeholderTextColor={colors.subtext}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={addTodo}
          returnKeyType="done"
        />
        <Pressable style={styles.addButton} onPress={addTodo}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
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
  signOutText: {
    fontSize: 13,
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
    paddingBottom: 16,
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
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 12,
  },
  checkbox: {},
  todoText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  todoTextDone: {
    color: colors.subtext,
    textDecorationLine: 'line-through',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
