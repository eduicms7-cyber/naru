import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Memo, STORAGE_KEYS } from '../types';
import { colors } from '../theme/colors';
import MemoBody from '../components/MemoBody';
import MemoImage from '../components/MemoImage';
import ResponsiveScreenContainer from '../components/ResponsiveScreenContainer';
import { loadItems, updateItem } from '../storage/storage';
import { isDueForReview } from '../memory/spacedRepetition';
import { syncDueMemosToNative } from '../native/ReviewWidget';
import {
  LEITNER_BOX_COUNT,
  LEITNER_INTERVALS_DAYS,
  getFlashcard,
  getLeitnerBox,
  isLeitnerDue,
  markLeitnerCorrect,
  markLeitnerWrong,
  shuffleCards,
} from '../memory/leitnerBox';

const BOXES = Array.from({ length: LEITNER_BOX_COUNT }, (_, i) => i + 1);

// 상자 그림 치수. 카드는 장수만큼(최대 MAX_VISIBLE_CARDS) CARD_STEP씩 위로 쌓여 앞판 위로 삐져나온다.
const BOX_VISUAL_HEIGHT = 78;
const BOX_FRONT_HEIGHT = 40;
const MAX_VISIBLE_CARDS = 6;
const CARD_BASE_BOTTOM = 30;
const CARD_STEP = 6;

function intervalLabel(box: number): string {
  const days = LEITNER_INTERVALS_DAYS[box - 1];
  return days === 1 ? '매일' : `${days}일`;
}

// 라이트너 박스 탭: 지식창고 카드(보관 제외)를 Box 1~5로 나눠 보여주고, 박스를 골라 앞면(질문)을
// 보고 떠올린 뒤 뒤집어서 [알고 있음]이면 다음 박스로, [모름]이면 Box 1로 보낸다
// (src/memory/leitnerBox.ts). 기억의 궁전과 같은 reviewStage/nextReviewAt을 공유한다.
export default function LeitnerBoxScreen() {
  const insets = useSafeAreaInsets();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [selectedBox, setSelectedBox] = useState(1);
  // 오늘 복습일이 안 된 카드까지 미리 복습할지 여부(박스에 due 카드가 없을 때만 켤 수 있음).
  const [includeNotDue, setIncludeNotDue] = useState(false);
  // 이번 세션의 카드 순서(id). 답하면 카드가 다른 박스로 옮겨가도 순서가 흔들리지 않도록
  // 박스 선택/셔플 시점에 한 번만 만들고, 답한 카드는 answeredIds로 건너뛴다.
  const [queue, setQueue] = useState<string[]>([]);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });

  const cardsInBox = (box: number) => memos.filter((m) => getLeitnerBox(m) === box);
  const dueInBox = (box: number) => cardsInBox(box).filter((m) => isLeitnerDue(m, now));

  const startBox = (box: number, includeAll: boolean, shuffle: boolean) => {
    const cards = includeAll ? cardsInBox(box) : dueInBox(box);
    const ids = cards.map((m) => m.id);
    setSelectedBox(box);
    setIncludeNotDue(includeAll);
    setQueue(shuffle ? shuffleCards(ids) : ids);
    setAnsweredIds(new Set());
    setFlipped(false);
  };

  // 탭에 들어올 때마다 카드를 새로 불러와(다른 탭/기기에서 바뀐 일정 반영) 세션을 초기화하고,
  // 오늘 복습할 카드가 있는 가장 낮은 박스부터 시작한다. 큐는 이때의 스냅샷으로만 만든다 —
  // 답할 때마다 다시 만들면 순서가 흔들린다.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const items = await loadItems<Memo>(STORAGE_KEYS.MEMOS);
        if (cancelled) return;
        const active = items.filter((m) => !m.isArchived);
        const openedAt = Date.now();
        const firstDueBox =
          BOXES.find((box) => active.some((m) => getLeitnerBox(m) === box && isLeitnerDue(m, openedAt))) ??
          1;
        setMemos(active);
        setNow(openedAt);
        setStats({ correct: 0, wrong: 0 });
        setSelectedBox(firstDueBox);
        setIncludeNotDue(false);
        setQueue(
          active
            .filter((m) => getLeitnerBox(m) === firstDueBox && isLeitnerDue(m, openedAt))
            .map((m) => m.id)
        );
        setAnsweredIds(new Set());
        setFlipped(false);
        setLoaded(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // 여기서 바뀐 복습 일정도 잠금화면 복습 목록에 바로 반영한다(지식창고 탭과 같은 기준: 기억의 궁전 due).
  const palaceDueMemos = useMemo(() => memos.filter((m) => isDueForReview(m, now)), [memos, now]);
  useEffect(() => {
    if (loaded) syncDueMemosToNative(palaceDueMemos);
  }, [loaded, palaceDueMemos]);

  // 저장 방식은 다른 화면과 동일: 로컬 state를 먼저 갱신하고 그 카드 하나만 updateItem.
  const onAnswer = (memo: Memo, correct: boolean) => {
    const reviewedAt = Date.now();
    const updated = correct ? markLeitnerCorrect(memo, reviewedAt) : markLeitnerWrong(memo, reviewedAt);
    setMemos((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    updateItem(STORAGE_KEYS.MEMOS, updated);
  };

  const remaining = queue
    .filter((id) => !answeredIds.has(id))
    .map((id) => memos.find((m) => m.id === id))
    .filter((m): m is Memo => m !== undefined);
  const current = remaining[0];
  const doneCount = queue.length - remaining.length;

  const answer = (correct: boolean) => {
    if (!current) return;
    onAnswer(current, correct);
    // "모름"은 nextReviewAt을 지금으로 되돌리므로, 열 때 고정한 now로는 대시보드에서 오늘 복습
    // 대상으로 안 잡힌다 — 답할 때마다 기준 시각을 갱신한다.
    setNow(Date.now());
    setAnsweredIds((prev) => new Set(prev).add(current.id));
    setStats((prev) =>
      correct ? { ...prev, correct: prev.correct + 1 } : { ...prev, wrong: prev.wrong + 1 }
    );
    setFlipped(false);
  };

  const shuffleRemaining = () => {
    setQueue((prev) => shuffleCards(prev.filter((id) => !answeredIds.has(id))));
    setAnsweredIds(new Set());
    setFlipped(false);
  };

  const card = current ? getFlashcard(current) : null;
  // 한 줄 카드처럼 뒤집을 필요가 없는 카드는 처음부터 답 버튼을 보여준다.
  const showAnswerButtons = flipped || (card !== null && !card.needsFlip);

  const dashboard = (
    <View style={styles.boxRow}>
      {BOXES.map((box) => {
        const total = cardsInBox(box).length;
        const due = dueInBox(box).length;
        const selected = box === selectedBox;
        return (
          <Pressable key={box} style={styles.boxTile} onPress={() => startBox(box, false, false)}>
            {/* 위가 열린 카드 상자: 뒷벽 → 꽂힌 카드(장수만큼 높아짐) → 앞판 순으로 겹쳐 그린다. */}
            <View style={styles.boxVisual}>
              <View style={[styles.boxBack, selected && styles.boxBackSelected]} />
              {Array.from({ length: Math.min(total, MAX_VISIBLE_CARDS) }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.boxCard,
                    { bottom: CARD_BASE_BOTTOM + i * CARD_STEP },
                    i === Math.min(total, MAX_VISIBLE_CARDS) - 1 && due > 0 && styles.boxCardDue,
                  ]}
                />
              ))}
              <View style={[styles.boxFront, selected && styles.boxFrontSelected]}>
                <View style={styles.boxLabel}>
                  <Text style={[styles.boxCount, selected && styles.boxCountSelected]}>{total}</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.boxName, selected && styles.boxNameSelected]}>Box {box}</Text>
            <Text style={[styles.boxDue, due > 0 && styles.boxDueActive]}>오늘 {due}</Text>
            <Text style={styles.boxInterval}>{intervalLabel(box)}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const sessionBar = (
    <View style={styles.sessionBar}>
      <Text style={styles.sessionText}>
        Box {selectedBox}
        {includeNotDue ? ' 전체' : ' 오늘 복습'} · {queue.length === 0 ? 0 : doneCount + (current ? 1 : 0)} / {queue.length}
      </Text>
      <Pressable
        style={[styles.shuffleButton, remaining.length < 2 && styles.shuffleButtonDisabled]}
        onPress={shuffleRemaining}
        disabled={remaining.length < 2}
        hitSlop={6}
      >
        <Ionicons name="shuffle" size={16} color={remaining.length < 2 ? colors.border : colors.primary} />
        <Text style={[styles.shuffleText, remaining.length < 2 && styles.shuffleTextDisabled]}>섞기</Text>
      </Pressable>
    </View>
  );

  const renderEmpty = () => {
    const totalInBox = cardsInBox(selectedBox).length;
    const finishedSession = queue.length > 0;
    return (
      <View style={styles.empty}>
        <Ionicons name="checkmark-circle-outline" size={48} color={colors.subtext} />
        <Text style={styles.emptyText}>
          {finishedSession
            ? `이번 복습 완료 · 알고 있음 ${stats.correct} / 모름 ${stats.wrong}`
            : totalInBox === 0
              ? `Box ${selectedBox}에 카드가 없어요`
              : `Box ${selectedBox}에 오늘 복습할 카드가 없어요`}
        </Text>
        {totalInBox > 0 && (
          <Pressable style={styles.secondaryButton} onPress={() => startBox(selectedBox, true, true)}>
            <Text style={styles.secondaryButtonText}>
              {finishedSession ? '이 박스 다시 섞어서 복습' : '이 박스 카드 미리 복습하기'}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  if (!loaded) return <View style={styles.container} />;

  return (
    <ResponsiveScreenContainer>
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>라이트너 박스</Text>
      </View>

      {dashboard}
      {sessionBar}

      {!current ? (
        renderEmpty()
      ) : (
        <ScrollView
          style={styles.deck}
          contentContainerStyle={styles.cardWrap}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={[styles.card, { backgroundColor: current.color || colors.card }]}
            onPress={() => card?.needsFlip && setFlipped((prev) => !prev)}
          >
            <Text style={styles.sideLabel}>{!card?.needsFlip ? '카드' : flipped ? '답' : '질문'}</Text>
            {flipped ? (
              <>
                {current.imageUris && current.imageUris.length > 0 && (
                  <MemoImage uris={current.imageUris} maxHeight={260} />
                )}
                {card?.answerText !== undefined ? (
                  <>
                    <Text style={styles.answerQuestion}>{card.question}</Text>
                    <MemoBody memo={{ text: card.answerText, noteType: 'text' }} textStyle={styles.cardText} />
                  </>
                ) : (
                  <MemoBody memo={current} textStyle={styles.cardText} />
                )}
                {current.tags && current.tags.length > 0 && (
                  <View style={styles.tagRow}>
                    {current.tags.map((tag) => (
                      <View key={tag} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={[styles.questionText, card?.isHint && styles.hintText]}>
                  {card?.question || '(내용 없음)'}
                </Text>
                {card?.needsFlip && <Text style={styles.flipHint}>눌러서 뒤집기</Text>}
              </>
            )}
          </Pressable>

          {showAnswerButtons ? (
            <View style={styles.cardActionRow}>
              <Pressable style={styles.wrongButton} onPress={() => answer(false)}>
                <Text style={styles.wrongButtonText}>모름</Text>
              </Pressable>
              <Pressable style={styles.correctButton} onPress={() => answer(true)}>
                <Text style={styles.correctButtonText}>알고 있음</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.cardActionRow}>
              <Pressable style={styles.secondaryButton} onPress={() => setFlipped(true)}>
                <Text style={styles.secondaryButtonText}>답 보기</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </View>
    </ResponsiveScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // 다른 탭(지식창고/오늘)과 같은 큰 제목 헤더.
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
  boxRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  boxTile: {
    flex: 1,
    alignItems: 'center',
  },
  boxVisual: {
    width: '100%',
    height: BOX_VISUAL_HEIGHT,
    marginBottom: 6,
  },
  boxBack: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    bottom: 0,
    height: BOX_FRONT_HEIGHT + 16,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: colors.subtext + '66',
  },
  boxBackSelected: {
    backgroundColor: colors.primary + '99',
  },
  boxCard: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    height: 14,
    borderRadius: 2,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boxCardDue: {
    borderColor: colors.primary,
    borderTopWidth: 3,
  },
  boxFront: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOX_FRONT_HEIGHT,
    borderRadius: 6,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    backgroundColor: colors.border,
    borderTopWidth: 4,
    borderTopColor: colors.subtext,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFrontSelected: {
    backgroundColor: colors.primary,
    borderTopColor: colors.text,
  },
  boxLabel: {
    minWidth: 30,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  boxName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.subtext,
  },
  boxNameSelected: {
    color: colors.primary,
  },
  boxCount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  boxCountSelected: {
    color: colors.primary,
  },
  boxDue: {
    fontSize: 11,
    color: colors.subtext,
  },
  boxDueActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  boxInterval: {
    fontSize: 10,
    color: colors.subtext,
    marginTop: 2,
  },
  sessionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sessionText: {
    fontSize: 13,
    color: colors.subtext,
    fontWeight: '600',
  },
  shuffleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shuffleButtonDisabled: {
    opacity: 0.6,
  },
  shuffleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  shuffleTextDisabled: {
    color: colors.border,
  },
  deck: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  emptyText: {
    color: colors.subtext,
    fontSize: 15,
    textAlign: 'center',
  },
  cardWrap: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    minHeight: 300,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  sideLabel: {
    position: 'absolute',
    top: 14,
    left: 18,
    fontSize: 12,
    fontWeight: '600',
    color: colors.subtext,
  },
  questionText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 30,
    textAlign: 'center',
  },
  hintText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.subtext,
  },
  answerQuestion: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.subtext,
    marginBottom: 10,
  },
  flipHint: {
    marginTop: 16,
    fontSize: 12,
    color: colors.subtext,
    textAlign: 'center',
  },
  cardText: {
    fontSize: 20,
    color: colors.text,
    lineHeight: 28,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  tagChip: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagChipText: {
    fontSize: 12,
    color: colors.subtext,
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  secondaryButton: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  wrongButton: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  wrongButtonText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 15,
  },
  correctButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  correctButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
