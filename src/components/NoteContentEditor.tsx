import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { ChecklistItem } from '../types';
import { colors } from '../theme/colors';
import { showAlert } from '../utils/alert';

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// 표(엑셀/구글시트/노션 등)를 복사하면 클립보드에 plain text와 함께 HTML 표(<table><tr><td>)도
// 담기는데, 소스 앱에 따라 plain text의 셀 구분자가 탭이 아니라 개행인 경우가 있어 셀 단위로
// 항목이 쪼개지는 문제가 있었다. HTML을 직접 파싱해 "한 행 = 한 줄"로 셀을 이어 붙인다.
// 표가 아니면(HTML에 tr이 없으면) null을 반환해 호출부가 plain text 줄바꿈 분리로 넘어가게 한다.
function extractTableRowLines(html: string): string[] | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('tr'));
  if (rows.length === 0) return null;
  const lines = rows
    .map((tr) =>
      Array.from(tr.querySelectorAll('td, th'))
        .map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter((cellText) => cellText.length > 0)
        .join(' ')
    )
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines : null;
}

interface Props {
  noteType: 'text' | 'checklist';
  onNoteTypeChange: (noteType: 'text' | 'checklist') => void;
  text: string;
  onTextChange: (text: string) => void;
  checklistItems: ChecklistItem[];
  onChecklistItemsChange: (items: ChecklistItem[]) => void;
  imageUris: string[];
  onImageUrisChange: (uris: string[]) => void;
  // 웹에서 클립보드 이미지 붙여넣기(paste 리스너)를 붙일지 여부 — 이 편집기를 담은
  // 모달/화면이 실제로 열려 있을 때만 true로 넘겨야 한다.
  active: boolean;
  textPlaceholder?: string;
  checklistTitlePlaceholder?: string;
}

// 지식창고 카드 작성/수정과 할일 상세 내용 편집이 함께 쓰는 본문 편집 UI.
// 서식 툴바(H1~H3/굵게/기울임/취소선), 텍스트↔체크리스트 전환, 이미지 첨부/붙여넣기를 담당한다.
// 색상·태그처럼 지식창고 카드에만 있는 항목은 이 컴포넌트 밖(호출부)에서 별도로 렌더링한다.
export default function NoteContentEditor({
  noteType,
  onNoteTypeChange,
  text,
  onTextChange,
  checklistItems,
  onChecklistItemsChange,
  imageUris,
  onImageUrisChange,
  active,
  textPlaceholder = '내용을 입력하세요',
  checklistTitlePlaceholder = '제목 (선택)',
}: Props) {
  const [textSelection, setTextSelection] = useState({ start: 0, end: 0 });
  const inputRef = useRef<TextInput>(null);
  const dropZoneRef = useRef<View>(null);
  const [dragActive, setDragActive] = useState(false);
  const checklistInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // 웹에서만 가능: RN TextInput은 onPaste를 지원하지 않고 react-native-web도 이 prop을
  // 전달하지 않으므로, 웹에서 렌더링되는 실제 DOM 노드에 직접 paste 리스너를 붙인다.
  // 네이티브(iOS/Android)는 아래 클립보드 버튼(pasteImageFromClipboard)으로 대체.
  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    const node = inputRef.current as unknown as HTMLElement | null;
    if (!node) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles = Array.from(items)
        .filter((item) => item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => !!file);
      if (imageFiles.length === 0) return;
      e.preventDefault();
      const uris = imageFiles.map((file) => URL.createObjectURL(file));
      onImageUrisChange([...imageUris, ...uris]);
    };
    node.addEventListener('paste', handlePaste as EventListener);
    return () => node.removeEventListener('paste', handlePaste as EventListener);
  }, [active, imageUris, onImageUrisChange]);

  // 웹에서만: 파일 탐색기에서 이미지를 드래그해 편집기 위에 놓으면 첨부한다.
  // blob: URL은 storage.ts의 ensureUploadedImage가 그대로 fetch해서 업로드할 수 있다.
  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    const node = dropZoneRef.current as unknown as HTMLElement | null;
    if (!node) return;
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setDragActive(true);
    };
    const handleDragLeave = () => setDragActive(false);
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const files = Array.from(e.dataTransfer?.files ?? []).filter((file) =>
        file.type.startsWith('image/')
      );
      if (files.length === 0) return;
      const uris = files.map((file) => URL.createObjectURL(file));
      onImageUrisChange([...imageUris, ...uris]);
    };
    node.addEventListener('dragover', handleDragOver);
    node.addEventListener('dragleave', handleDragLeave);
    node.addEventListener('drop', handleDrop);
    return () => {
      node.removeEventListener('dragover', handleDragOver);
      node.removeEventListener('dragleave', handleDragLeave);
      node.removeEventListener('drop', handleDrop);
    };
  }, [active, imageUris, onImageUrisChange]);

  // 웹에서만: 체크리스트 항목 입력창에 여러 줄(또는 표에서 복사한 여러 행)을 붙여넣으면
  // 줄바꿈 단위로 잘라 각 줄을 별도 체크박스 항목으로 만든다. RN TextInput은 multiline=false일 때
  // 웹에서 단일줄 <input>으로 렌더링되어 붙여넣기 시 브라우저가 개행을 지워버리므로,
  // 위 이미지 붙여넣기와 같은 방식으로 실제 DOM 노드에 paste 리스너를 직접 붙여 개행을 가로챈다.
  useEffect(() => {
    if (Platform.OS !== 'web' || !active || noteType !== 'checklist') return;
    const cleanups: Array<() => void> = [];
    checklistItems.forEach((item) => {
      const node = checklistInputRefs.current.get(item.id);
      if (!node) return;
      const handlePaste = (e: ClipboardEvent) => {
        const html = e.clipboardData?.getData('text/html');
        const tableRows = html ? extractTableRowLines(html) : null;
        if (tableRows) {
          e.preventDefault();
          applyChecklistRows(item.id, tableRows, node.selectionStart ?? 0, node.selectionEnd ?? 0);
          return;
        }
        const pasted = e.clipboardData?.getData('text/plain') || e.clipboardData?.getData('text');
        if (!pasted || !pasted.includes('\n')) return;
        e.preventDefault();
        applyChecklistPaste(item.id, pasted, node.selectionStart ?? 0, node.selectionEnd ?? 0);
      };
      node.addEventListener('paste', handlePaste as EventListener);
      cleanups.push(() => node.removeEventListener('paste', handlePaste as EventListener));
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [active, noteType, checklistItems]);

  const wrapSelection = (marker: string) => {
    const { start, end } = textSelection;
    const before = text.slice(0, start);
    const middle = text.slice(start, end);
    const after = text.slice(end);
    const wrapped = `${marker}${middle || '텍스트'}${marker}`;
    onTextChange(before + wrapped + after);
    const cursor = before.length + wrapped.length;
    setTextSelection({ start: cursor, end: cursor });
  };

  // 커서가 있는 줄 맨 앞에 # / ## / ### 을 붙이거나(이미 같은 레벨이면) 뗀다.
  const setHeadingLevel = (level: 1 | 2 | 3) => {
    const cursor = textSelection.start;
    const lineStart = text.lastIndexOf('\n', cursor - 1) + 1;
    const lineEndIndex = text.indexOf('\n', cursor);
    const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
    const line = text.slice(lineStart, lineEnd);
    const match = line.match(/^(#{1,3})\s+/);
    const currentLevel = match ? match[1].length : 0;
    const content = match ? line.slice(match[0].length) : line;
    const newLine = currentLevel === level ? content : `${'#'.repeat(level)} ${content}`;
    onTextChange(text.slice(0, lineStart) + newLine + text.slice(lineEnd));
    const cursorPos = lineStart + newLine.length;
    setTextSelection({ start: cursorPos, end: cursorPos });
  };

  const addChecklistItem = () => {
    onChecklistItemsChange([...checklistItems, { id: makeId(), text: '', done: false }]);
  };

  const updateChecklistItemText = (id: string, value: string) => {
    onChecklistItemsChange(
      checklistItems.map((it) => (it.id === id ? { ...it, text: value } : it))
    );
  };

  const removeChecklistItem = (id: string) => {
    onChecklistItemsChange(checklistItems.filter((it) => it.id !== id));
  };

  // lines의 첫 줄은 현재 항목에 남기고 나머지 줄들은 그 뒤에 새 체크박스 항목으로 삽입한다.
  const applyChecklistLines = (id: string, lines: string[]) => {
    if (lines.length === 0) return;
    const index = checklistItems.findIndex((it) => it.id === id);
    if (index === -1) return;
    const current = checklistItems[index];
    const [firstLine, ...restLines] = lines;
    const next = [...checklistItems];
    next[index] = { ...current, text: firstLine };
    next.splice(index + 1, 0, ...restLines.map((line) => ({ id: makeId(), text: line, done: false })));
    onChecklistItemsChange(next);
  };

  // 표 붙여넣기: 이미 행 단위로 나뉜 줄 목록(셀은 한 줄 안에 이어붙여져 있음)을 커서 위치의
  // 앞/뒤 텍스트와 합쳐 그대로 항목으로 삽입한다(행 = 항목).
  const applyChecklistRows = (id: string, rows: string[], selStart: number, selEnd: number) => {
    const index = checklistItems.findIndex((it) => it.id === id);
    if (index === -1) return;
    const current = checklistItems[index];
    const before = current.text.slice(0, selStart);
    const after = current.text.slice(selEnd);
    const lines = [...rows];
    lines[0] = before + lines[0];
    lines[lines.length - 1] = lines[lines.length - 1] + after;
    applyChecklistLines(id, lines);
  };

  // 일반 여러 줄 텍스트 붙여넣기: 커서 위치에 끼워 넣은 뒤 줄바꿈 기준으로 나눠 항목화한다.
  const applyChecklistPaste = (id: string, pastedText: string, selStart: number, selEnd: number) => {
    const index = checklistItems.findIndex((it) => it.id === id);
    if (index === -1) return;
    const current = checklistItems[index];
    const before = current.text.slice(0, selStart);
    const after = current.text.slice(selEnd);
    const merged = before + pastedText + after;
    const lines = merged.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      updateChecklistItemText(id, '');
      return;
    }
    applyChecklistLines(id, lines);
  };

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('권한 필요', '이미지를 첨부하려면 사진 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      onImageUrisChange([...imageUris, ...result.assets.map((asset) => asset.uri)]);
    }
  };

  // 네이티브에는 RN TextInput onPaste가 없어 Ctrl+V로 붙여넣기를 감지할 수 없으므로,
  // 버튼을 눌러 명시적으로 클립보드 이미지를 가져온다(웹은 위 paste 리스너가 담당).
  const pasteImageFromClipboard = async () => {
    try {
      const image = await Clipboard.getImageAsync({ format: 'png' });
      if (!image) {
        showAlert('붙여넣을 이미지 없음', '클립보드에 이미지가 없습니다.');
        return;
      }
      const base64 = image.data.split(',')[1] ?? image.data;
      const fileUri = `${FileSystem.cacheDirectory}paste-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}.png`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      onImageUrisChange([...imageUris, fileUri]);
    } catch (e) {
      showAlert('붙여넣기 실패', '클립보드 이미지를 가져오지 못했습니다.');
    }
  };

  const removeImageAt = (index: number) => {
    onImageUrisChange(imageUris.filter((_, i) => i !== index));
  };

  return (
    <View ref={dropZoneRef} style={dragActive && styles.dropZoneActive}>
      {dragActive && (
        <View style={styles.dropOverlay} pointerEvents="none">
          <Ionicons name="image-outline" size={28} color={colors.primary} />
          <Text style={styles.dropOverlayText}>여기에 이미지를 놓으세요</Text>
        </View>
      )}
      <View style={styles.modeToggleRow}>
        <Pressable
          style={[styles.modeToggleButton, noteType === 'text' && styles.modeToggleButtonActive]}
          onPress={() => onNoteTypeChange('text')}
        >
          <Text style={[styles.modeToggleText, noteType === 'text' && styles.modeToggleTextActive]}>
            텍스트
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.modeToggleButton,
            noteType === 'checklist' && styles.modeToggleButtonActive,
          ]}
          onPress={() => onNoteTypeChange('checklist')}
        >
          <Text
            style={[styles.modeToggleText, noteType === 'checklist' && styles.modeToggleTextActive]}
          >
            체크리스트
          </Text>
        </Pressable>
      </View>

      {noteType === 'text' && (
        <View style={styles.formatToolbar}>
          <Pressable style={styles.formatButton} onPress={() => setHeadingLevel(1)}>
            <Text style={styles.formatButtonText}>H1</Text>
          </Pressable>
          <Pressable style={styles.formatButton} onPress={() => setHeadingLevel(2)}>
            <Text style={styles.formatButtonText}>H2</Text>
          </Pressable>
          <Pressable style={styles.formatButton} onPress={() => setHeadingLevel(3)}>
            <Text style={styles.formatButtonText}>H3</Text>
          </Pressable>
          <View style={styles.formatToolbarDivider} />
          <Pressable style={styles.formatButton} onPress={() => wrapSelection('**')}>
            <Text style={[styles.formatButtonText, styles.formatBold]}>B</Text>
          </Pressable>
          <Pressable style={styles.formatButton} onPress={() => wrapSelection('_')}>
            <Text style={[styles.formatButtonText, styles.formatItalic]}>I</Text>
          </Pressable>
          <Pressable style={styles.formatButton} onPress={() => wrapSelection('~~')}>
            <Text style={[styles.formatButtonText, styles.formatStrike]}>S</Text>
          </Pressable>
        </View>
      )}

      <TextInput
        ref={inputRef}
        style={[styles.textInput, noteType === 'checklist' && styles.textInputCompact]}
        placeholder={noteType === 'checklist' ? checklistTitlePlaceholder : textPlaceholder}
        placeholderTextColor={colors.subtext}
        value={text}
        onChangeText={onTextChange}
        onSelectionChange={(e) => setTextSelection(e.nativeEvent.selection)}
        multiline={noteType === 'text'}
      />

      {noteType === 'checklist' && (
        <View style={styles.checklistEditor}>
          {checklistItems.map((item) => (
            <View key={item.id} style={styles.checklistEditorRow}>
              <Ionicons name="square-outline" size={18} color={colors.subtext} />
              <TextInput
                ref={(node) => {
                  if (Platform.OS !== 'web') return;
                  const el = node as unknown as HTMLInputElement | null;
                  if (el) checklistInputRefs.current.set(item.id, el);
                  else checklistInputRefs.current.delete(item.id);
                }}
                style={styles.checklistEditorInput}
                placeholder="항목 입력"
                placeholderTextColor={colors.subtext}
                value={item.text}
                onChangeText={(value) => updateChecklistItemText(item.id, value)}
              />
              <Pressable onPress={() => removeChecklistItem(item.id)} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.subtext} />
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addChecklistItemButton} onPress={addChecklistItem}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.addChecklistItemText}>항목 추가</Text>
          </Pressable>
        </View>
      )}

      {imageUris.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.previewWrap}
          contentContainerStyle={styles.previewRow}
        >
          {imageUris.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.previewItem}>
              <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
              <Pressable style={styles.removeImageButton} onPress={() => removeImageAt(index)}>
                <Ionicons name="close-circle" size={22} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.imageToolbar}>
        <Pressable style={styles.toolbarButton} onPress={pickImages}>
          <Ionicons name="image-outline" size={22} color={colors.primary} />
          <Text style={styles.toolbarButtonText}>이미지 추가</Text>
        </Pressable>
        {Platform.OS !== 'web' && (
          <Pressable style={styles.toolbarButton} onPress={pasteImageFromClipboard}>
            <Ionicons name="clipboard-outline" size={22} color={colors.primary} />
            <Text style={styles.toolbarButtonText}>붙여넣기</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dropZoneActive: {
    position: 'relative',
    backgroundColor: '#EAF1FF',
    borderRadius: 12,
  },
  dropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(234,241,255,0.9)',
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  dropOverlayText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeToggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  modeToggleButtonActive: {
    backgroundColor: colors.primary,
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subtext,
  },
  modeToggleTextActive: {
    color: '#FFFFFF',
  },
  formatToolbar: {
    flexDirection: 'row',
    paddingTop: 14,
    gap: 10,
  },
  formatButton: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatToolbarDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
  formatButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  formatBold: {
    fontWeight: '700',
  },
  formatItalic: {
    fontStyle: 'italic',
  },
  formatStrike: {
    textDecorationLine: 'line-through',
  },
  textInput: {
    fontSize: 16,
    color: colors.text,
    paddingVertical: 14,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  textInputCompact: {
    minHeight: 0,
    paddingTop: 14,
    paddingBottom: 6,
  },
  checklistEditor: {
    gap: 4,
  },
  checklistEditorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  checklistEditorInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 4,
  },
  addChecklistItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  addChecklistItemText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  previewWrap: {
    marginBottom: 10,
  },
  previewRow: {
    gap: 10,
  },
  previewItem: {
    position: 'relative',
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  imageToolbar: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 20,
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
});
