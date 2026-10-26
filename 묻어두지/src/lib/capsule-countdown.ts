import type { CapsuleSummary } from '@/shared/contracts';

export type CapsuleCountdown = {
  state: 'waiting' | 'ready' | 'opened' | 'unknown';
  text: string;
  totalSeconds: number | null;
};

/** Presentation only: `now` is the server-adjusted app clock. Reaching zero never
 * grants permission to open; the server still checks every condition. */
export function capsuleCountdown(capsule: Pick<CapsuleSummary, 'opensAt' | 'openedAt'>, now: number): CapsuleCountdown {
  if (capsule.openedAt) return { state: 'opened', text: '열어본 캡슐', totalSeconds: 0 };
  const deadline = Date.parse(capsule.opensAt);
  if (!Number.isFinite(deadline) || !Number.isFinite(now)) return { state: 'unknown', text: '시간 확인 중', totalSeconds: null };
  const totalSeconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  if (!totalSeconds) return { state: 'ready', text: '열어볼 시간!', totalSeconds: 0 };
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return { state: 'waiting', text: `${days}일 ${pad(hours)}시간 ${pad(minutes)}분 ${pad(seconds)}초`, totalSeconds };
}

/** The D-day the home cards show: days remaining, rounded up like the countdown. */
export function dDayLabel(capsule: Pick<CapsuleSummary, 'opensAt' | 'openedAt'>, now: number) {
  const countdown = capsuleCountdown(capsule, now);
  if (countdown.state === 'opened') return '열었음';
  if (countdown.state !== 'waiting') return 'D–0';
  return `D–${Math.ceil((countdown.totalSeconds ?? 0) / 86400)}`;
}

export type TimelineFilter = 'all' | 'waiting' | 'ready' | 'opened';

/** "Ready" only describes time. The server still checks location on every open. */
export function capsuleState(capsule: Pick<CapsuleSummary, 'opensAt' | 'openedAt'>, now: number): Exclude<TimelineFilter, 'all'> {
  if (capsule.openedAt) return 'opened';
  return Date.parse(capsule.opensAt) <= now ? 'ready' : 'waiting';
}

export function sortNewestFirst<T extends Pick<CapsuleSummary, 'createdAt'>>(capsules: T[]) {
  return [...capsules].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** A capsule can wait months. A month-day alone would read as this year. */
export function revealDateLabel(value: string, now: number) {
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat('ko-KR', { ...(sameYear ? {} : { year: 'numeric' }), month: 'long', day: 'numeric' }).format(date);
}
