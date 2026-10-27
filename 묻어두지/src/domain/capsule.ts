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
  /** 혼자 묻는 캡슐인지, 초대 코드로 친구와 함께 묻는 캡슐인지. */
  mode: CapsuleMode;
  /** 친구가 참여할 때 쓰는 6자리 초대 코드. 서버가 붙으면 토큰 해시로 바뀐다. */
  inviteCode: string;
};

export type CapsuleMode = 'solo' | 'group';

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

/** 닫으려면 물건을 넣은 사람이 몇 명 필요한가. 혼자 묻는 캡슐은 나 하나, 함께 묻는 캡슐은 2명. */
export function requiredContributors(capsule: Partial<Pick<Capsule, 'mode'>>) {
  return capsule.mode === 'solo' ? 1 : MIN_MEMBERS;
}

export function canSeal(capsule: Pick<Capsule, 'members' | 'status'> & Partial<Pick<Capsule, 'mode'>>) {
  return capsule.status === 'collecting' && contributingMembers(capsule).length >= requiredContributors(capsule);
}

/** 모든 멤버가 5칸을 다 채웠는가. 필요한 인원이 모였을 때만 의미가 있다. */
export function isEveryoneFull(capsule: Pick<Capsule, 'members'> & Partial<Pick<Capsule, 'mode'>>) {
  return capsule.members.length >= requiredContributors(capsule) && capsule.members.every((member) => member.items.length >= MAX_ITEMS_PER_MEMBER);
}

export type AutoSealReason = 'deadline' | 'everyone-full';

/**
 * 저절로 닫히는 조건(SEAL-01): 넣기 마감이 지났거나, 전원이 5개를 다 넣었을 때.
 * 두 경우 모두 물건을 넣은 멤버가 필요한 인원(혼자 1명, 함께 2명) 이상이어야 한다. 방장이 직접 닫는 건 별도.
 */
export function autoSealReason(capsule: Pick<Capsule, 'members' | 'status' | 'deadlineAt'> & Partial<Pick<Capsule, 'mode'>>, now: Date): AutoSealReason | null {
  if (!canSeal(capsule)) return null;
  if (isEveryoneFull(capsule)) return 'everyone-full';
  if (now.getTime() >= new Date(capsule.deadlineAt).getTime()) return 'deadline';
  return null;
}

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(random: () => number = Math.random) {
  let code = '';
  for (let index = 0; index < 6; index += 1) code += INVITE_ALPHABET[Math.floor(random() * INVITE_ALPHABET.length)];
  return code;
}

/** 사용자가 입력한 코드를 저장된 형태로 맞춘다: 대문자, 공백·기호 제거. */
export function normalizeInviteCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function findByInviteCode<T extends Pick<Capsule, 'inviteCode'>>(capsules: readonly T[], input: string): T | null {
  const code = normalizeInviteCode(input);
  if (code.length !== 6) return null;
  return capsules.find((capsule) => capsule.inviteCode === code) ?? null;
}

/** 여는 시각은 만든 날 기준 30~180일 안이고, 넣기 마감보다 뒤여야 한다(PIT-01, PIT-02). */
export function isValidOpenAtForCreate(createdAt: string, deadlineAt: string, openAt: string) {
  return isValidOpenAt(createdAt, openAt) && new Date(openAt).getTime() > new Date(deadlineAt).getTime();
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
