export type HouseholdType = 'single' | 'couple' | 'family' | 'shared';
export type PetType = 'dog' | 'cat' | 'other';
export type ChoreCategory = 'cleaning' | 'kitchen' | 'laundry' | 'pet' | 'living' | 'etc';
export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';

export interface LocalUser {
  id: string;
  displayName: string;
  createdAt: string;
}

export interface HomeMember {
  id: string;
  userId: string;
  displayName: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface HomeProfile {
  householdType: HouseholdType;
  memberCount: number;
  hasPets: boolean;
  petTypes: PetType[];
  roomCount: number;
  bathroomCount: number;
  completed: boolean;
}

export interface Recurrence {
  interval: number;
  unit: RecurrenceUnit;
}

export interface Chore {
  id: string;
  title: string;
  category: ChoreCategory;
  recurrence: Recurrence;
  createdAt: string;
  scheduleAnchorDate?: string;
  nextDueDate: string;
  isCustom: boolean;
  enabled: boolean;
  assignedMemberId?: string;
}

export interface ChoreHistory {
  id: string;
  choreId: string;
  choreTitle: string;
  action: 'completed' | 'skipped';
  performedAt: string;
  scheduledFor?: string;
  performedByUserId: string;
  performedByName: string;
}

export interface Home {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
  members: HomeMember[];
  profile: HomeProfile | null;
  chores: Chore[];
  history: ChoreHistory[];
  createdAt: string;
}

export interface NotificationSettings {
  enabled: boolean;
  reminderHour: number;
}

export interface AppData {
  version: 2;
  user: LocalUser;
  homes: Home[];
  activeHomeId: string | null;
  notifications: NotificationSettings;
}

/** 저장소 v1 마이그레이션 입력 전용 타입 */
export interface LegacyAppData {
  profile: HomeProfile | null;
  chores: Chore[];
  history: Omit<ChoreHistory, 'performedByUserId' | 'performedByName'>[];
  notifications: NotificationSettings;
}
