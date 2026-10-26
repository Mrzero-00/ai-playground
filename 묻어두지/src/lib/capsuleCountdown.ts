import type { CapsuleSummary } from '../shared/contracts';

export type CapsuleCountdown = {
  state: 'waiting' | 'ready' | 'opened' | 'unknown';
  text: string;
  totalSeconds: number | null;
};

/** Presentation only: `now` comes from the server-adjusted app clock, not a new timer.
 * Reaching zero never grants permission to open; the server still checks every condition. */
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
