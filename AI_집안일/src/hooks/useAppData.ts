import { useEffect, useMemo, useState } from 'react';
import { addRecurrence, isDue, todayKey, toDateKey } from '../domain/date';
import { recommendedChores } from '../domain/recommendations';
import type { AppData, Chore, Home, HomeProfile, NotificationSettings, Recurrence } from '../domain/types';
import { loadAppData, makeInviteCode, saveAppData } from '../data/storage';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function syncRecommendedChores(existing: Chore[], profile: HomeProfile): Chore[] {
  const recommended = recommendedChores(profile);
  const recommendedIds = new Set(recommended.map((chore) => chore.id));
  const retained = existing.filter((chore) => chore.isCustom || recommendedIds.has(chore.id));
  const retainedIds = new Set(retained.map((chore) => chore.id));
  const additions = recommended.filter((chore) => !retainedIds.has(chore.id));
  return [...retained, ...additions];
}

export function useAppData() {
  const [data, setData] = useState<AppData>(loadAppData);

  useEffect(() => saveAppData(data), [data]);

  const activeHome = useMemo(
    () => data.homes.find((home) => home.id === data.activeHomeId) ?? null,
    [data.homes, data.activeHomeId],
  );
  const dueChores = useMemo(
    () => activeHome?.chores.filter((chore) => chore.enabled && isDue(chore.nextDueDate)) ?? [],
    [activeHome],
  );

  useEffect(() => {
    if (!activeHome?.profile) return;
    const synchronized = syncRecommendedChores(activeHome.chores, activeHome.profile);
    const currentIds = activeHome.chores.map((chore) => chore.id).join('|');
    const synchronizedIds = synchronized.map((chore) => chore.id).join('|');
    if (currentIds === synchronizedIds) return;
    setData((current) => ({
      ...current,
      homes: current.homes.map((home) =>
        home.id === activeHome.id ? { ...home, chores: synchronized } : home,
      ),
    }));
  }, [activeHome]);

  function updateActiveHome(update: (home: Home) => Home) {
    setData((current) => ({
      ...current,
      homes: current.homes.map((home) => home.id === current.activeHomeId ? update(home) : home),
    }));
  }

  function createHome(name: string, emoji = '🏠'): string {
    const homeId = makeId('home');
    setData((current) => {
      const now = new Date().toISOString();
      const home: Home = {
        id: homeId,
        name: name.trim() || '우리 집',
        emoji,
        taskViewMode: 'todo',
        inviteCode: makeInviteCode(),
        members: [{ id: makeId('member'), userId: current.user.id, displayName: current.user.displayName, role: 'owner', joinedAt: now }],
        profile: null,
        chores: [],
        history: [],
        createdAt: now,
      };
      return { ...current, homes: [...current.homes, home], activeHomeId: homeId };
    });
    return homeId;
  }

  function selectHome(homeId: string) {
    setData((current) => current.homes.some((home) => home.id === homeId)
      ? { ...current, activeHomeId: homeId }
      : current);
  }

  function joinHomeByInviteCode(inviteCode: string): string | null {
    const normalized = inviteCode.trim().toUpperCase();
    if (!normalized) return null;
    const existing = data.homes.find((home) => home.inviteCode === normalized);
    if (existing) {
      selectHome(existing.id);
      return existing.id;
    }

    // 서버가 없는 MVP에서는 초대 코드를 받은 집을 이 기기에 로컬 방으로 생성한다.
    const homeId = makeId('home');
    setData((current) => {
      const now = new Date().toISOString();
      const home: Home = {
        id: homeId,
        name: '초대받은 집',
        emoji: '🏡',
        taskViewMode: 'todo',
        inviteCode: normalized,
        members: [{ id: makeId('member'), userId: current.user.id, displayName: current.user.displayName, role: 'member', joinedAt: now }],
        profile: null,
        chores: [],
        history: [],
        createdAt: now,
      };
      return { ...current, homes: [...current.homes, home], activeHomeId: homeId };
    });
    return homeId;
  }

  function saveProfile(profile: HomeProfile) {
    updateActiveHome((home) => {
      return { ...home, profile, chores: syncRecommendedChores(home.chores, profile) };
    });
  }

  function updateHomeSettings(name: string, emoji: string, profile: HomeProfile, taskViewMode: 'todo' | 'quest') {
    updateActiveHome((home) => {
      return {
        ...home,
        name: name.trim() || home.name,
        emoji,
        taskViewMode,
        profile,
        chores: syncRecommendedChores(home.chores, profile),
      };
    });
  }

  function updateUserName(displayName: string) {
    const normalized = displayName.trim();
    if (!normalized) return;
    setData((current) => ({
      ...current,
      user: { ...current.user, displayName: normalized },
      homes: current.homes.map((home) => ({
        ...home,
        members: home.members.map((member) =>
          member.userId === current.user.id ? { ...member, displayName: normalized } : member,
        ),
      })),
    }));
  }

  function addCustomChore(title: string, recurrence: Recurrence) {
    const chore: Chore = { id: makeId('custom'), title: title.trim(), category: 'etc', recurrence, createdAt: new Date().toISOString(), scheduleAnchorDate: todayKey(), nextDueDate: todayKey(), isCustom: true, enabled: true };
    updateActiveHome((home) => ({ ...home, chores: [...home.chores, chore] }));
  }

  function completeChore(choreId: string) {
    updateActiveHome((home) => {
      const chore = home.chores.find((item) => item.id === choreId);
      if (!chore) return home;
      return {
        ...home,
        chores: home.chores.map((item) => item.id === choreId ? { ...item, nextDueDate: addRecurrence(todayKey(), item.recurrence) } : item),
        history: [{ id: makeId('history'), choreId, choreTitle: chore.title, action: 'completed', performedAt: new Date().toISOString(), scheduledFor: chore.nextDueDate, performedByUserId: data.user.id, performedByName: data.user.displayName }, ...home.history],
      };
    });
  }

  function undoTodayCompletion(choreId: string) {
    updateActiveHome((home) => {
      const completion = home.history.find((entry) =>
        entry.choreId === choreId &&
        entry.action === 'completed' &&
        entry.performedByUserId === data.user.id &&
        toDateKey(new Date(entry.performedAt)) === todayKey(),
      );
      if (!completion) return home;
      return {
        ...home,
        chores: home.chores.map((chore) =>
          chore.id === choreId
            ? { ...chore, nextDueDate: completion.scheduledFor ?? todayKey() }
            : chore,
        ),
        history: home.history.filter((entry) => entry.id !== completion.id),
      };
    });
  }

  function toggleChore(choreId: string) {
    updateActiveHome((home) => ({ ...home, chores: home.chores.map((chore) => chore.id === choreId ? { ...chore, enabled: !chore.enabled } : chore) }));
  }

  function removeCustomChore(choreId: string) {
    updateActiveHome((home) => ({ ...home, chores: home.chores.filter((chore) => !(chore.id === choreId && chore.isCustom)) }));
  }

  function updateNotifications(notifications: NotificationSettings) {
    setData((current) => ({ ...current, notifications }));
  }

  return { data, activeHome, dueChores, createHome, selectHome, joinHomeByInviteCode, saveProfile, updateHomeSettings, updateUserName, addCustomChore, completeChore, undoTodayCompletion, toggleChore, removeCustomChore, updateNotifications };
}
