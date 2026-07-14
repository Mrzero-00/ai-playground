import type { AppData } from '../domain/types';

const STORAGE_KEY = 'ai-housework:data:v1';

export const initialAppData: AppData = {
  profile: null,
  chores: [],
  history: [],
  notifications: { enabled: false, reminderHour: 9 },
};

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...initialAppData, ...JSON.parse(raw) } : initialAppData;
  } catch {
    return initialAppData;
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
