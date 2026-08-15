import { useCallback, useState } from 'react';
import { createItem, deleteItem, loadItems, updateItem } from '../storage/storage';
import { Favorite, STORAGE_KEYS } from '../types';

function sortByOrder(items: Favorite[]): Favorite[] {
  return [...items].sort((a, b) => a.order - b.order);
}

// FavoritesScreen(모바일 즐겨찾기 탭)과 SidebarTabBar(PC 사이드바 패널)가 공유하는 CRUD 훅.
// 두 곳에서 로직이 갈라지지 않도록 저장 로직을 한 군데에 둔다.
export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const items = await loadItems<Favorite>(STORAGE_KEYS.FAVORITES);
    setFavorites(sortByOrder(items));
    setLoaded(true);
  }, []);

  const add = useCallback((title: string, url: string) => {
    setFavorites((prev) => {
      const maxOrder = prev.reduce((max, f) => Math.max(max, f.order), -1);
      const newFavorite: Favorite = {
        id: Date.now().toString(),
        title,
        url,
        order: maxOrder + 1,
        createdAt: Date.now(),
      };
      createItem(STORAGE_KEYS.FAVORITES, newFavorite);
      return sortByOrder([...prev, newFavorite]);
    });
  }, []);

  const update = useCallback((id: string, title: string, url: string) => {
    setFavorites((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, title, url } : f));
      const changed = updated.find((f) => f.id === id);
      if (changed) updateItem(STORAGE_KEYS.FAVORITES, changed);
      return updated;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
    deleteItem(STORAGE_KEYS.FAVORITES, id);
  }, []);

  // 인접한 두 항목의 order 값만 맞바꿔서 순서를 옮긴다. 각 항목을 개별
  // updateItem으로 저장 — 배열 전체를 통째로 덮어쓰지 않는다(데이터 유실 방지).
  const swapOrder = useCallback((index: number, otherIndex: number) => {
    setFavorites((prev) => {
      if (otherIndex < 0 || otherIndex >= prev.length) return prev;
      const current = prev[index];
      const other = prev[otherIndex];
      const updatedCurrent = { ...current, order: other.order };
      const updatedOther = { ...other, order: current.order };
      const next = [...prev];
      next[index] = updatedCurrent;
      next[otherIndex] = updatedOther;
      updateItem(STORAGE_KEYS.FAVORITES, updatedCurrent);
      updateItem(STORAGE_KEYS.FAVORITES, updatedOther);
      return sortByOrder(next);
    });
  }, []);

  return { favorites, loaded, load, add, update, remove, swapOrder };
}
