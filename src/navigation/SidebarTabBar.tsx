import React, { useCallback, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../auth/AuthContext';
import { Favorite } from '../types';
import FavoriteIcon from '../components/FavoriteIcon';
import FavoriteFormModal from '../components/FavoriteFormModal';
import FavoriteRowMenu from '../components/FavoriteRowMenu';
import { ICONS, TabParamList } from './tabConfig';

// 사이드바에 직접 내비 버튼으로 노출할 라우트만(즐겨찾기는 사이드바 패널이 완전히 대체).
const NAV_ROUTE_NAMES: (keyof TabParamList)[] = ['오늘', '지식창고', '캘린더'];

const IS_LOCAL_MODE = process.env.EXPO_PUBLIC_STORAGE_MODE === 'local';

export default function SidebarTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { signOut } = useAuth();
  const { favorites, load, add, update, remove, swapOrder } = useFavorites();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingFavorite, setEditingFavorite] = useState<Favorite | null>(null);
  const [menuFavorite, setMenuFavorite] = useState<Favorite | null>(null);

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
    setMenuFavorite(null);
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

  const menuIndex = menuFavorite ? favorites.findIndex((f) => f.id === menuFavorite.id) : -1;

  return (
    <View style={[styles.sidebar, { paddingTop: insets.top + 16 }]}>
      <View style={styles.navSection}>
        {state.routes
          .filter((route) => NAV_ROUTE_NAMES.includes(route.name as keyof TabParamList))
          .map((route) => {
            const index = state.routes.findIndex((r) => r.key === route.key);
            const isFocused = state.index === index;
            const { options } = descriptors[route.key];
            const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                style={[styles.navItem, isFocused && styles.navItemActive]}
                onPress={onPress}
              >
                <Ionicons
                  name={ICONS[route.name as keyof TabParamList]}
                  size={20}
                  color={isFocused ? colors.primary : colors.subtext}
                />
                <Text style={[styles.navLabel, isFocused && styles.navLabelActive]}>{label}</Text>
              </Pressable>
            );
          })}
      </View>

      <View style={styles.divider} />

      <View style={styles.favoritesHeader}>
        <Text style={styles.favoritesTitle}>즐겨찾기</Text>
        <Pressable onPress={openAddForm} hitSlop={8}>
          <Ionicons name="add" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        style={styles.favoritesList}
        contentContainerStyle={styles.favoritesListContent}
        ListEmptyComponent={<Text style={styles.emptyText}>즐겨찾기가 없습니다</Text>}
        renderItem={({ item }) => (
          <View style={styles.favoriteRow}>
            <Pressable style={styles.favoriteRowBody} onPress={() => Linking.openURL(item.url)}>
              <FavoriteIcon url={item.url} size={20} />
              <Text style={styles.favoriteTitle} numberOfLines={1}>
                {item.title}
              </Text>
            </Pressable>
            <Pressable onPress={() => setMenuFavorite(item)} hitSlop={8}>
              <Ionicons name="ellipsis-horizontal" size={16} color={colors.subtext} />
            </Pressable>
          </View>
        )}
      />

      {!IS_LOCAL_MODE && (
        <Pressable style={styles.logoutButton} onPress={signOut} hitSlop={8}>
          <Ionicons name="log-out-outline" size={18} color={colors.subtext} />
          <Text style={styles.logoutLabel}>로그아웃</Text>
        </Pressable>
      )}

      <FavoriteFormModal
        visible={formOpen}
        mode={formMode}
        initialTitle={editingFavorite?.title}
        initialUrl={editingFavorite?.url}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
      />

      <FavoriteRowMenu
        visible={!!menuFavorite}
        canMoveUp={menuIndex > 0}
        canMoveDown={menuIndex >= 0 && menuIndex < favorites.length - 1}
        onEdit={() => menuFavorite && openEditForm(menuFavorite)}
        onDelete={() => {
          if (menuFavorite) remove(menuFavorite.id);
          setMenuFavorite(null);
        }}
        onMoveUp={() => {
          if (menuIndex >= 0) swapOrder(menuIndex, menuIndex - 1);
          setMenuFavorite(null);
        }}
        onMoveDown={() => {
          if (menuIndex >= 0) swapOrder(menuIndex, menuIndex + 1);
          setMenuFavorite(null);
        }}
        onClose={() => setMenuFavorite(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 260,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: 12,
  },
  navSection: {
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: colors.background,
  },
  navLabel: {
    fontSize: 15,
    color: colors.subtext,
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  favoritesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  favoritesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.subtext,
  },
  favoritesList: {
    flex: 1,
  },
  favoritesListContent: {
    paddingBottom: 24,
  },
  emptyText: {
    fontSize: 13,
    color: colors.subtext,
    paddingHorizontal: 12,
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  favoriteRowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favoriteTitle: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logoutLabel: {
    fontSize: 14,
    color: colors.subtext,
  },
});
