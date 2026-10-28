import {
  MAX_MEMBERS,
  addDays,
  autoSealReason,
  canAddItem,
  canSeal,
  findByInviteCode,
  generateInviteCode,
  isValidOpenAtForCreate,
  me,
  type Capsule,
  type CapsuleItem,
  type PlantedLocation,
} from '@/domain/capsule';
import type { Account, CreateCapsuleInput, LoginInput } from '@/shared/capsule-api';

import { BackendError, type CapsuleBackend, type ItemPatch, type NewItemInput } from './backend';

type Options = { initial: Capsule[]; now?: () => Date; displayName?: string };

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * 서버 없이 도는 백엔드. 서버와 같은 규칙(5개 제한, 닫기 조건, 저절로 닫힘, 여는 시각)을 메모리에서 적용한다.
 * 새로고침하면 사라진다. 웹 미리보기와 시드 데이터용이며, EXPO_PUBLIC_API_URL 이 있으면 RemoteBackend 가 대신한다.
 */
export class LocalBackend implements CapsuleBackend {
  readonly source = 'local' as const;
  private all: Capsule[];
  private readonly now: () => Date;
  private displayName: string;
  private current: Account | null = null;

  constructor({ initial, now = () => new Date(), displayName = '상길' }: Options) {
    this.all = initial;
    this.now = now;
    this.displayName = displayName;
  }

  /** 읽을 때마다 저절로 닫히는 조건을 판정한다. 서버가 붙으면 서버가 하는 일. */
  private settle() {
    const now = this.now();
    this.all = this.all.map((capsule) => (autoSealReason(capsule, now) ? { ...capsule, status: 'sealed', sealedAt: now.toISOString() } : capsule));
  }

  private mine() {
    this.settle();
    return this.all.filter((capsule) => me(capsule) !== null);
  }

  private find(capsuleId: string) {
    const capsule = this.mine().find((item) => item.id === capsuleId);
    if (!capsule) throw new BackendError('NOT_FOUND', '그 캡슐을 찾을 수 없어요.');
    return capsule;
  }

  private replace(next: Capsule) {
    this.all = this.all.map((capsule) => (capsule.id === next.id ? next : capsule));
    return next;
  }

  async load() {
    return this.mine();
  }

  async create({ title, deadlineDays, openAt, mode, location }: CreateCapsuleInput) {
    const createdAt = this.now().toISOString();
    const deadlineAt = addDays(createdAt, deadlineDays);
    if (!title.trim()) throw new BackendError('VALIDATION', '캡슐 이름을 적어 주세요.');
    if (!isValidOpenAtForCreate(createdAt, deadlineAt, openAt)) throw new BackendError('VALIDATION', '여는 날은 넣기 마감보다 뒤, 오늘부터 30~180일 안이어야 해요.');
    const capsule: Capsule = {
      id: newId('cap'),
      title: title.trim(),
      createdAt,
      deadlineAt,
      status: 'collecting',
      sealedAt: null,
      openAt,
      openedAt: null,
      members: [{ id: 'me', name: this.displayName, isMe: true, isHost: true, items: [] }],
      mode,
      location: location ?? null,
      inviteCode: generateInviteCode(),
    };
    this.all = [capsule, ...this.all];
    return capsule;
  }

  async join(code: string) {
    this.settle();
    const capsule = findByInviteCode(this.all, code);
    if (!capsule) throw new BackendError('INVITE_NOT_FOUND', '그런 코드의 캡슐이 없어요. 글자를 다시 확인해 주세요.');
    if (me(capsule)) return { capsule, already: true };
    if (capsule.status !== 'collecting' || capsule.mode === 'solo') throw new BackendError('CAPSULE_CLOSED', '이 캡슐은 이미 닫혔어요. 다음 캡슐에 같이 들어가요.');
    if (capsule.members.length >= MAX_MEMBERS) throw new BackendError('CAPSULE_FULL', `이 캡슐은 이미 ${MAX_MEMBERS}명이 꽉 찼어요.`);
    const joined = this.replace({ ...capsule, members: [...capsule.members, { id: 'me', name: this.displayName, isMe: true, isHost: false, items: [] }] });
    return { capsule: joined, already: false };
  }

  async addItem(capsuleId: string, input: NewItemInput) {
    const capsule = this.find(capsuleId);
    const mine = me(capsule);
    if (capsule.status !== 'collecting') throw new BackendError('CAPSULE_CLOSED', '이미 닫힌 캡슐이라 더 넣을 수 없어요.');
    if (!mine || !canAddItem(mine)) throw new BackendError('SLOTS_FULL', '내 자리 5개를 다 썼어요. 하나를 꺼내고 넣어 주세요.');
    const item: CapsuleItem = { id: newId('item'), createdAt: this.now().toISOString(), ...input };
    const next = this.replace({ ...capsule, members: capsule.members.map((member) => (member.isMe ? { ...member, items: [...member.items, item] } : member)) });
    return { capsule: next, item };
  }

  async updateItem(capsuleId: string, itemId: string, patch: ItemPatch) {
    const capsule = this.find(capsuleId);
    const existing = me(capsule)?.items.find((item) => item.id === itemId);
    if (!existing) throw new BackendError('NOT_FOUND', '그 물건을 찾을 수 없어요.');
    if (capsule.status !== 'collecting') throw new BackendError('CAPSULE_CLOSED', '이미 닫힌 캡슐이라 고칠 수 없어요.');
    const { kind: _kind, ...fields } = patch;
    const item = { ...existing, ...fields };
    const next = this.replace({ ...capsule, members: capsule.members.map((member) => (member.isMe ? { ...member, items: member.items.map((it) => (it.id === itemId ? item : it)) } : member)) });
    return { capsule: next, item };
  }

  async removeItem(capsuleId: string, itemId: string) {
    const capsule = this.find(capsuleId);
    if (capsule.status !== 'collecting') throw new BackendError('CAPSULE_CLOSED', '이미 닫힌 캡슐이라 꺼낼 수 없어요.');
    return this.replace({ ...capsule, members: capsule.members.map((member) => (member.isMe ? { ...member, items: member.items.filter((it) => it.id !== itemId) } : member)) });
  }

  async seal(capsuleId: string) {
    const capsule = this.find(capsuleId);
    if (!me(capsule)?.isHost) throw new BackendError('NOT_HOST', '방장만 닫을 수 있어요.');
    if (!canSeal(capsule)) throw new BackendError('CANNOT_SEAL', '아직 닫을 수 없어요. 물건을 넣은 사람이 더 필요해요.');
    return this.replace({ ...capsule, status: 'sealed', sealedAt: this.now().toISOString() });
  }

  async open(capsuleId: string) {
    const capsule = this.find(capsuleId);
    if (capsule.status === 'opened') return capsule;
    if (capsule.status !== 'sealed' || !capsule.openAt) throw new BackendError('NOT_SEALED', '아직 닫히지 않은 캡슐이에요.');
    if (this.now().getTime() < new Date(capsule.openAt).getTime()) throw new BackendError('TOO_EARLY', '아직 열 수 있는 시각이 아니에요.');
    return this.replace({ ...capsule, status: 'opened', openedAt: this.now().toISOString() });
  }

  /** 로컬 백엔드는 서버가 없으니 '개발용' 로그인만 흉내 낸다. 기기 안에서만 의미가 있다. */
  async account() {
    return { account: this.current, displayName: this.displayName, providers: ['dev' as const] };
  }

  async login(input: LoginInput) {
    if (input.provider !== 'dev') throw new BackendError('PROVIDER_DISABLED', '서버 없이 보는 미리보기에서는 소셜 로그인을 쓸 수 없어요.');
    const name = input.name.trim();
    if (!name) throw new BackendError('VALIDATION', '이름을 적어 주세요.');
    this.current = { id: `dev-${name}`, provider: 'dev', displayName: name, avatarUrl: null };
    await this.setDisplayName(name);
    return this.account();
  }

  async logout() {
    this.current = null;
  }

  async setDisplayName(name: string) {
    this.displayName = name.trim() || this.displayName;
    this.all = this.all.map((capsule) => ({ ...capsule, members: capsule.members.map((member) => (member.isMe ? { ...member, name: this.displayName } : member)) }));
  }

  async plant(capsuleId: string, location: PlantedLocation) {
    const capsule = this.find(capsuleId);
    if (!me(capsule)?.isHost) throw new BackendError('NOT_HOST', '방장만 자리를 정할 수 있어요.');
    return this.replace({ ...capsule, location });
  }
}
