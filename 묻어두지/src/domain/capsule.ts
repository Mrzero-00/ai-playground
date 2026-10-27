export type ItemKind = 'letter' | 'photo' | 'voice' | 'video';

export type CapsuleItem = {
  id: string;
  kind: ItemKind;
  createdAt: string;
  text?: string;
  uri?: string;
  durationMs?: number;
};

export type Member = {
  id: string;
  name: string;
  isMe: boolean;
  isHost: boolean;
  items: CapsuleItem[];
};

export type CapsuleStatus = 'collecting' | 'sealed' | 'opened';

/** 2차(AR): 캡슐을 심은 자리. 정확한 좌표는 가입 멤버에게만 보여 준다(PIT-04). */
export type PlantedLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  label: string;
  plantedAt: string;
};

export type Capsule = {
  id: string;
  title: string;
  createdAt: string;
  deadlineAt: string;
  status: CapsuleStatus;
  sealedAt: string | null;
  openAt: string | null;
  openedAt: string | null;
  members: Member[];
  location?: PlantedLocation | null;
};

export type DerivedStatus = CapsuleStatus | 'unlockable';

export const MAX_ITEMS_PER_MEMBER = 5;
export const MIN_MEMBERS = 2;
export const MAX_MEMBERS = 8;
export const MIN_OPEN_DAYS = 30;
export const MAX_OPEN_DAYS = 180;
export const LETTER_MAX_CHARS = 180;
export const VOICE_MAX_MS = 60_000;
export const VIDEO_MAX_MS = 30_000;
export const COUNTDOWN_MS = 10_000;
export const OPENED_RETENTION_DAYS = 30;
export const DEADLINE_DAY_OPTIONS = [1, 3, 7, 14] as const;
export const OPEN_DAY_OPTIONS = [30, 60, 100, 180] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  letter: '편지',
  photo: '사진',
  voice: '음성',
  video: '동영상',
};

export function remainingSlots(member: Pick<Member, 'items'>) {
  return Math.max(0, MAX_ITEMS_PER_MEMBER - member.items.length);
}

export function canAddItem(member: Pick<Member, 'items'>) {
  return remainingSlots(member) > 0;
}

export function letterLength(text: string) {
  return text.replace(/\s/g, '').length;
}

export function isLetterValid(text: string) {
  const length = letterLength(text);
  return length >= 1 && text.length <= LETTER_MAX_CHARS;
}

export function addDays(iso: string, days: number) {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

function startOfLocalDay(iso: string) {
  const date = new Date(iso);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** 닫은 날(현지 자정 기준)부터 30일째 00:00 ~ 180일째 23:59:59. 시각이 아니라 날짜로 센다. */
export function openWindow(sealedAt: string) {
  const base = startOfLocalDay(sealedAt);
  const min = new Date(base.getFullYear(), base.getMonth(), base.getDate() + MIN_OPEN_DAYS);
  const max = new Date(base.getFullYear(), base.getMonth(), base.getDate() + MAX_OPEN_DAYS + 1, 0, 0, 0, -1);
  return { min: min.toISOString(), max: max.toISOString() };
}

export function isValidOpenAt(sealedAt: string, openAt: string) {
  const { min, max } = openWindow(sealedAt);
  const time = new Date(openAt).getTime();
  return time >= new Date(min).getTime() && time <= new Date(max).getTime();
}

export function isValidOpenTimeOfDay(date: Date) {
  const hour = date.getHours();
  const minute = date.getMinutes();
  return hour >= 8 && hour <= 23 && (minute === 0 || minute === 30);
}

export function contributingMembers(capsule: Pick<Capsule, 'members'>) {
  return capsule.members.filter((member) => member.items.length > 0);
}

export function totalItems(capsule: Pick<Capsule, 'members'>) {
  return capsule.members.reduce((sum, member) => sum + member.items.length, 0);
}

export function canSeal(capsule: Pick<Capsule, 'members' | 'status'>) {
  return capsule.status === 'collecting' && contributingMembers(capsule).length >= MIN_MEMBERS;
}

export function deriveStatus(capsule: Pick<Capsule, 'status' | 'openAt'>, now: Date): DerivedStatus {
  if (capsule.status !== 'sealed') return capsule.status;
  if (capsule.openAt && now.getTime() >= new Date(capsule.openAt).getTime()) return 'unlockable';
  return 'sealed';
}

export function daysUntil(iso: string, now: Date) {
  const diff = new Date(iso).getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / DAY_MS));
}

export function deletionDate(openedAt: string) {
  return addDays(openedAt, OPENED_RETENTION_DAYS);
}

export function me(capsule: Pick<Capsule, 'members'>) {
  return capsule.members.find((member) => member.isMe) ?? null;
}

export function revealOrder(capsule: Pick<Capsule, 'members' | 'id'>) {
  const items = capsule.members.flatMap((member) =>
    member.items.map((item) => ({ item, memberName: member.name, memberId: member.id })),
  );
  let seed = hashString(capsule.id);
  for (let index = items.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swap = seed % (index + 1);
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

/** 받침 유무에 따라 주격 조사를 붙인다: 민지가 / 상길이가, 편지가 / 사진이 */
export function withSubjectParticle(word: string) {
  const last = word.charCodeAt(word.length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  const hasFinalConsonant = isHangul && (last - 0xac00) % 28 !== 0;
  return `${word}${hasFinalConsonant ? '이' : '가'}`;
}

export function formatKoreanDate(iso: string, withTime = false) {
  const date = new Date(iso);
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  const base = `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekday}`;
  if (!withTime) return base;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${base} ${hours}:${minutes}`;
}
