import { buildSchedule } from './schedule';
import { endOfMonthKey, startOfMonthKey, todayKey, toDateKey } from './date';
import type { Chore, ChoreCategory, ChoreHistory, HomeMember } from './types';

export interface MemberContribution {
  userId: string;
  name: string;
  count: number;
  share: number;
}

export interface CategoryContribution {
  category: ChoreCategory;
  count: number;
}

export interface HomeAnalytics {
  monthCompletionRate: number;
  completedThisMonth: number;
  scheduledUntilToday: number;
  currentStreak: number;
  memberContributions: MemberContribution[];
  categoryContributions: CategoryContribution[];
  recentHistory: ChoreHistory[];
}

export function calculateHomeAnalytics(
  chores: Chore[],
  history: ChoreHistory[],
  members: HomeMember[],
  now = new Date(),
): HomeAnalytics {
  const monthStart = startOfMonthKey(now);
  const monthEnd = endOfMonthKey(now);
  const today = todayKey();
  const schedule = buildSchedule(chores, history, monthStart, monthEnd);
  const elapsedDays = [...schedule.values()].filter((day) => day.date <= today);
  const scheduledUntilToday = elapsedDays.reduce((sum, day) => sum + day.totalCount, 0);
  const completedScheduled = elapsedDays.reduce((sum, day) => sum + day.completedCount, 0);
  const monthCompletionRate = scheduledUntilToday
    ? Math.round((completedScheduled / scheduledUntilToday) * 100)
    : 0;

  const monthlyCompletions = history.filter((entry) =>
    entry.action === 'completed' && toDateKey(new Date(entry.performedAt)) >= monthStart,
  );
  const countsByUser = new Map<string, number>();
  const countsByCategory = new Map<ChoreCategory, number>();
  const choreCategory = new Map(chores.map((chore) => [chore.id, chore.category]));

  for (const entry of monthlyCompletions) {
    countsByUser.set(entry.performedByUserId, (countsByUser.get(entry.performedByUserId) ?? 0) + 1);
    const category = choreCategory.get(entry.choreId) ?? 'etc';
    countsByCategory.set(category, (countsByCategory.get(category) ?? 0) + 1);
  }

  const totalContributions = monthlyCompletions.length;
  const memberNames = new Map(members.map((member) => [member.userId, member.displayName]));
  const memberContributions = [...countsByUser.entries()]
    .map(([userId, count]) => ({
      userId,
      name: memberNames.get(userId) ?? monthlyCompletions.find((entry) => entry.performedByUserId === userId)?.performedByName ?? '알 수 없음',
      count,
      share: totalContributions ? Math.round((count / totalContributions) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const categoryContributions = [...countsByCategory.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  let currentStreak = 0;
  const cursor = new Date(`${today}T12:00:00`);
  while (currentStreak < 366) {
    const key = toDateKey(cursor);
    const day = schedule.get(key);
    if (day?.totalCount && day.completionRate === 100) currentStreak += 1;
    else if (day?.totalCount) break;
    cursor.setDate(cursor.getDate() - 1);
    if (key < monthStart) break;
  }

  return {
    monthCompletionRate,
    completedThisMonth: monthlyCompletions.length,
    scheduledUntilToday,
    currentStreak,
    memberContributions,
    categoryContributions,
    recentHistory: history.slice(0, 30),
  };
}
