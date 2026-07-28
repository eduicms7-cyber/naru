import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { loadItems, saveItems } from '../storage/storage';
import { Memo, STORAGE_KEYS } from '../types';
import { colors } from '../theme/colors';
import { isDueForReview, markForgot, markRemembered, newMemoReviewFields } from '../memory/spacedRepetition';
import {
  clearReview,
  ensureFullScreenIntentPermission,
  requestReviewPermission,
  setPriorityMemos,
  showReview,
  startWakeMonitor,
} from '../native/ReviewWidget';
import { showAlert } from '../utils/alert';

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

function formatShortDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function MemoScreen() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const persist = useCallback((items: Memo[]) => {
    setMemos(items);
    saveItems(STORAGE_KEYS.MEMOS, items);
  }, []);

  const dueMemos = useMemo(
    () =>
      memos
        .filter((m) => isDueForReview(m, now))
        .sort((a, b) => Number(b.isPriority) - Number(a.isPriority)),
    [memos, now]
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
        setMemos(items);
        setLoaded(true);
      })();
    }, [])
  );

  useEffect(() => {
    if (dueMemos.length === 0) {
      clearReview();
    } else {
      const first = dueMemos[0];
      const body = first.text.length > 0 ? first.text : '이미지 메모';
      showReview(`오늘 복습할 메모 (${dueMemos.length})`, body);
    }
  }, [dueMemos]);

  const priorityMemos = useMemo(
    () => memos.filter((m) => m.isPriority).map((m) => ({ id: m.id, text: m.text })),
    [memos]
  );
  const askedFullScreenPermission = useRef(false);

  useEffect(() => {
    setPriorityMemos(priorityMemos);
    if (priorityMemos.length > 0 && !askedFullScreenPermission.current) {
      askedFullScreenPermission.current = true;
      ensureFullScreenIntentPermission();
    }
  }, [priorityMemos]);

  const reviewingMemo = useMemo(
    () => memos.find((m) => m.id === reviewingId) ?? null,
    [memos, reviewingId]
  );

  const openComposer = () => {
    setEditingId(null);
    setText('');
    setImageUri(undefined);
    setComposerOpen(true);
  };

  const openEditor = (item: Memo) => {
    setEditingId(item.id);
    setText(item.text);
    setImageUri(item.imageUri);
    setComposerOpen(true);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('권한 필요', '이미지를 첨부하려면 사진 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const saveMemo = () => {
    const trimmed = text.trim();
    if (!trimmed && !imageUri) return;
    if (editingId) {
      persist(memos.map((m) => (m.id === editingId ? { ...m, text: trimmed, imageUri } : m)));
    } else {
      const createdAt = Date.now();
      const newMemo: Memo = {
        id: createdAt.toString(),
        text: trimmed,
        imageUri,
        createdAt,
        ...newMemoReviewFields(createdAt),
      };
      persist([newMemo, ...memos]);
    }
    setComposerOpen(false);
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

  const togglePriority = (id: string) => {
    persist(
      memos.map((m) => {
        if (m.id !== id) return m;
        const isPriority = !m.isPriority;
        // Turning priority on makes it due right away instead of waiting for its current cycle.
        return isPriority
          ? { ...m, isPriority, reviewStage: 0, nextReviewAt: Date.now() }
          : { ...m, isPriority };
      })
    );
    // dueMemos is computed off the `now` state, which only refreshes on focus —
    // refresh it here too so a newly-prioritized memo shows as due immediately.
    setNow(Date.now());
  };

  const openMemoActions = (item: Memo) => {
    showAlert('메모', undefined, [
      { text: '취소', style: 'cancel' },
      { text: '수정', onPress: () => openEditor(item) },
      { text: '삭제', style: 'destructive', onPress: () => deleteMemo(item.id) },
    ]);
  };

  const deleteMemo = (id: string) => {
    showAlert('메모 삭제', '이 메모를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => persist(memos.filter((m) => m.id !== id)),
      },
    ]);
  };

  const finishReview = (remembered: boolean) => {
    if (!reviewingMemo) return;
    const reviewedAt = Date.now();
    const updated = remembered
      ? markRemembered(reviewingMemo, reviewedAt)
      : markForgot(reviewingMemo, reviewedAt);
    persist(memos.map((m) => (m.id === updated.id ? updated : m)));
    setReviewingId(null);
    setNow(Date.now());
  };

  if (!loaded) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>메모</Text>
      </View>

      {dueMemos.length > 0 && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>오늘 복습할 메모 ({dueMemos.length})</Text>
          {dueMemos.map((item) => (
            <Pressable
              key={item.id}
              style={styles.reviewCard}
              onPress={() => setReviewingId(item.id)}
            >
              <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
              <Text style={styles.reviewCardText} numberOfLines={1}>
                {item.text.length > 0 ? item.text : '이미지 메모'}
              </Text>
              {item.isPriority && <Ionicons name="star" size={14} color={colors.star} />}
              <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
            </Pressable>
          ))}
        </View>
      )}

      <FlatList
        data={memos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>아직 작성한 메모가 없어요</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isExpanded = expandedIds.has(item.id);
          return (
            <Pressable
              style={styles.memoCard}
              onPress={() => toggleExpanded(item.id)}
              onLongPress={() => openMemoActions(item)}
            >
              {item.imageUri && (
                <Image source={{ uri: item.imageUri }} style={styles.memoImage} />
              )}
              {item.text.length > 0 && (
                <Text style={styles.memoText} numberOfLines={isExpanded ? undefined : 3}>
                  {item.text}
                </Text>
              )}
              <View style={styles.memoFooter}>
                <Text style={styles.memoDate}>{formatDate(item.createdAt)}</Text>
                <View style={styles.memoFooterRight}>
                  <Text style={styles.memoNextReview}>
                    다음 복습 {formatShortDate(item.nextReviewAt)}
                  </Text>
                  <Pressable onPress={() => togglePriority(item.id)} hitSlop={8}>
                    <Ionicons
                      name={item.isPriority ? 'star' : 'star-outline'}
                      size={18}
                      color={item.isPriority ? colors.star : colors.subtext}
                    />
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.composerHeader}>
            <Pressable onPress={() => setComposerOpen(false)}>
              <Text style={styles.composerCancel}>취소</Text>
            </Pressable>
            <Text style={styles.composerTitle}>{editingId ? '메모 수정' : '새 메모'}</Text>
            <Pressable onPress={saveMemo}>
              <Text style={styles.composerSave}>저장</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.composerInput}
            placeholder="내용을 입력하세요"
            placeholderTextColor={colors.subtext}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
          />

          {imageUri && (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <Pressable
                style={styles.removeImageButton}
                onPress={() => setImageUri(undefined)}
              >
                <Ionicons name="close-circle" size={24} color={colors.danger} />
              </Pressable>
            </View>
          )}

          <View style={styles.composerToolbar}>
            <Pressable style={styles.toolbarButton} onPress={pickImage}>
              <Ionicons name="image-outline" size={22} color={colors.primary} />
              <Text style={styles.toolbarButtonText}>이미지 첨부</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={reviewingMemo !== null} animationType="fade" transparent onRequestClose={() => setReviewingId(null)}>
        <View style={styles.reviewOverlay}>
          <View style={styles.reviewModalCard}>
            {reviewingMemo?.imageUri && (
              <Image source={{ uri: reviewingMemo.imageUri }} style={styles.reviewModalImage} />
            )}
            <Text style={styles.reviewModalText}>{reviewingMemo?.text}</Text>
            <Text style={styles.reviewModalPrompt}>이 내용이 기억나시나요?</Text>
            <View style={styles.reviewModalActions}>
              <Pressable
                style={[styles.reviewModalButton, styles.reviewModalButtonForgot]}
                onPress={() => finishReview(false)}
              >
                <Text style={styles.reviewModalButtonForgotText}>다시 봐야해요</Text>
              </Pressable>
              <Pressable
                style={[styles.reviewModalButton, styles.reviewModalButtonRemembered]}
                onPress={() => finishReview(true)}
              >
                <Text style={styles.reviewModalButtonRememberedText}>기억나요</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  reviewSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  reviewSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF1FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 10,
  },
  reviewCardText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
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
  memoImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 10,
  },
  memoText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
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
  composerInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    padding: 20,
    textAlignVertical: 'top',
  },
  previewWrap: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  composerToolbar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolbarButtonText: {
    color: colors.primary,
    fontSize: 14,
  },
  reviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  reviewModalCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
  },
  reviewModalImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 12,
  },
  reviewModalText: {
    fontSize: 17,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 16,
  },
  reviewModalPrompt: {
    fontSize: 13,
    color: colors.subtext,
    marginBottom: 14,
  },
  reviewModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  reviewModalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reviewModalButtonForgot: {
    backgroundColor: colors.background,
  },
  reviewModalButtonForgotText: {
    color: colors.subtext,
    fontWeight: '600',
  },
  reviewModalButtonRemembered: {
    backgroundColor: colors.primary,
  },
  reviewModalButtonRememberedText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
