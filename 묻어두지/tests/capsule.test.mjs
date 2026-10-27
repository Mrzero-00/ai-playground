import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_ITEMS_PER_MEMBER,
  canAddItem,
  canSeal,
  daysUntil,
  deriveStatus,
  isLetterValid,
  isValidOpenAt,
  letterLength,
  openWindow,
  remainingSlots,
  revealOrder,
  withSubjectParticle,
  autoSealReason,
  generateInviteCode,
  isEveryoneFull,
  isValidOpenAtForCreate,
  findByInviteCode,
  normalizeInviteCode,
} from '../src/domain/capsule.ts';

const item = (kind, id) => ({ id, kind, createdAt: '2026-10-20T00:00:00.000Z' });

test('CON: 한 사람은 종류와 상관없이 5개까지 넣는다', () => {
  const member = { items: [item('photo', '1'), item('photo', '2'), item('photo', '3'), item('letter', '4')] };
  assert.equal(remainingSlots(member), 1);
  assert.equal(canAddItem(member), true);
  member.items.push(item('voice', '5'));
  assert.equal(remainingSlots(member), 0);
  assert.equal(canAddItem(member), false);
  assert.equal(MAX_ITEMS_PER_MEMBER, 5);
});

test('CON-01: 편지는 공백 제외 1자 이상 180자 이하', () => {
  assert.equal(isLetterValid('   '), false);
  assert.equal(isLetterValid('안녕'), true);
  assert.equal(letterLength('안 녕 하 세 요'), 5);
  assert.equal(isLetterValid('가'.repeat(180)), true);
  assert.equal(isLetterValid('가'.repeat(181)), false);
});

test('PIT-02: 여는 날은 닫은 날부터 30~180일째, 시각이 아니라 날짜로 센다', () => {
  const local = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
  const sealedAt = local(2026, 10, 20, 19, 17);
  const { min, max } = openWindow(sealedAt);
  assert.equal(min, local(2026, 11, 19));
  assert.equal(new Date(max).getTime(), new Date(2027, 3, 19).getTime() - 1);
  assert.equal(isValidOpenAt(sealedAt, local(2026, 11, 18, 23, 30)), false);
  assert.equal(isValidOpenAt(sealedAt, local(2026, 11, 19, 8, 0)), true, '30일째 아침은 닫은 시각보다 일러도 된다');
  assert.equal(isValidOpenAt(sealedAt, local(2027, 4, 18, 23, 0)), true);
  assert.equal(isValidOpenAt(sealedAt, local(2027, 4, 19, 8, 0)), false);
});

test('SEAL-01: 물건을 넣은 멤버가 2명 이상이어야 닫을 수 있다', () => {
  const one = { status: 'collecting', members: [{ items: [item('letter', '1')] }, { items: [] }] };
  const two = { status: 'collecting', members: [{ items: [item('letter', '1')] }, { items: [item('photo', '2')] }] };
  assert.equal(canSeal(one), false);
  assert.equal(canSeal(two), true);
  assert.equal(canSeal({ ...two, status: 'sealed' }), false);
});

test('SEAL-01: 혼자 묻는 캡슐은 내가 하나만 넣어도 닫히고, 5개를 다 넣으면 저절로 닫힌다', () => {
  const deadlineAt = '2026-11-02T10:00:00.000Z';
  const before = new Date('2026-11-01T10:00:00.000Z');
  const empty = { status: 'collecting', mode: 'solo', deadlineAt, members: [{ items: [] }] };
  const one = { ...empty, members: [{ items: [item('letter', '1')] }] };
  const full = { ...empty, members: [{ items: Array.from({ length: 5 }, (_, i) => item('photo', `s${i}`)) }] };
  assert.equal(canSeal(empty), false);
  assert.equal(canSeal(one), true);
  assert.equal(autoSealReason(one, before), null);
  assert.equal(autoSealReason(full, before), 'everyone-full');
});

test('INV-02: 초대 코드는 소문자·공백·하이픈을 섞어 넣어도 찾는다', () => {
  const capsules = [{ inviteCode: 'RIVER7' }, { inviteCode: 'JEJU26' }];
  assert.equal(normalizeInviteCode(' riv-er 7 '), 'RIVER7');
  assert.equal(findByInviteCode(capsules, 'river7'), capsules[0]);
  assert.equal(findByInviteCode(capsules, 'JEJU2'), null);
  assert.equal(findByInviteCode(capsules, 'NOPE00'), null);
});

test('REV: unlockable은 저장 상태가 아니라 여는 시각 이후에 계산된다', () => {
  const capsule = { status: 'sealed', openAt: '2026-11-20T10:00:00.000Z' };
  assert.equal(deriveStatus(capsule, new Date('2026-11-20T09:59:59.000Z')), 'sealed');
  assert.equal(deriveStatus(capsule, new Date('2026-11-20T10:00:00.000Z')), 'unlockable');
  assert.equal(deriveStatus({ status: 'opened', openAt: capsule.openAt }, new Date()), 'opened');
  assert.equal(daysUntil(capsule.openAt, new Date('2026-10-19T10:00:00.000Z')), 32);
});

test('문구: 받침에 따라 주격 조사를 고른다', () => {
  assert.equal(withSubjectParticle('민지'), '민지가');
  assert.equal(withSubjectParticle('상길'), '상길이');
  assert.equal(withSubjectParticle('사진'), '사진이');
  assert.equal(withSubjectParticle('편지'), '편지가');
});

test('REV-03: 꺼내는 순서는 사람 순서가 아니라 섞인 물건 순서이며 캡슐마다 고정된다', () => {
  const capsule = {
    id: 'cap-1',
    members: [
      { id: 'a', name: 'A', items: [item('letter', 'a1'), item('photo', 'a2')] },
      { id: 'b', name: 'B', items: [item('voice', 'b1'), item('video', 'b2')] },
    ],
  };
  const first = revealOrder(capsule).map((entry) => entry.item.id);
  const second = revealOrder(capsule).map((entry) => entry.item.id);
  assert.deepEqual(first, second);
  assert.deepEqual([...first].sort(), ['a1', 'a2', 'b1', 'b2']);
});

test('SEAL-01: 마감이 지나거나 전원이 5개를 다 넣으면 저절로 닫힌다', () => {
  const five = (prefix) => Array.from({ length: 5 }, (_, i) => item('photo', `${prefix}${i}`));
  const deadlineAt = '2026-11-02T10:00:00.000Z';
  const before = new Date('2026-11-01T10:00:00.000Z');
  const after = new Date('2026-11-02T10:00:00.000Z');
  const partial = { status: 'collecting', deadlineAt, members: [{ items: [item('letter', 'a')] }, { items: [item('letter', 'b')] }] };
  assert.equal(autoSealReason(partial, before), null);
  assert.equal(autoSealReason(partial, after), 'deadline');
  const full = { status: 'collecting', deadlineAt, members: [{ items: five('a') }, { items: five('b') }] };
  assert.equal(isEveryoneFull(full), true);
  assert.equal(autoSealReason(full, before), 'everyone-full');
  const lonely = { status: 'collecting', deadlineAt, members: [{ items: five('a') }] };
  assert.equal(autoSealReason(lonely, after), null, '혼자면 마감이 지나도 닫지 않는다(취소 대상)');
  assert.equal(autoSealReason({ ...partial, status: 'sealed' }, after), null);
});

test('INV-03: 초대 코드는 헷갈리는 글자 없이 6자리', () => {
  const code = generateInviteCode();
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.equal(generateInviteCode(() => 0), 'AAAAAA');
});

test('PIT-01: 여는 시각은 만든 날 기준 30일 이후이면서 넣기 마감보다 뒤', () => {
  const local = (y, m, d, h = 0) => new Date(y, m - 1, d, h).toISOString();
  const createdAt = local(2026, 10, 27, 19);
  const deadlineAt = local(2026, 11, 3, 19);
  assert.equal(isValidOpenAtForCreate(createdAt, deadlineAt, local(2026, 11, 26, 19)), true);
  assert.equal(isValidOpenAtForCreate(createdAt, deadlineAt, local(2026, 11, 20, 19)), false);
  assert.equal(isValidOpenAtForCreate(createdAt, local(2026, 12, 1, 19), local(2026, 11, 26, 19)), false, '마감보다 먼저 열 수 없다');
});
