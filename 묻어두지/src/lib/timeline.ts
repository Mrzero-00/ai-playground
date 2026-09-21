import type { CapsuleSummary } from '../shared/contracts';

export type TimelineFilter = 'all' | 'waiting' | 'ready' | 'opened';

/** "Ready" only describes time. The server still checks location on every open. */
export function capsuleState(capsule: CapsuleSummary, now: number): Exclude<TimelineFilter, 'all'> {
  if (capsule.openedAt) return 'opened';
  return Date.parse(capsule.opensAt) <= now ? 'ready' : 'waiting';
}

export function filterCapsules(capsules: CapsuleSummary[], filter: TimelineFilter, now: number) {
  return capsules.filter(capsule => filter === 'all' || capsuleState(capsule, now) === filter)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
