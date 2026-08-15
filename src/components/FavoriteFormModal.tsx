import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../theme/colors';

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => HTML_ENTITIES[m] ?? m);
}

// URL의 <title>을 가져와 즐겨찾기 제목 자동완성에 쓴다. 사이트가 CORS를 막거나
// 응답이 느리면 그냥 조용히 실패 — 사용자가 직접 입력하면 된다.
async function fetchPageTitle(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const html = await res.text();
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (!match) return null;
    const title = decodeHtmlEntities(match[1]).trim();
    return title.length > 0 ? title : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

interface FavoriteFormModalProps {
  visible: boolean;
  mode: 'add' | 'edit';
  initialTitle?: string;
  initialUrl?: string;
  onSubmit: (title: string, url: string) => void;
  onClose: () => void;
}

export default function FavoriteFormModal({
  visible,
  mode,
  initialTitle = '',
  initialUrl = '',
  onSubmit,
  onClose,
}: FavoriteFormModalProps) {
  const [titleInput, setTitleInput] = useState(initialTitle);
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [fetchingTitle, setFetchingTitle] = useState(false);

  // 모달이 열릴 때마다(추가/수정 진입 시) 입력값을 초기 값으로 다시 맞춘다.
  useEffect(() => {
    if (visible) {
      setTitleInput(initialTitle);
      setUrlInput(initialUrl);
      setFetchingTitle(false);
    }
  }, [visible, initialTitle, initialUrl]);

  // URL 입력을 끝내면(포커스 아웃) 제목이 비어있는 경우에만 페이지 <title>을 가져와 채워준다 —
  // 사용자가 이미 뭔가 입력해뒀다면 덮어쓰지 않는다.
  const handleUrlBlur = async () => {
    const url = urlInput.trim();
    if (!url || titleInput.trim().length > 0) return;
    const normalizedUrl = normalizeUrl(url);
    setFetchingTitle(true);
    const fetchedTitle = await fetchPageTitle(normalizedUrl);
    setFetchingTitle(false);
    if (fetchedTitle && titleInput.trim().length === 0) {
      setTitleInput(fetchedTitle);
    }
  };

  const handleSave = () => {
    const title = titleInput.trim();
    const url = urlInput.trim();
    if (!title || !url) return;
    onSubmit(title, normalizeUrl(url));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.formOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Pressable onPress={onClose}>
              <Text style={styles.formCancel}>취소</Text>
            </Pressable>
            <Text style={styles.formTitle}>{mode === 'edit' ? '즐겨찾기 수정' : '새 즐겨찾기'}</Text>
            <Pressable onPress={handleSave}>
              <Text style={styles.formSave}>저장</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            placeholder="URL을 입력하세요 (예: example.com)"
            placeholderTextColor={colors.subtext}
            value={urlInput}
            onChangeText={setUrlInput}
            onBlur={handleUrlBlur}
            returnKeyType="next"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
          />
          <View style={styles.titleInputRow}>
            <TextInput
              style={[styles.input, styles.titleInput]}
              placeholder="제목 (URL 입력하면 자동으로 채워져요)"
              placeholderTextColor={colors.subtext}
              value={titleInput}
              onChangeText={setTitleInput}
              onSubmitEditing={handleSave}
              returnKeyType="done"
            />
            {fetchingTitle && (
              <ActivityIndicator size="small" color={colors.subtext} style={styles.titleSpinner} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  titleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleInput: {
    flex: 1,
  },
  titleSpinner: {
    position: 'absolute',
    right: 14,
  },
});
