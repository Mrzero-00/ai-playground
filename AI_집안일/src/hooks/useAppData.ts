import { useEffect, useMemo, useRef, useState } from 'react';
import { addRecurrence, isDue, todayKey, toDateKey } from '../domain/date';
import { isCoreRecommendation, previewAllRecommendedChores, recommendationPriority, recommendedChores } from '../domain/recommendations';
import type { AppData, Chore, Home, HomeProfile, LaborAssessment, NotificationSettings, Recurrence, SupplyItem } from '../domain/types';
import { createInitialAppData, loadAppData, makeInviteCode, saveAppData } from '../data/storage';
import { deleteRemoteAccount, joinRemoteHome, loadRemoteState, saveRemoteState } from '../data/remote';
import { automaticallyAllocateChores } from '../domain/laborAllocation';
import { supplyProjection } from '../domain/supplies';
import { guideForChore } from '../domain/choreGuides';

export type SyncStatus = 'loading' | 'synced' | 'saving' | 'offline' | 'error';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function synchronizeRecommendations(home: Pick<Home, 'chores' | 'profile' | 'recommendationPreferences' | 'supplies'>): Chore[] {
  if (!home.profile) return home.chores;
  const supplyByChoreId = new Map((home.supplies ?? []).map((item) => [`supply-chore-${item.id}`, item]));
  const existing = home.chores.map((chore) => {
    const supply = supplyByChoreId.get(chore.id);
    return supply ? { ...chore, title: `${supply.name} ${supply.purchaseQuantity}${supply.unit} 구매하기` } : chore;
  });
  const profile = home.profile;
  const uniqueExisting = [...new Map(existing.map((chore) => [chore.id, chore])).values()];
  const recommended = recommendedChores(profile);
  const recommendedIds = new Set(recommended.map((chore) => chore.id));
  const activeIds = new Set((home.recommendationPreferences ?? [])
    .filter((preference) => preference.status === 'active')
    .map((preference) => preference.templateId));
  const retained = uniqueExisting.filter((chore) => chore.isCustom || activeIds.has(chore.id) || (recommendedIds.has(chore.id) && isCoreRecommendation(chore.id)));
  const retainedIds = new Set(retained.map((chore) => chore.id));
  const hiddenIds = new Set((home.recommendationPreferences ?? [])
    .filter((preference) => preference.status === 'dismissed' || (preference.snoozedUntil ?? '') > todayKey())
    .map((preference) => preference.templateId));
  const additions = recommended.filter((chore) => isCoreRecommendation(chore.id) && !retainedIds.has(chore.id) && !hiddenIds.has(chore.id));
  const synchronized = [...retained, ...additions];
  const cookingIndex = synchronized.findIndex((chore) => chore.id === 'recommended-cook-meal');
  const dishesIndex = synchronized.findIndex((chore) => chore.id === 'recommended-dishes');
  if (cookingIndex >= 0 && dishesIndex >= 0 && cookingIndex !== dishesIndex + 1) {
    const [cooking] = synchronized.splice(cookingIndex, 1);
    const nextDishesIndex = synchronized.findIndex((chore) => chore.id === 'recommended-dishes');
    synchronized.splice(nextDishesIndex + 1, 0, cooking);
  }
  return synchronized;
}

export function useAppData() {
  const [data, setData] = useState<AppData>(loadAppData);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [syncError, setSyncError] = useState<string | null>(null);
  const remoteReady = useRef(false);
  const skipNextRemoteSave = useRef(false);
  const latestData = useRef(data);

  useEffect(() => {
    latestData.current = data;
    saveAppData(data);
  }, [data]);

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
    const snapshot = data;
    const timer = window.setTimeout(() => {
      saveRemoteState(snapshot)
        .then((saved) => {
          if (latestData.current === snapshot) {
            skipNextRemoteSave.current = true;
            latestData.current = saved;
            setData(saved);
          } else {
            const revisions = new Map(saved.homes.map((home) => [home.id, home.syncRevision]));
            setData((current) => ({
              ...current,
              homes: current.homes.map((home) => revisions.has(home.id)
                ? { ...home, syncRevision: revisions.get(home.id) }
                : home),
            }));
          }
          setSyncStatus('synced');
          setSyncError(null);
        })
        .catch((error: unknown) => {
          setSyncStatus('error');
          setSyncError(error instanceof Error
            ? error.message
            : '변경 내용을 저장하지 못했어요.');
        });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    if (syncStatus !== 'synced' || !remoteReady.current) return;
    let cancelled = false;
    const refresh = () => {
      if (document.hidden || latestData.current !== data) return;
      loadRemoteState()
        .then((remote) => {
          if (cancelled || latestData.current !== data) return;
          skipNextRemoteSave.current = true;
          latestData.current = remote;
          setData(remote);
          setSyncError(null);
        })
        .catch(() => {
          if (!cancelled) setSyncStatus('offline');
        });
    };
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [data, syncStatus]);

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
    const synchronized = synchronizeRecommendations(activeHome);
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

  const recommendationCandidates = useMemo(() => {
    if (!activeHome?.profile) return [];
    const existingIds = new Set(activeHome.chores.map((chore) => chore.id));
    const hiddenIds = new Set((activeHome.recommendationPreferences ?? [])
      .filter((preference) => preference.status === 'dismissed' || (preference.snoozedUntil ?? '') > todayKey())
      .map((preference) => preference.templateId));
    return recommendedChores(activeHome.profile)
      .filter((chore) => !isCoreRecommendation(chore.id) && !existingIds.has(chore.id) && !hiddenIds.has(chore.id))
      .sort((a, b) => recommendationPriority(a, activeHome.profile!) - recommendationPriority(b, activeHome.profile!))
      .slice(0, 8);
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
        supplies: [],
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

  async function refreshRemoteState() {
    setSyncStatus('loading');
    try {
      const remote = await loadRemoteState();
      skipNextRemoteSave.current = true;
      remoteReady.current = true;
      latestData.current = remote;
      setData(remote);
      setSyncStatus('synced');
      setSyncError(null);
    } catch (error) {
      remoteReady.current = false;
      setSyncStatus('offline');
      setSyncError(error instanceof Error ? error.message : '동기화 서버에 연결하지 못했어요.');
    }
  }

  async function deleteAccount() {
    await deleteRemoteAccount();
    const initial = createInitialAppData();
    remoteReady.current = false;
    skipNextRemoteSave.current = true;
    latestData.current = initial;
    setData(initial);
    setSyncStatus('offline');
    setSyncError(null);
  }

  function saveProfile(profile: HomeProfile) {
    updateActiveHome((home) => {
      const updated = { ...home, profile };
      return { ...updated, chores: synchronizeRecommendations(updated) };
    });
  }

  function updateHomeSettings(name: string, emoji: string, profile: HomeProfile, taskViewMode: 'todo' | 'quest') {
    updateActiveHome((home) => {
      const updated = {
        ...home,
        name: name.trim() || home.name,
        emoji,
        taskViewMode,
        profile,
      };
      return { ...updated, chores: synchronizeRecommendations(updated) };
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

  function addCustomChore(input: Pick<Chore, 'title' | 'category' | 'icon' | 'recurrence' | 'notificationEnabled' | 'notificationTime'>) {
    const chore: Chore = {
      id: makeId('custom'),
      ...input,
      title: input.title.trim(),
      createdAt: new Date().toISOString(),
      scheduleAnchorDate: todayKey(),
      nextDueDate: todayKey(),
      isCustom: true,
      enabled: true,
    };
    updateActiveHome((home) => ({ ...home, chores: [...home.chores, chore] }));
  }

  function updateCustomChore(choreId: string, input: Pick<Chore, 'title' | 'category' | 'icon' | 'recurrence' | 'notificationEnabled' | 'notificationTime'>) {
    updateActiveHome((home) => ({
      ...home,
      chores: home.chores.map((chore) => chore.id === choreId && chore.isCustom
        ? { ...chore, ...input, title: input.title.trim() }
        : chore),
    }));
  }

  function completeChore(choreId: string) {
    updateActiveHome((home) => {
      const chore = home.chores.find((item) => item.id === choreId);
      if (!chore) return home;
      const alreadyCompletedToday = home.history.some((entry) =>
        entry.choreId === choreId &&
        entry.action === 'completed' &&
        toDateKey(new Date(entry.performedAt)) === todayKey(),
      );
      if (alreadyCompletedToday) return home;
      const supplyId = choreId.startsWith('supply-chore-') ? choreId.slice('supply-chore-'.length) : null;
      const purchasedSupply = supplyId ? (home.supplies ?? []).find((item) => item.id === supplyId) : null;
      const updatedSupply = purchasedSupply ? { ...purchasedSupply, purchaseDate: todayKey(), updatedAt: new Date().toISOString() } : null;
      const nextSupplyCheck = updatedSupply ? supplyProjection(updatedSupply).checkDate : null;
      return {
        ...home,
        supplies: updatedSupply ? (home.supplies ?? []).map((item) => item.id === updatedSupply.id ? updatedSupply : item) : home.supplies,
        chores: home.chores.map((item) => item.id === choreId ? { ...item, nextDueDate: nextSupplyCheck ?? addRecurrence(todayKey(), item.recurrence) } : item),
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

  function acceptRecommendation(choreId: string, recurrence?: Recurrence) {
    updateActiveHome((home) => {
      if (!home.profile || home.chores.some((chore) => chore.id === choreId)) return home;
      const candidate = recommendedChores(home.profile).find((chore) => chore.id === choreId);
      if (!candidate) return home;
      return {
        ...home,
        chores: [...home.chores, { ...candidate, recurrence: recurrence ?? candidate.recurrence }],
        recommendationPreferences: [
          ...(home.recommendationPreferences ?? []).filter((item) => item.templateId !== choreId),
          { templateId: choreId, status: 'active', updatedAt: new Date().toISOString() },
        ],
      };
    });
  }

  function dismissRecommendation(choreId: string, reason: 'not-applicable' | 'duplicate' = 'not-applicable') {
    updateActiveHome((home) => ({
      ...home,
      chores: home.chores.filter((chore) => chore.id !== choreId || chore.isCustom),
      recommendationPreferences: [
        ...(home.recommendationPreferences ?? []).filter((item) => item.templateId !== choreId),
        { templateId: choreId, status: 'dismissed', reason, updatedAt: new Date().toISOString() },
      ],
    }));
  }

  function snoozeRecommendation(choreId: string) {
    const until = new Date();
    until.setDate(until.getDate() + 30);
    updateActiveHome((home) => ({
      ...home,
      recommendationPreferences: [
        ...(home.recommendationPreferences ?? []).filter((item) => item.templateId !== choreId),
        { templateId: choreId, status: 'snoozed', reason: 'not-now', snoozedUntil: toDateKey(until), updatedAt: new Date().toISOString() },
      ],
    }));
  }

  function updateChoreRecurrence(choreId: string, recurrence: Recurrence) {
    updateActiveHome((home) => ({ ...home, chores: home.chores.map((chore) => chore.id === choreId ? { ...chore, recurrence } : chore) }));
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

  function assignChoreExecutor(choreId: string, executorMemberId?: string) {
    updateActiveHome((home) => ({
      ...home,
      chores: home.chores.map((chore) => chore.id === choreId
        ? { ...chore, assignedMemberId: executorMemberId || undefined, executorMemberId: executorMemberId || undefined }
        : chore),
    }));
  }

  function addSupplyItem(input: Omit<SupplyItem, 'id' | 'updatedAt'>) {
    const item: SupplyItem = { ...input, id: makeId('supply'), updatedAt: new Date().toISOString() };
    const projection = supplyProjection(item);
    const chore: Chore = { id: `supply-chore-${item.id}`, title: `${item.name} ${item.purchaseQuantity}${item.unit} 구매하기`, category: 'living', recurrence: { interval: projection.daysUntilSafetyStock, unit: 'day' }, createdAt: new Date().toISOString(), scheduleAnchorDate: item.purchaseDate, nextDueDate: projection.checkDate, isCustom: true, enabled: true };
    updateActiveHome((home) => ({ ...home, supplies: [...(home.supplies ?? []), item], chores: [...home.chores, chore] }));
  }

  function recordSupplyPurchase(itemId: string, purchaseDate: string, purchaseQuantity: number) {
    updateActiveHome((home) => {
      const supplies = (home.supplies ?? []).map((item) => item.id === itemId ? { ...item, purchaseDate, purchaseQuantity, updatedAt: new Date().toISOString() } : item);
      const item = supplies.find((supply) => supply.id === itemId);
      if (!item) return home;
      const projection = supplyProjection(item);
      return { ...home, supplies, chores: home.chores.map((chore) => chore.id === `supply-chore-${item.id}` ? { ...chore, title: `${item.name} ${item.purchaseQuantity}${item.unit} 구매하기`, recurrence: { interval: projection.daysUntilSafetyStock, unit: 'day' }, scheduleAnchorDate: purchaseDate, nextDueDate: projection.checkDate } : chore) };
    });
  }

  function removeSupplyItem(itemId: string) {
    updateActiveHome((home) => ({ ...home, supplies: (home.supplies ?? []).filter((item) => item.id !== itemId), chores: home.chores.filter((chore) => chore.id !== `supply-chore-${itemId}`) }));
  }

  function ensureDemoSupply() {
    updateActiveHome((home) => {
      const existing = (home.supplies ?? []).find((item) => item.name === '테스트 휴지');
      const item: SupplyItem = existing ?? {
        id: 'demo-supply-toilet-paper',
        name: '테스트 휴지',
        unit: '롤',
        purchaseDate: toDateKey(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)),
        purchaseQuantity: 12,
        weeklyUsage: 3,
        safetyStock: 3,
        reminderDaysBefore: 7,
        updatedAt: new Date().toISOString(),
      };
      const choreId = `supply-chore-${item.id}`;
      const choreExists = home.chores.some((chore) => chore.id === choreId);
      const demoCompleted = home.history.some((entry) => entry.choreId === choreId && entry.action === 'completed');
      if (existing && choreExists) return { ...home, chores: home.chores.map((chore) => chore.id === choreId ? { ...chore, title: `${item.name} ${item.purchaseQuantity}${item.unit} 구매하기`, nextDueDate: demoCompleted ? chore.nextDueDate : todayKey(), enabled: true } : chore) };
      const chore: Chore = { id: choreId, title: `${item.name} ${item.purchaseQuantity}${item.unit} 구매하기`, category: 'living', recurrence: { interval: supplyProjection(item).daysUntilSafetyStock, unit: 'day' }, createdAt: new Date().toISOString(), scheduleAnchorDate: item.purchaseDate, nextDueDate: todayKey(), isCustom: true, enabled: true };
      return { ...home, supplies: existing ? home.supplies : [...(home.supplies ?? []), item], chores: choreExists ? home.chores : [...home.chores, chore] };
    });
  }

  function ensureDemoGuideChores() {
    updateActiveHome((home) => {
      if (!home.profile) return home;
      const candidates = previewAllRecommendedChores().filter((chore) => guideForChore(chore.title));
      const demoIds = new Set(candidates.map((chore) => chore.id));
      const existingIds = new Set(home.chores.map((chore) => chore.id));
      const chores = home.chores.map((chore) => demoIds.has(chore.id) ? { ...chore, nextDueDate: todayKey(), enabled: true } : chore);
      for (const candidate of candidates) if (!existingIds.has(candidate.id)) chores.push({ ...candidate, nextDueDate: todayKey(), scheduleAnchorDate: todayKey() });
      const recommendationPreferences = [
        ...(home.recommendationPreferences ?? []).filter((item) => !demoIds.has(item.templateId)),
        ...candidates.map((chore) => ({ templateId: chore.id, status: 'active' as const, updatedAt: new Date().toISOString() })),
      ];
      return { ...home, chores, recommendationPreferences };
    });
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

  return { data, activeHome, dueChores, recommendationCandidates, syncStatus, syncError, refreshRemoteState, deleteAccount, createHome, selectHome, joinHomeByInviteCode, saveProfile, updateHomeSettings, updateUserName, addCustomChore, updateCustomChore, completeChore, undoTodayCompletion, toggleChore, removeCustomChore, acceptRecommendation, dismissRecommendation, snoozeRecommendation, updateChoreRecurrence, updateNotifications, saveLaborAssessment, assignChoreExecutor, setSharedAssignmentMode, autoAssignChores, addSupplyItem, recordSupplyPurchase, removeSupplyItem, ensureDemoSupply, ensureDemoGuideChores };
}
