import { Picker } from '@react-native-picker/picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Capsule } from '@/components/capsule';
import { Body, Button, Card, Chip, Content, IconButton, NavBar, Page, Title } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import { MAX_OPEN_DAYS, MIN_OPEN_DAYS, OPEN_DAY_OPTIONS, contributingMembers, formatKoreanDate, isValidOpenAt, totalItems } from '@/domain/capsule';
import { useCapsuleStore } from '@/state/capsule-store';

const HOUR_OPTIONS = Array.from({ length: 16 }, (_, index) => 8 + index); // 08~23시 (PIT-02)
const MINUTE_OPTIONS = [0, 30] as const;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function SealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCapsule, sealCapsule } = useCapsuleStore();
  const capsule = id ? getCapsule(id) : null;
  const today = useMemo(() => startOfDay(new Date()), []);
  const [quick, setQuick] = useState<number>(30);
  const [day, setDay] = useState<Date>(() => addDaysLocal(today, 30));
  const [month, setMonth] = useState<Date>(() => new Date(day.getFullYear(), day.getMonth(), 1));
  const [hour, setHour] = useState(19);
  const [minute, setMinute] = useState<(typeof MINUTE_OPTIONS)[number]>(0);

  if (!capsule) return null;

  const minDay = addDaysLocal(today, MIN_OPEN_DAYS);
  const maxDay = addDaysLocal(today, MAX_OPEN_DAYS);
  const openAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
  const valid = isValidOpenAt(new Date().toISOString(), openAt.toISOString());

  function pickQuick(days: number) {
    const next = addDaysLocal(today, days);
    setQuick(days);
    setDay(next);
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function seal() {
    if (!capsule || !sealCapsule(capsule.id, openAt.toISOString())) return;
    router.replace({ pathname: '/capsule/[id]', params: { id: capsule.id } });
  }

  const cells = monthCells(month);

  return (
    <Page>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <NavBar title="캡슐 닫기" />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Content style={styles.content}>
            <View style={styles.intro}>
              <Capsule state="closed" size={92} />
              <View style={styles.introCopy}>
                <Title size={24}>언제 다시 열까요?</Title>
                <Body size={12}>
                  닫는 날부터 {MIN_OPEN_DAYS}일에서 {MAX_OPEN_DAYS}일 사이. 한 번 닫으면 바꿀 수 없어요.
                </Body>
              </View>
            </View>

            <View style={styles.chips}>
              {OPEN_DAY_OPTIONS.map((days) => (
                <Chip key={days} label={`${days}일`} selected={quick === days} onPress={() => pickQuick(days)} style={styles.chip} />
              ))}
            </View>

            <Card shadow={false} style={styles.calendar}>
              <View style={styles.calendarHeader}>
                <Text style={styles.monthLabel}>
                  {month.getFullYear()}년 {month.getMonth() + 1}월
                </Text>
                <View style={styles.monthNav}>
                  <IconButton name="back" label="이전 달" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
                  <IconButton name="chevron" label="다음 달" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
                </View>
              </View>
              <View style={styles.grid}>
                {WEEKDAYS.map((weekday) => (
                  <Text key={weekday} style={styles.weekday}>
                    {weekday}
                  </Text>
                ))}
                {cells.map((cell, index) => {
                  if (!cell) return <View key={`blank-${index}`} style={styles.cell} />;
                  const disabled = cell < minDay || cell > maxDay;
                  const selected = sameDay(cell, day);
                  return (
                    <Pressable
                      key={cell.toISOString()}
                      accessibilityRole="button"
                      accessibilityState={{ disabled, selected }}
                      disabled={disabled}
                      onPress={() => {
                        setDay(cell);
                        setQuick(0);
                      }}
                      style={[styles.cell, selected && styles.cellSelected]}>
                      <Text style={[styles.cellLabel, disabled && styles.cellDisabled]}>{cell.getDate()}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <View style={styles.times}>
              <Body size={12}>여는 시간 · 08시부터 23시까지, 30분 단위</Body>
              <View style={styles.pickers}>
                <View style={[styles.pickerBox, offsetShadow(3)]}>
                  <Picker selectedValue={hour} onValueChange={(value) => setHour(Number(value))} accessibilityLabel="시" style={styles.picker} itemStyle={styles.pickerItem}>
                    {HOUR_OPTIONS.map((value) => (
                      <Picker.Item key={value} label={`${String(value).padStart(2, '0')}시`} value={value} />
                    ))}
                  </Picker>
                </View>
                <View style={[styles.pickerBox, offsetShadow(3)]}>
                  <Picker selectedValue={minute} onValueChange={(value) => setMinute(Number(value) === 30 ? 30 : 0)} accessibilityLabel="분" style={styles.picker} itemStyle={styles.pickerItem}>
                    {MINUTE_OPTIONS.map((value) => (
                      <Picker.Item key={value} label={`${String(value).padStart(2, '0')}분`} value={value} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>안에 든 것</Text>
              <Text style={styles.summaryValue}>
                {contributingMembers(capsule).length}명 · {totalItems(capsule)}개
              </Text>
            </View>
          </Content>
        </ScrollView>
        <Content style={styles.footer}>
          <Text style={styles.openAt}>
            <Text style={styles.openAtStrong}>{formatKoreanDate(openAt.toISOString(), true)}</Text>에 열려요
          </Text>
          <Button label="닫고 묻어두기" icon="lock" onPress={seal} disabled={!valid} />
        </Content>
      </SafeAreaView>
    </Page>
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDaysLocal(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthCells(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), dayNumber));
  }
  return cells;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { gap: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  introCopy: { flex: 1, gap: 4 },
  chips: { flexDirection: 'row', gap: Spacing.sm },
  chip: { flex: 1 },
  calendar: { gap: Spacing.sm, padding: 14, borderRadius: Radius.lg },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthLabel: { fontFamily: Fonts.display, fontSize: 16, color: Colors.ink },
  monthNav: { flexDirection: 'row', gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: Fonts.body, fontSize: 11, color: Colors.muted, paddingVertical: 2 },
  cell: { width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: Colors.sky, borderRadius: 20, borderWidth: Stroke.thin, borderColor: Colors.ink },
  cellLabel: { fontFamily: Fonts.display, fontSize: 14, color: Colors.ink },
  cellDisabled: { color: Colors.faint },
  times: { gap: Spacing.sm },
  pickers: { flexDirection: 'row', gap: Spacing.sm },
  pickerBox: { flex: 1, borderRadius: Radius.md, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink, overflow: 'hidden', justifyContent: 'center', minHeight: 52 },
  picker: { width: '100%', color: Colors.ink, fontFamily: Fonts.display, fontSize: 16, backgroundColor: 'transparent', borderWidth: 0 },
  pickerItem: { fontFamily: Fonts.display, fontSize: 18, color: Colors.ink },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: Colors.yellow, borderWidth: Stroke.thin, borderColor: Colors.ink },
  summaryLabel: { fontFamily: Fonts.body, fontSize: 13, color: Colors.ink },
  summaryValue: { fontFamily: Fonts.display, fontSize: 14, color: Colors.ink },
  footer: { gap: Spacing.sm, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  openAt: { fontFamily: Fonts.body, fontSize: 14, color: Colors.muted, textAlign: 'center' },
  openAtStrong: { fontFamily: Fonts.display, fontSize: 16, color: Colors.ink },
});
