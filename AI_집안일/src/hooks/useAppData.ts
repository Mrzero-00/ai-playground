import { useEffect, useMemo, useRef, useState } from 'react';
import { addRecurrence, isDue, todayKey, toDateKey } from '../domain/date';
import { recommendedChores } from '../domain/recommendations';
import type { AppData, Chore, Home, HomeProfile, LaborAssessment, NotificationSettings, Recurrence } from '../domain/types';
import { loadAppData, makeInviteCode, saveAppData } from '../data/storage';
import { joinRemoteHome, loadRemoteState, saveRemoteState } from '../data/remote';
import { automaticallyAllocateChores } from '../domain/laborAllocation';

export type SyncStatus = 'loading' | 'synced' | 'saving' | 'offline' | 'error';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function syncRecommendedChores(existing: Chore[], profile: HomeProfile): Chore[] {
  const uniqueExisting = [...new Map(existing.map((chore) => [chore.id, chore])).values()];
  const recommended = recommendedChores(profile);
  const recommendedIds = new Set(recommended.map((chore) => chore.id));
  const retained = uniqueExisting.filter((chore) => chore.isCustom || recommendedIds.has(chore.id));
  const retainedIds = new Set(retained.map((chore) => chore.id));
  const additions = recommended.filter((chore) => !retainedIds.has(chore.id));
  return [...retained, ...additions];
}

export function useAppData() {
  const [data, setData] = useState<AppData>(loadAppData);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [syncError, setSyncError] = useState<string | null>(null);
  const remoteReady = useRef(false);
  const skipNextRemoteSave = useRef(false);

  useEffect(() => saveAppData(data), [data]);

  useEffect(() => {
    let cancelled = false;
    const local = data;
    loadRemoteState()
      .then(async (remote) => {
        if (cancelled) return;
        const resolved = remote.homes.length === 0 && local.homes.length > 0
          ? await saveRemoteState(local)
          : remote;
        if (cancelled) return;
        skipNextRemoteSave.current = true;
        setData(resolved);
        remoteReady.current = true;
        setSyncStatus('synced');
        setSyncError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        remoteReady.current = false;
        setSyncStatus('offline');
        setSyncError(error instanceof Error ? error.message : '동기화 서버에 연결하지 못했어요.');
      });
    return () => { cancelled = true; };
    // 최초 로컬 스냅샷만 서버와 병합한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!remoteReady.current) return;
    if (skipNextRemoteSave.current) {
      skipNextRemoteSave.current = false;
      return;
    }
    setSyncStatus('saving');
    const timer = window.setTimeout(() => {
      saveRemoteState(data)
        .then(() => { setSyncStatus('synced'); setSyncError(null); })
        .catch((error: unknown) => {
          setSyncStatus('error');
          setSyncError(error instanceof Error ? error.message : '변경 내용을 저장하지 못했어요.');
        });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [data]);

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
        assignmentMode: 'shared',
        inviteCode: makeInviteCode(),
        members: [{ id: makeId('member'), userId: current.user.id, displayName: current.user.displayName, role: 'owner', joinedAt: now }],
        profile: null,
        chores: [],
        history: [],
        laborAssessments: [],
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

  async function joinHomeByInviteCode(inviteCode: string): Promise<string | null> {
    const normalized = inviteCode.trim().toUpperCase();
    if (!normalized) return null;
    const existing = data.homes.find((home) => home.inviteCode === normalized);
    if (existing) {
      selectHome(existing.id);
      return existing.id;
    }
    const joined = await joinRemoteHome(normalized);
    skipNextRemoteSave.current = true;
    remoteReady.current = true;
    setData(joined);
    setSyncStatus('synced');
    setSyncError(null);
    return joined.activeHomeId;
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

  function saveLaborAssessment(assessment: Omit<LaborAssessment, 'userId' | 'updatedAt'>) {
    updateActiveHome((home) => ({
      ...home,
      laborAssessments: [
        ...(home.laborAssessments ?? []).filter((item) => item.userId !== data.user.id),
        { ...assessment, userId: data.user.id, updatedAt: new Date().toISOString() },
      ],
    }));
  }

  function assignChoreRoles(choreId: string, plannerMemberId?: string, executorMemberId?: string) {
    updateActiveHome((home) => ({
      ...home,
      chores: home.chores.map((chore) => chore.id === choreId
        ? { ...chore, plannerMemberId: plannerMemberId || undefined, executorMemberId: executorMemberId || undefined }
        : chore),
    }));
  }

  function setSharedAssignmentMode() {
    updateActiveHome((home) => ({ ...home, assignmentMode: 'shared' }));
  }

  function autoAssignChores() {
    updateActiveHome((home) => ({
      ...home,
      assignmentMode: 'auto',
      chores: automaticallyAllocateChores(home.chores, home.members, home.laborAssessments ?? []),
    }));
  }

  return { data, activeHome, dueChores, syncStatus, syncError, createHome, selectHome, joinHomeByInviteCode, saveProfile, updateHomeSettings, updateUserName, addCustomChore, completeChore, undoTodayCompletion, toggleChore, removeCustomChore, updateNotifications, saveLaborAssessment, assignChoreRoles, setSharedAssignmentMode, autoAssignChores };
}
