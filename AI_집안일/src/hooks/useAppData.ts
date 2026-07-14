import { useEffect, useMemo, useState } from 'react';
import { addRecurrence, isDue, todayKey } from '../domain/date';
import { recommendedChores } from '../domain/recommendations';
import type { AppData, Chore, HomeProfile, NotificationSettings, Recurrence } from '../domain/types';
import { loadAppData, saveAppData } from '../data/storage';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAppData() {
  const [data, setData] = useState<AppData>(loadAppData);

  useEffect(() => saveAppData(data), [data]);

  const dueChores = useMemo(
    () => data.chores.filter((chore) => chore.enabled && isDue(chore.nextDueDate)),
    [data.chores],
  );

  function saveProfile(profile: HomeProfile) {
    setData((current) => {
      const existingIds = new Set(current.chores.map((chore) => chore.id));
      const additions = recommendedChores(profile).filter((chore) => !existingIds.has(chore.id));
      return { ...current, profile, chores: [...current.chores, ...additions] };
    });
  }

  function addCustomChore(title: string, recurrence: Recurrence) {
    const chore: Chore = {
      id: makeId('custom'),
      title: title.trim(),
      category: 'etc',
      recurrence,
      createdAt: new Date().toISOString(),
      nextDueDate: todayKey(),
      isCustom: true,
      enabled: true,
    };
    setData((current) => ({ ...current, chores: [...current.chores, chore] }));
  }

  function completeChore(choreId: string) {
    setData((current) => {
      const chore = current.chores.find((item) => item.id === choreId);
      if (!chore) return current;
      return {
        ...current,
        chores: current.chores.map((item) =>
          item.id === choreId
            ? { ...item, nextDueDate: addRecurrence(todayKey(), item.recurrence) }
            : item,
        ),
        history: [
          { id: makeId('history'), choreId, choreTitle: chore.title, action: 'completed', performedAt: new Date().toISOString() },
          ...current.history,
        ],
      };
    });
  }

  function toggleChore(choreId: string) {
    setData((current) => ({
      ...current,
      chores: current.chores.map((chore) =>
        chore.id === choreId ? { ...chore, enabled: !chore.enabled } : chore,
      ),
    }));
  }

  function removeCustomChore(choreId: string) {
    setData((current) => ({
      ...current,
      chores: current.chores.filter((chore) => !(chore.id === choreId && chore.isCustom)),
    }));
  }

  function updateNotifications(notifications: NotificationSettings) {
    setData((current) => ({ ...current, notifications }));
  }

  return {
    data,
    dueChores,
    saveProfile,
    addCustomChore,
    completeChore,
    toggleChore,
    removeCustomChore,
    updateNotifications,
  };
}
