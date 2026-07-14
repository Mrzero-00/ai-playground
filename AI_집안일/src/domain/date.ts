import type { Recurrence } from './types';

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addRecurrence(from: string, recurrence: Recurrence): string {
  const date = new Date(`${from}T12:00:00`);
  const { interval, unit } = recurrence;

  if (unit === 'day') date.setDate(date.getDate() + interval);
  if (unit === 'week') date.setDate(date.getDate() + interval * 7);
  if (unit === 'month') date.setMonth(date.getMonth() + interval);
  if (unit === 'year') date.setFullYear(date.getFullYear() + interval);

  return toDateKey(date);
}

export function isDue(dateKey: string, today = todayKey()): boolean {
  return dateKey <= today;
}

export function formatDueDate(dateKey: string): string {
  const today = todayKey();
  if (dateKey === today) return '오늘';
  if (dateKey < today) return '밀린 일';
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(
    new Date(`${dateKey}T12:00:00`),
  );
}

export function formatRecurrence(recurrence: Recurrence): string {
  const unitLabel = { day: '일', week: '주', month: '개월', year: '년' }[recurrence.unit];
  return recurrence.interval === 1
    ? recurrence.unit === 'day'
      ? '매일'
      : recurrence.unit === 'week'
        ? '매주'
        : recurrence.unit === 'month'
          ? '매월'
          : '매년'
    : `${recurrence.interval}${unitLabel}마다`;
}
