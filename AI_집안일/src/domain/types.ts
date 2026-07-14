export type HouseholdType = 'single' | 'couple' | 'family' | 'shared';
export type PetType = 'dog' | 'cat' | 'other';
export type ChoreCategory = 'cleaning' | 'kitchen' | 'laundry' | 'pet' | 'living' | 'etc';
export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';

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
  nextDueDate: string;
  isCustom: boolean;
  enabled: boolean;
}

export interface ChoreHistory {
  id: string;
  choreId: string;
  choreTitle: string;
  action: 'completed' | 'skipped';
  performedAt: string;
}

export interface NotificationSettings {
  enabled: boolean;
  reminderHour: number;
}

export interface AppData {
  profile: HomeProfile | null;
  chores: Chore[];
  history: ChoreHistory[];
  notifications: NotificationSettings;
}
