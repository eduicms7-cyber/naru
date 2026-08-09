import React from 'react';
import { Linking, Pressable, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Memo } from '../types';
import { colors } from '../theme/colors';
import { FormattedSegment, parseBlocks, parseInlineFormatting, stripHeadingMarkers } from '../utils/richText';

function FormattedText({ segments }: { segments: FormattedSegment[] }) {
  return (
    <>
      {segments.map((seg, i) => (
        <Text
          key={i}
          style={[
            seg.bold && styles.bold,
            seg.italic && styles.italic,
            seg.strike && styles.strike,
            seg.url && styles.link,
          ]}
          onPress={seg.url ? () => Linking.openURL(seg.url as string) : undefined}
        >
          {seg.text}
        </Text>
      ))}
    </>
  );
}

interface Props {
  memo: Memo;
  onToggleItem?: (itemId: string) => void;
  textStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

// 지식창고 카드와 기억의 궁전 슬라이드가 함께 쓰는 본문 렌더러.
// 일반 텍스트는 **굵게**/_기울임_/~~취소선~~ 마크업을 해석하고, 체크리스트는 항목별 체크박스로 보여준다.
export default function MemoBody({ memo, onToggleItem, textStyle, numberOfLines }: Props) {
  if (memo.noteType === 'checklist') {
    const items = memo.checklistItems ?? [];
    return (
      <View>
        {memo.text.length > 0 && (
          <Text style={[styles.text, styles.title, textStyle]}>{memo.text}</Text>
        )}
        {items.map((item) => {
          const row = (
            <View style={styles.checklistRow}>
              <Ionicons
                name={item.done ? 'checkbox' : 'square-outline'}
                size={18}
                color={item.done ? colors.primary : colors.subtext}
              />
              <Text
                style={[
                  styles.text,
                  styles.checklistText,
                  textStyle,
                  item.done && styles.checklistTextDone,
                ]}
              >
                <FormattedText segments={parseInlineFormatting(item.text)} />
              </Text>
            </View>
          );
          if (!onToggleItem) {
            return <View key={item.id}>{row}</View>;
          }
          return (
            <Pressable key={item.id} onPress={() => onToggleItem(item.id)}>
              {row}
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (memo.text.length === 0) return null;

  // 미리보기(줄 수 제한)에서는 제목 기호를 뗀 한 덩어리 텍스트로, 펼친 상태에서는
  // 줄 단위로 나눠 제목(H1~H3) 크기를 살려서 보여준다.
  if (numberOfLines !== undefined) {
    const segments = parseInlineFormatting(stripHeadingMarkers(memo.text));
    return (
      <Text style={[styles.text, textStyle]} numberOfLines={numberOfLines}>
        <FormattedText segments={segments} />
      </Text>
    );
  }

  const blocks = parseBlocks(memo.text);
  return (
    <View>
      {blocks.map((block, i) => (
        <Text
          key={i}
          style={[
            styles.text,
            textStyle,
            block.level === 1 && styles.h1,
            block.level === 2 && styles.h2,
            block.level === 3 && styles.h3,
          ]}
        >
          <FormattedText segments={block.segments} />
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
  },
  title: {
    fontWeight: '700',
    marginBottom: 6,
  },
  h1: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 2,
  },
  h2: {
    fontSize: 19,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 2,
  },
  h3: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 2,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  checklistText: {
    flex: 1,
  },
  checklistTextDone: {
    color: colors.subtext,
    textDecorationLine: 'line-through',
  },
});
