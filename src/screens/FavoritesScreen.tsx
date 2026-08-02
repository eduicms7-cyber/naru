import React, { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createItem, deleteItem, loadItems, updateItem } from '../storage/storage';
import { Favorite, STORAGE_KEYS } from '../types';
import { colors } from '../theme/colors';

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function sortByOrder(items: Favorite[]): Favorite[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const items = await loadItems<Favorite>(STORAGE_KEYS.FAVORITES);
        setFavorites(sortByOrder(items));
        setLoaded(true);
      })();
    }, [])
  );

  const openAddForm = () => {
    setEditingId(null);
    setTitleInput('');
    setUrlInput('');
    setFormOpen(true);
  };

  const openEditForm = (favorite: Favorite) => {
    setEditingId(favorite.id);
    setTitleInput(favorite.title);
    setUrlInput(favorite.url);
    setFormOpen(true);
  };

  const saveFavorite = () => {
    const title = titleInput.trim();
    const url = urlInput.trim();
    if (!title || !url) return;
    const normalizedUrl = normalizeUrl(url);

    if (editingId) {
      const updated = favorites.map((f) =>
        f.id === editingId ? { ...f, title, url: normalizedUrl } : f
      );
      setFavorites(updated);
      const changed = updated.find((f) => f.id === editingId);
      if (changed) updateItem(STORAGE_KEYS.FAVORITES, changed);
    } else {
      const maxOrder = favorites.reduce((max, f) => Math.max(max, f.order), -1);
      const newFavorite: Favorite = {
        id: Date.now().toString(),
        title,
        url: normalizedUrl,
        order: maxOrder + 1,
        createdAt: Date.now(),
      };
      setFavorites([...favorites, newFavorite]);
      createItem(STORAGE_KEYS.FAVORITES, newFavorite);
    }
    setFormOpen(false);
  };

  const deleteFavorite = (id: string) => {
    setFavorites(favorites.filter((f) => f.id !== id));
    deleteItem(STORAGE_KEYS.FAVORITES, id);
  };

  const openFavorite = (url: string) => {
    Linking.openURL(url);
  };

  // 인접한 두 항목의 order 값을 맞바꿔서 순서를 옮긴다. 두 항목 각각을 개별
  // updateItem으로 저장(전체 배열을 통째로 덮어쓰지 않음).
  const swapOrder = (index: number, otherIndex: number) => {
    if (otherIndex < 0 || otherIndex >= favorites.length) return;
    const current = favorites[index];
    const other = favorites[otherIndex];
    const updatedCurrent = { ...current, order: other.order };
    const updatedOther = { ...other, order: current.order };
    const next = [...favorites];
    next[index] = updatedCurrent;
    next[otherIndex] = updatedOther;
    setFavorites(sortByOrder(next));
    updateItem(STORAGE_KEYS.FAVORITES, updatedCurrent);
    updateItem(STORAGE_KEYS.FAVORITES, updatedOther);
  };

  const moveUp = (index: number) => swapOrder(index, index - 1);
  const moveDown = (index: number) => swapOrder(index, index + 1);

  if (!loaded) return <View style={styles.container} />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>즐겨찾기</Text>
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>자주 가는 링크를 추가해보세요</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Pressable style={styles.rowBody} onPress={() => openFavorite(item.url)}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.rowUrl} numberOfLines={1}>
                {item.url}
              </Text>
            </Pressable>
            <View style={styles.rowActions}>
              <Pressable onPress={() => moveUp(index)} disabled={index === 0} hitSlop={8}>
                <Ionicons
                  name="chevron-up"
                  size={20}
                  color={index === 0 ? colors.border : colors.subtext}
                />
              </Pressable>
              <Pressable
                onPress={() => moveDown(index)}
                disabled={index === favorites.length - 1}
                hitSlop={8}
              >
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={index === favorites.length - 1 ? colors.border : colors.subtext}
                />
              </Pressable>
              <Pressable onPress={() => openEditForm(item)} hitSlop={8}>
                <Ionicons name="pencil-outline" size={20} color={colors.subtext} />
              </Pressable>
              <Pressable onPress={() => deleteFavorite(item.id)} hitSlop={8}>
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
              <Text style={styles.formTitle}>{editingId ? '즐겨찾기 수정' : '새 즐겨찾기'}</Text>
              <Pressable onPress={saveFavorite}>
                <Text style={styles.formSave}>저장</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="제목을 입력하세요"
              placeholderTextColor={colors.subtext}
              value={titleInput}
              onChangeText={setTitleInput}
              returnKeyType="next"
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="URL을 입력하세요 (예: example.com)"
              placeholderTextColor={colors.subtext}
              value={urlInput}
              onChangeText={setUrlInput}
              onSubmitEditing={saveFavorite}
              returnKeyType="done"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 12,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    color: colors.text,
  },
  rowUrl: {
    fontSize: 12,
    color: colors.subtext,
    marginTop: 4,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
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
});
