import { useMemo, useState } from 'react';
import {
  BottomNavigation,
  ChoreManager,
  CustomChoreModal,
  HouseholdReport,
  HomeSettings,
  PersonalProfile,
  ProfileSetup,
  ScheduleCalendar,
  SharedHomeUI,
  TodayTasks,
  type Chore as ChoreView,
  type CustomChoreInput,
  type HouseholdProfile,
  type NavigationTab,
} from './components';
import { formatDueDate, formatRecurrence, todayKey, toDateKey } from './domain/date';
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
    createHome,
    selectHome,
    joinHomeByInviteCode,
    saveProfile,
    updateHomeSettings,
    updateUserName,
    addCustomChore,
    completeChore,
    undoTodayCompletion,
    removeCustomChore,
    updateNotifications,
  } = useAppData();
  const [activeTab, setActiveTab] = useState<NavigationTab>('today');
  const [isAddingChore, setIsAddingChore] = useState(false);
  const [isEditingHome, setIsEditingHome] = useState(false);

  const todayViews = useMemo(() => {
    const due = dueChores.map(toView);
    if (!activeHome) return due;
    const completedIds = new Set(
      activeHome.history
        .filter((entry) => entry.action === 'completed' && toDateKey(new Date(entry.performedAt)) === todayKey())
        .map((entry) => entry.choreId),
    );
    const completed = activeHome.chores
      .filter((chore) => completedIds.has(chore.id))
      .map((chore) => ({ ...toView(chore), completed: true, dueLabel: '오늘 완료' }));
    const completedChoreIds = new Set(completed.map((chore) => chore.id));
    return [...due.filter((chore) => !completedChoreIds.has(chore.id)), ...completed];
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
      memberCount: profile.memberCount,
      hasPets: profile.hasDog || profile.hasCat,
      petTypes: [
        ...(profile.hasDog ? (['dog'] as const) : []),
        ...(profile.hasCat ? (['cat'] as const) : []),
      ],
      roomCount: 1,
      bathroomCount: 1,
      completed: true,
    });
    setActiveTab('today');
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
    else completeChore(choreId);
  }

  const homeSwitcher = <div className="home-switcher-wrap"><SharedHomeUI
    activeHomeId={data.activeHomeId ?? ''}
    homes={homeViews}
    onCreateHome={({ name, emoji }) => { createHome(name, emoji); }}
    onJoinHome={(code) => { joinHomeByInviteCode(code); }}
    onOpenSettings={() => setIsEditingHome(true)}
    onSelectHome={selectHome}
  /></div>;

  if (!activeHome) {
    return <div className="app-shell">{homeSwitcher}<main className="screen home-empty-screen"><span aria-hidden="true">🏘️</span><h1>관리할 집을 추가해 주세요</h1><p>새 집을 만들거나 받은 초대 코드로 참여할 수 있어요.</p></main></div>;
  }

  if (!activeHome.profile) {
    return <div className="app-shell">{homeSwitcher}<ProfileSetup onSubmit={submitProfile} /></div>;
  }

  if (isEditingHome) {
    return <div className="app-shell">{homeSwitcher}<HomeSettings home={activeHome} onCancel={() => setIsEditingHome(false)} onSave={(name, emoji, profile) => { updateHomeSettings(name, emoji, profile); setIsEditingHome(false); }} /></div>;
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
          onToggle={toggleTodayChore}
          reminderEnabled={data.notifications.enabled}
          reminderHour={data.notifications.reminderHour}
        />
      )}
      {activeTab === 'manage' && (
        <ChoreManager
          chores={allViews}
          onAdd={() => setIsAddingChore(true)}
          onDelete={removeCustomChore}
        />
      )}
      {activeTab === 'schedule' && <ScheduleCalendar chores={activeHome.chores} history={activeHome.history} />}
      {activeTab === 'report' && <HouseholdReport chores={activeHome.chores} history={activeHome.history} homeName={activeHome.name} members={activeHome.members} />}
      {activeTab === 'profile' && <PersonalProfile homes={data.homes} onSaveName={updateUserName} user={data.user} />}
      <BottomNavigation active={activeTab} onChange={setActiveTab} />
      <CustomChoreModal
        key={isAddingChore ? 'open' : 'closed'}
        open={isAddingChore}
        onClose={() => setIsAddingChore(false)}
        onSubmit={submitCustomChore}
      />
    </div>
  );
}

export default App;
