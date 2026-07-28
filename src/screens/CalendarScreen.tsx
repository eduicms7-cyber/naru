import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadItems, saveItems } from '../storage/storage';
import { STORAGE_KEYS, ScheduleEvent } from '../types';
import { colors } from '../theme/colors';
import { getMonthMatrix, toDateKey, WEEKDAY_LABELS } from '../utils/date';

export default function CalendarScreen() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState(toDateKey(today));
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const items = await loadItems<ScheduleEvent>(STORAGE_KEYS.SCHEDULES);
        setEvents(items);
        setLoaded(true);
      })();
    }, [])
  );

  const persist = useCallback((items: ScheduleEvent[]) => {
    setEvents(items);
    saveItems(STORAGE_KEYS.SCHEDULES, items);
  }, []);

  const weeks = useMemo(
    () => getMonthMatrix(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const eventDateKeys = useMemo(
    () => new Set(events.map((e) => e.date)),
    [events]
  );

  const selectedEvents = useMemo(
    () => events.filter((e) => e.date === selectedKey).sort((a, b) => a.createdAt - b.createdAt),
    [events, selectedKey]
  );

  const goToMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const addEvent = () => {
    const title = input.trim();
    if (!title) return;
    const newEvent: ScheduleEvent = {
      id: Date.now().toString(),
      date: selectedKey,
      title,
      createdAt: Date.now(),
    };
    persist([...events, newEvent]);
    setInput('');
  };

  const deleteEvent = (id: string) => {
    persist(events.filter((e) => e.id !== id));
  };

  if (!loaded) return <View style={styles.container} />;

  const todayKey = toDateKey(today);
  const [selYear, selMonth, selDay] = selectedKey.split('-').map(Number);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>캘린더</Text>
      </View>

      <View style={styles.monthNav}>
        <Pressable onPress={() => goToMonth(-1)} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {viewYear}년 {viewMonth + 1}월
        </Text>
        <Pressable onPress={() => goToMonth(1)} hitSlop={8}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text
            key={label}
            style={[
              styles.weekdayLabel,
              i === 0 && styles.sunday,
              i === 6 && styles.saturday,
            ]}
          >
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((date, di) => {
            if (!date) return <View key={di} style={styles.dayCell} />;
            const key = toDateKey(date);
            const isSelected = key === selectedKey;
            const isToday = key === todayKey;
            const hasEvent = eventDateKeys.has(key);
            return (
              <Pressable
                key={di}
                style={styles.dayCell}
                onPress={() => setSelectedKey(key)}
              >
                <View
                  style={[
                    styles.dayCircle,
                    isSelected && styles.dayCircleSelected,
                    isToday && !isSelected && styles.dayCircleToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      di === 0 && styles.sunday,
                      di === 6 && styles.saturday,
                      isSelected && styles.dayTextSelected,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </View>
                {hasEvent && <View style={styles.eventDot} />}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.divider} />

      <Text style={styles.selectedDateLabel}>
        {selMonth}월 {selDay}일 일정
      </Text>

      <FlatList
        style={styles.eventList}
        data={selectedEvents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.eventListContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>등록된 일정이 없어요</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.eventRow}>
            <View style={styles.eventDotInline} />
            <Text style={styles.eventText}>{item.title}</Text>
            <Pressable onPress={() => deleteEvent(item.id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.subtext} />
            </Pressable>
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="일정을 입력하세요"
          placeholderTextColor={colors.subtext}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={addEvent}
          returnKeyType="done"
        />
        <Pressable style={styles.addButton} onPress={addEvent}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
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
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 8,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    minWidth: 110,
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: colors.subtext,
    paddingVertical: 6,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: colors.primary,
  },
  dayCircleToday: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: 14,
    color: colors.text,
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sunday: {
    color: '#FF6B6B',
  },
  saturday: {
    color: colors.primary,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 10,
    marginHorizontal: 20,
  },
  selectedDateLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  eventList: {
    flex: 1,
  },
  eventListContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  emptyText: {
    color: colors.subtext,
    fontSize: 14,
    paddingVertical: 16,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 10,
  },
  eventDotInline: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  eventText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
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
