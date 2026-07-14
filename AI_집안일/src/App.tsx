import { useMemo, useState } from 'react';
import {
  BottomNavigation,
  ChoreManager,
  CustomChoreModal,
  ProfileSetup,
  TodayTasks,
  type Chore as ChoreView,
  type CustomChoreInput,
  type HouseholdProfile,
  type NavigationTab,
} from './components';
import { formatDueDate, formatRecurrence } from './domain/date';
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
    dueChores,
    saveProfile,
    addCustomChore,
    completeChore,
    removeCustomChore,
    updateNotifications,
  } = useAppData();
  const [activeTab, setActiveTab] = useState<NavigationTab>('today');
  const [isAddingChore, setIsAddingChore] = useState(false);

  const dueViews = useMemo(() => dueChores.map(toView), [dueChores]);
  const allViews = useMemo(() => data.chores.map(toView), [data.chores]);

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

  if (!data.profile) {
    return <ProfileSetup onSubmit={submitProfile} />;
  }

  const initialProfile: Partial<HouseholdProfile> = {
    householdType: data.profile.householdType,
    memberCount: data.profile.memberCount,
    hasDog: data.profile.petTypes.includes('dog'),
    hasCat: data.profile.petTypes.includes('cat'),
  };

  return (
    <div className="app-shell">
      {activeTab === 'today' && (
        <TodayTasks
          chores={dueViews}
          onAdd={() => setIsAddingChore(true)}
          onToggle={completeChore}
        />
      )}
      {activeTab === 'manage' && (
        <ChoreManager
          chores={allViews}
          onAdd={() => setIsAddingChore(true)}
          onDelete={removeCustomChore}
        />
      )}
      {activeTab === 'profile' && <ProfileSetup initialValue={initialProfile} onSubmit={submitProfile} />}
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
