import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Card, Chip, IconButton } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Stroke, offsetShadow } from '@/constants/theme';
import { MAX_OPEN_DAYS, MIN_OPEN_DAYS, OPEN_DAY_OPTIONS } from '@/domain/capsule';

const HOUR_OPTIONS = Array.from({ length: 16 }, (_, index) => 8 + index); // 08~23시 (PIT-02)
const MINUTE_OPTIONS = [0, 30] as const;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export type OpenAtValue = { day: Date; hour: number; minute: 0 | 30 };

export function openAtToDate(value: OpenAtValue) {
  return new Date(value.day.getFullYear(), value.day.getMonth(), value.day.getDate(), value.hour, value.minute);
}

export function defaultOpenAt(base: Date, days = 30): OpenAtValue {
  return { day: addDaysLocal(startOfDay(base), days), hour: 19, minute: 0 };
}

type Props = {
  /** 기준일. 이 날부터 30~180일째만 고를 수 있다. */
  base: Date;
  /** 이 시각보다 뒤여야 한다(넣기 마감). 없으면 날짜 범위만 본다. */
  notBefore?: Date;
  value: OpenAtValue;
  onChange: (value: OpenAtValue) => void;
};

/** 여는 날짜(달력)와 시각(시·분 셀렉트). 만들기와 닫기 화면이 같이 쓴다. */
export function OpenAtPicker({ base, notBefore, value, onChange }: Props) {
  const today = startOfDay(base);
  const minDay = later(addDaysLocal(today, MIN_OPEN_DAYS), notBefore ? startOfDay(notBefore) : null);
  const maxDay = addDaysLocal(today, MAX_OPEN_DAYS);
  const [month, setMonth] = useState<Date>(() => new Date(value.day.getFullYear(), value.day.getMonth(), 1));
  const [quick, setQuick] = useState<number>(30);
  const cells = monthCells(month);

  function pickQuick(days: number) {
    const next = later(addDaysLocal(today, days), minDay);
    setQuick(days);
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    onChange({ ...value, day: next });
  }

  return (
    <View style={styles.root}>
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
            const selected = sameDay(cell, value.day);
            return (
              <Pressable
                key={cell.toISOString()}
                accessibilityRole="button"
                accessibilityState={{ disabled, selected }}
                disabled={disabled}
                onPress={() => {
                  setQuick(0);
                  onChange({ ...value, day: cell });
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
            <Picker selectedValue={value.hour} onValueChange={(hour) => onChange({ ...value, hour: Number(hour) })} accessibilityLabel="시" style={styles.picker} itemStyle={styles.pickerItem}>
              {HOUR_OPTIONS.map((hour) => (
                <Picker.Item key={hour} label={`${String(hour).padStart(2, '0')}시`} value={hour} />
              ))}
            </Picker>
          </View>
          <View style={[styles.pickerBox, offsetShadow(3)]}>
            <Picker selectedValue={value.minute} onValueChange={(minute) => onChange({ ...value, minute: Number(minute) === 30 ? 30 : 0 })} accessibilityLabel="분" style={styles.picker} itemStyle={styles.pickerItem}>
              {MINUTE_OPTIONS.map((minute) => (
                <Picker.Item key={minute} label={`${String(minute).padStart(2, '0')}분`} value={minute} />
              ))}
            </Picker>
          </View>
        </View>
      </View>
    </View>
  );
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDaysLocal(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function later(a: Date, b: Date | null) {
  return b && b > a ? b : a;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthCells(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) cells.push(new Date(month.getFullYear(), month.getMonth(), dayNumber));
  return cells;
}

const styles = StyleSheet.create({
  root: { gap: Spacing.md },
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
  pickerBox: { flex: 1, borderRadius: Radius.md, backgroundColor: Colors.white, borderWidth: Stroke.regular, borderColor: Colors.ink, overflow: 'hidden', justifyContent: 'center', minHeight: 52, paddingHorizontal: 12 },
  picker: { width: '100%', minHeight: 48, color: Colors.ink, fontFamily: Fonts.display, fontSize: 16, backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 6 },
  pickerItem: { fontFamily: Fonts.display, fontSize: 18, color: Colors.ink },
});
