import React, { useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Favorite } from '../types';
import { colors } from '../theme/colors';
import { useFavorites } from '../hooks/useFavorites';
import FavoriteIcon from '../components/FavoriteIcon';
import FavoriteFormModal from '../components/FavoriteFormModal';

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const { favorites, loaded, load, add, update, remove, swapOrder } = useFavorites();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingFavorite, setEditingFavorite] = useState<Favorite | null>(null);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openAddForm = () => {
    setFormMode('add');
    setEditingFavorite(null);
    setFormOpen(true);
  };

  const openEditForm = (favorite: Favorite) => {
    setFormMode('edit');
    setEditingFavorite(favorite);
    setFormOpen(true);
  };

  const handleSubmit = (title: string, url: string) => {
    if (formMode === 'edit' && editingFavorite) {
      update(editingFavorite.id, title, url);
    } else {
      add(title, url);
    }
    setFormOpen(false);
  };

  const openFavorite = (url: string) => {
    Linking.openURL(url);
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
              <FavoriteIcon url={item.url} />
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowUrl} numberOfLines={1}>
                  {item.url}
                </Text>
              </View>
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
              <Pressable onPress={() => remove(item.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={colors.subtext} />
              </Pressable>
            </View>
          </View>
        )}
      />

      <Pressable style={styles.fab} onPress={openAddForm}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <FavoriteFormModal
        visible={formOpen}
        mode={formMode}
        initialTitle={editingFavorite?.title}
        initialUrl={editingFavorite?.url}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowTexts: {
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
});
