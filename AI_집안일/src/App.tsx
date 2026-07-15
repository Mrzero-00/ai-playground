import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BottomNavigation,
  ChoreManager,
  ChoreGuideModal,
  CustomChoreModal,
  HouseholdReport,
  HomeSettings,
  PersonalProfile,
  ProfileSetup,
  RecommendationReview,
  ScheduleCalendar,
  SharedHomeUI,
  SupplyPurchaseModal,
  TodayTasks,
  type Chore as ChoreView,
  type CustomChoreInput,
  type HouseholdProfile,
  type NavigationTab,
} from './components';
import { formatDueDate, formatRecurrence, todayKey, toDateKey } from './domain/date';
import { choreGuideById, guideForChore } from './domain/choreGuides';
import type { Chore, ChoreCategory, Recurrence } from './domain/types';
import { useAppData } from './hooks/useAppData';

const categoryMeta: Record<ChoreCategory, { icon: string; label: string }> = {
  cleaning: { icon: '🧹', label: '청소' },
  kitchen: { icon: '🧽', label: '주방' },
  laundry: { icon: '🧺', label: '세탁' },
  pet: { icon: '🐾', label: '반려동물' },
  living: { icon: '🏠', label: '생활' },
  etc: { icon: '✨', label: '기타' },
};

function toView(chore: Chore): ChoreView {
  const frequency =
    chore.recurrence.interval !== 1
      ? 'custom'
      : ({ day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' } as const)[chore.recurrence.unit];
  return {
    id: chore.id,
    title: chore.title,
    category: categoryMeta[chore.category].label,
    icon: categoryMeta[chore.category].icon,
    frequency,
    frequencyLabel: formatRecurrence(chore.recurrence),
    recurrenceGroup: ({ day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' } as const)[chore.recurrence.unit],
    dueLabel: formatDueDate(chore.nextDueDate),
    completed: false,
    isCustom: chore.isCustom,
    taskKind: chore.id.startsWith('supply-chore-') ? 'supply-purchase' : 'housework',
    guideId: guideForChore(chore.title)?.id,
  };
}

function recurrenceFromInput(input: CustomChoreInput): Recurrence {
  if (input.frequency === 'custom') return { interval: input.interval, unit: 'day' };
  return {
    interval: 1,
    unit: ({ daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' } as const)[input.frequency],
  };
}

function App() {
  const {
    data,
    activeHome,
    dueChores,
    recommendationCandidates,
    createHome,
    selectHome,
    joinHomeByInviteCode,
    syncStatus,
    syncError,
    saveProfile,
    updateHomeSettings,
    updateUserName,
    addCustomChore,
    completeChore,
    undoTodayCompletion,
    removeCustomChore,
    acceptRecommendation,
    dismissRecommendation,
    snoozeRecommendation,
    updateChoreRecurrence,
    updateNotifications,
    saveLaborAssessment,
    assignChoreExecutor,
    setSharedAssignmentMode,
    autoAssignChores,
    addSupplyItem,
    recordSupplyPurchase,
    removeSupplyItem,
    ensureDemoSupply,
    ensureDemoGuideChores,
  } = useAppData();
  const [activeTab, setActiveTab] = useState<NavigationTab>('today');
  const [isAddingChore, setIsAddingChore] = useState(false);
  const [isEditingHome, setIsEditingHome] = useState(false);
  const [purchasingSupplyId, setPurchasingSupplyId] = useState<string | null>(null);
  const [openGuideId, setOpenGuideId] = useState<string | null>(null);
  const demoSupplySeeded = useRef(false);

  useEffect(() => {
    if (demoSupplySeeded.current || !activeHome?.profile || !['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
    demoSupplySeeded.current = true;
    ensureDemoSupply();
    ensureDemoGuideChores();
  }, [activeHome, ensureDemoSupply, ensureDemoGuideChores]);

  const todayViews = useMemo(() => {
    const currentMember = activeHome?.members.find((member) => member.userId === data.user.id);
    const isVisibleForCurrentMember = (chore: Chore) => activeHome?.assignmentMode !== 'auto' || !currentMember || !chore.executorMemberId || chore.executorMemberId === currentMember.id;
    const visibleDue = activeHome?.assignmentMode === 'auto' && currentMember
      ? dueChores.filter(isVisibleForCurrentMember)
      : dueChores;
    const due = visibleDue.map(toView);
    if (!activeHome) return due;
    const completedIds = new Set(
      activeHome.history
        .filter((entry) => entry.action === 'completed' && toDateKey(new Date(entry.performedAt)) === todayKey())
        .map((entry) => entry.choreId),
    );
    const completed = activeHome.chores
      .filter((chore) => completedIds.has(chore.id) && isVisibleForCurrentMember(chore))
      .map((chore) => ({ ...toView(chore), completed: true, dueLabel: '오늘 완료' }));
    const completedChoreIds = new Set(completed.map((chore) => chore.id));
    const combined = [...due.filter((chore) => !completedChoreIds.has(chore.id)), ...completed];
    return [...new Map(combined.map((chore) => [chore.id, chore])).values()];
  }, [activeHome, dueChores]);
  const allViews = useMemo(() => activeHome?.chores.map(toView) ?? [], [activeHome]);
  const homeViews = useMemo(() => data.homes.map((home) => ({
    id: home.id,
    name: home.name,
    emoji: home.emoji,
    inviteCode: home.inviteCode,
    memberCount: home.members.length,
    members: home.members.map((member) => ({
      id: member.id,
      name: member.displayName,
      avatarEmoji: member.role === 'owner' ? '👑' : '🙂',
      isCurrentUser: member.userId === data.user.id,
    })),
  })), [data.homes, data.user.id]);

  function submitProfile(profile: HouseholdProfile) {
    saveProfile({
      householdType: profile.householdType,
      housingTenure: profile.housingTenure,
      memberCount: profile.memberCount,
      hasPets: profile.hasDog || profile.hasCat,
      petTypes: [
        ...(profile.hasDog ? (['dog'] as const) : []),
        ...(profile.hasCat ? (['cat'] as const) : []),
      ],
      petCounts: { dog: profile.hasDog ? 1 : 0, cat: profile.hasCat ? 1 : 0 },
      childAges: [],
      roomCount: 1,
      bathroomCount: 1,
      completed: true,
    });
    setActiveTab('manage');
  }

  function submitCustomChore(input: CustomChoreInput) {
    addCustomChore(input.title, recurrenceFromInput(input));
    if (input.notificationEnabled) {
      updateNotifications({ enabled: true, reminderHour: Number(input.notificationTime.split(':')[0]) });
    }
    setIsAddingChore(false);
    setActiveTab('manage');
  }

  function toggleTodayChore(choreId: string) {
    const chore = todayViews.find((item) => item.id === choreId);
    if (chore?.completed) undoTodayCompletion(choreId);
    else if (chore?.taskKind === 'supply-purchase') setPurchasingSupplyId(choreId.slice('supply-chore-'.length));
    else completeChore(choreId);
  }

  const purchasingSupply = activeHome?.supplies.find((item) => item.id === purchasingSupplyId) ?? null;

  const syncLabel = ({ loading: '서버 확인 중', saving: '저장 중', synced: '동기화됨', offline: '로컬 저장 중', error: '동기화 오류' } as const)[syncStatus];
  const homeSwitcher = <div className="home-switcher-wrap"><SharedHomeUI
    activeHomeId={data.activeHomeId ?? ''}
    homes={homeViews}
    onCreateHome={({ name, emoji }) => { createHome(name, emoji); }}
    onJoinHome={async (code) => { await joinHomeByInviteCode(code); }}
    onOpenSettings={() => setIsEditingHome(true)}
    onSelectHome={selectHome}
  /><small className={`sync-status sync-status--${syncStatus}`} title={syncError ?? undefined}>{syncLabel}</small></div>;

  if (!activeHome) {
    return <div className="app-shell">{homeSwitcher}<main className="screen home-empty-screen"><span aria-hidden="true">🏘️</span><h1>관리할 집을 추가해 주세요</h1><p>새 집을 만들거나 받은 초대 코드로 참여할 수 있어요.</p></main></div>;
  }

  if (!activeHome.profile) {
    return <div className="app-shell">{homeSwitcher}<ProfileSetup onSubmit={submitProfile} /></div>;
  }

  if (isEditingHome) {
    return <div className="app-shell">{homeSwitcher}<HomeSettings home={activeHome} onCancel={() => setIsEditingHome(false)} onSave={(name, emoji, profile, taskViewMode) => { updateHomeSettings(name, emoji, profile, taskViewMode); setIsEditingHome(false); }} /></div>;
  }

  return (
    <div className="app-shell">
      {homeSwitcher}
      {activeTab === 'today' && (
        <TodayTasks
          chores={todayViews}
          householdName={activeHome.name}
          onAdd={() => setIsAddingChore(true)}
          onReminderToggle={() => updateNotifications({ ...data.notifications, enabled: !data.notifications.enabled })}
          onOpenGuide={setOpenGuideId}
          onToggle={toggleTodayChore}
          reminderEnabled={data.notifications.enabled}
          reminderHour={data.notifications.reminderHour}
          viewMode={activeHome.taskViewMode ?? 'todo'}
        />
      )}
      {activeTab === 'manage' && (
        <main className="screen chores-hub-screen">
          <header className="screen-header compact"><span className="step-label">우리 집 루틴</span><h1>집안일</h1><p>필요한 일은 추가하고, 사용 중인 루틴은 한곳에서 관리하세요.</p></header>
          <section className="chore-hub-summary"><article><span aria-hidden="true">✓</span><div><strong>{allViews.length}</strong><small>사용 중</small></div></article><article><span aria-hidden="true">✨</span><div><strong>{recommendationCandidates.length}</strong><small>새 추천</small></div></article><article><span aria-hidden="true">🗓️</span><div><strong>{dueChores.length}</strong><small>오늘 할 일</small></div></article></section>
          <RecommendationReview candidates={recommendationCandidates} onAccept={acceptRecommendation} onDismiss={dismissRecommendation} onSnooze={snoozeRecommendation} />
          <ChoreManager
            chores={allViews}
            embedded
            onAdd={() => setIsAddingChore(true)}
            onChangeFrequency={(id, frequency) => updateChoreRecurrence(id, { interval: 1, unit: ({ daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year', custom: 'week' } as const)[frequency] })}
            onDelete={removeCustomChore}
            onDismissRecommendation={dismissRecommendation}
            onOpenGuide={setOpenGuideId}
          />
        </main>
      )}
      {activeTab === 'schedule' && <ScheduleCalendar chores={activeHome.chores} history={activeHome.history} />}
      {activeTab === 'report' && <HouseholdReport assessments={activeHome.laborAssessments ?? []} assignmentMode={activeHome.assignmentMode ?? 'shared'} chores={activeHome.chores} currentUserId={data.user.id} history={activeHome.history} homeName={activeHome.name} members={activeHome.members} onAddSupply={addSupplyItem} onAssign={assignChoreExecutor} onAutoAssign={autoAssignChores} onPurchaseSupply={recordSupplyPurchase} onRemoveSupply={removeSupplyItem} onSaveAssessment={saveLaborAssessment} onUseSharedList={setSharedAssignmentMode} supplies={activeHome.supplies ?? []} />}
      {activeTab === 'profile' && <PersonalProfile homes={data.homes} onSaveName={updateUserName} user={data.user} />}
      <BottomNavigation active={activeTab} onChange={setActiveTab} />
      <CustomChoreModal
        key={isAddingChore ? 'open' : 'closed'}
        open={isAddingChore}
        onClose={() => setIsAddingChore(false)}
        onSubmit={submitCustomChore}
      />
      {purchasingSupply && <SupplyPurchaseModal initialQuantity={purchasingSupply.purchaseQuantity} itemName={purchasingSupply.name} key={purchasingSupply.id} onClose={() => setPurchasingSupplyId(null)} onSubmit={(quantity) => { recordSupplyPurchase(purchasingSupply.id, todayKey(), quantity); completeChore(`supply-chore-${purchasingSupply.id}`); setPurchasingSupplyId(null); }} open unit={purchasingSupply.unit} />}
      {openGuideId && choreGuideById(openGuideId) && <ChoreGuideModal guide={choreGuideById(openGuideId)!} onClose={() => setOpenGuideId(null)} />}
    </div>
  );
}

export default App;
