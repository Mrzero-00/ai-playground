import { addRecurrence, toDateKey, todayKey } from './date';
import type { Chore, ChoreHistory } from './types';

export interface ScheduledChore {
  chore: Chore;
  date: string;
  completed: boolean;
}

export interface DaySchedule {
  date: string;
  items: ScheduledChore[];
  completedCount: number;
  totalCount: number;
  completionRate: number | null;
}

function createdDate(chore: Chore): string {
  return chore.scheduleAnchorDate ?? toDateKey(new Date(chore.createdAt));
}

function completedOn(history: ChoreHistory[], choreId: string, date: string): boolean {
  return history.some((entry) =>
    entry.choreId === choreId &&
    entry.action === 'completed' &&
    (entry.scheduledFor ?? toDateKey(new Date(entry.performedAt))) === date,
  );
}

export function occurrencesInRange(chore: Chore, from: string, to: string): string[] {
  if (!chore.enabled || from > to) return [];
  const dates: string[] = [];
  let cursor = createdDate(chore);
  let guard = 0;

  while (cursor < from && guard < 10000) {
    cursor = addRecurrence(cursor, chore.recurrence);
    guard += 1;
  }
  while (cursor <= to && guard < 10000) {
    dates.push(cursor);
    cursor = addRecurrence(cursor, chore.recurrence);
    guard += 1;
  }
  return dates;
}

export function buildSchedule(
  chores: Chore[],
  history: ChoreHistory[],
  from: string,
  to: string,
): Map<string, DaySchedule> {
  const schedule = new Map<string, DaySchedule>();

  for (const chore of chores) {
    for (const date of occurrencesInRange(chore, from, to)) {
      const day = schedule.get(date) ?? {
        date,
        items: [],
        completedCount: 0,
        totalCount: 0,
        completionRate: null,
      };
      const completed = completedOn(history, chore.id, date);
      day.items.push({ chore, date, completed });
      day.totalCount += 1;
      if (completed) day.completedCount += 1;
      schedule.set(date, day);
    }
  }

  const today = todayKey();
  for (const day of schedule.values()) {
    if (day.date <= today && day.totalCount > 0) {
      day.completionRate = Math.round((day.completedCount / day.totalCount) * 100);
    }
  }
  return schedule;
}
