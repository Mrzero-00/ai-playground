import assert from 'node:assert/strict';
import test from 'node:test';

import { LocalBackend } from '../src/state/local-backend.ts';
import { BackendError } from '../src/state/backend.ts';

const base = new Date('2026-10-27T10:00:00+09:00');
const openAt = new Date('2026-12-10T19:00:00+09:00').toISOString();

function backend(initial = [], now = () => base) {
  return new LocalBackend({ initial, now, displayName: '나' });
}

test('로컬 백엔드: 만들기 → 넣기 → 혼자 닫기 → 여는 날 지나면 열기', async () => {
  let current = base;
  const b = backend([], () => current);
  const capsule = await b.create({ title: ' 백 일 뒤 ', mode: 'solo', deadlineDays: 7, openAt, location: null });
  assert.equal(capsule.title, '백 일 뒤');
  assert.equal(capsule.inviteCode.length, 6);
  await assert.rejects(b.seal(capsule.id), (error) => error instanceof BackendError && error.code === 'CANNOT_SEAL');
  const { item } = await b.addItem(capsule.id, { kind: 'letter', text: '안녕' });
  assert.equal(item.kind, 'letter');
  const sealed = await b.seal(capsule.id);
  assert.equal(sealed.status, 'sealed');
  await assert.rejects(b.open(capsule.id), (error) => error.code === 'TOO_EARLY');
  current = new Date('2026-12-10T19:00:01+09:00');
  const opened = await b.open(capsule.id);
  assert.equal(opened.status, 'opened');
});

test('로컬 백엔드: 혼자 캡슐은 5개를 다 넣으면 저절로 닫히고, 그 뒤엔 못 넣는다', async () => {
  const b = backend();
  const capsule = await b.create({ title: 'x', mode: 'solo', deadlineDays: 1, openAt });
  for (let i = 0; i < 5; i += 1) await b.addItem(capsule.id, { kind: 'photo', uri: `p${i}` });
  const [after] = await b.load();
  assert.equal(after.status, 'sealed', '전원(나 혼자)이 5개를 다 넣었으니 저절로 닫힌다');
  await assert.rejects(b.addItem(capsule.id, { kind: 'letter', text: 'late' }), (error) => error.code === 'CAPSULE_CLOSED');
});

test('로컬 백엔드: 함께 캡슐에서 내 5칸이 차면 SLOTS_FULL', async () => {
  const five = Array.from({ length: 5 }, (_, i) => ({ id: `me${i}`, kind: 'photo', createdAt: base.toISOString(), uri: `p${i}` }));
  const b = backend([{
    id: 'g', title: 'g', createdAt: base.toISOString(), deadlineAt: '2026-11-03T10:00:00+09:00', status: 'collecting', sealedAt: null, openAt, openedAt: null, inviteCode: 'GROUP1', mode: 'group',
    members: [{ id: 'me', name: '나', isMe: true, isHost: true, items: five }, { id: 'minji', name: '민지', isMe: false, isHost: false, items: [] }],
  }]);
  await assert.rejects(b.addItem('g', { kind: 'letter', text: '6번째' }), (error) => error.code === 'SLOTS_FULL');
  await b.removeItem('g', 'me0');
  const { item } = await b.addItem('g', { kind: 'letter', text: '다시' });
  assert.equal(item.text, '다시');
});

test('로컬 백엔드: 초대 코드로 들어가기와 거절 사유', async () => {
  const friend = (id, inviteCode, extra = {}) => ({
    id, title: id, createdAt: base.toISOString(), deadlineAt: '2026-11-03T10:00:00+09:00', status: 'collecting', sealedAt: null, openAt, openedAt: null, inviteCode, mode: 'group',
    members: [{ id: 'minji', name: '민지', isMe: false, isHost: true, items: [{ id: 'm1', kind: 'letter', createdAt: base.toISOString(), text: '…' }] }],
    ...extra,
  });
  const full = friend('full', 'FULLCP', { members: Array.from({ length: 8 }, (_, i) => ({ id: `u${i}`, name: `u${i}`, isMe: false, isHost: i === 0, items: [] })) });
  const b = backend([friend('river', 'RIVER7'), friend('closed', 'CLOSED', { status: 'sealed' }), friend('solo', 'SOLOCP', { mode: 'solo' }), full]);
  assert.equal((await b.load()).length, 0, '들어가기 전에는 안 보인다');
  const joined = await b.join('river-7');
  assert.equal(joined.already, false);
  assert.equal(joined.capsule.members.find((m) => m.isMe)?.isHost, false);
  assert.equal((await b.join('RIVER7')).already, true);
  assert.equal((await b.load()).length, 1);
  await assert.rejects(b.join('NOPE00'), (error) => error.code === 'INVITE_NOT_FOUND');
  await assert.rejects(b.join('CLOSED'), (error) => error.code === 'CAPSULE_CLOSED');
  await assert.rejects(b.join('SOLOCP'), (error) => error.code === 'CAPSULE_CLOSED');
  await assert.rejects(b.join('FULLCP'), (error) => error.code === 'CAPSULE_FULL');
  // 함께 캡슐은 2명이 넣어야 닫힌다. 방장이 아니면 닫을 수 없다.
  await b.addItem('river', { kind: 'letter', text: '나도' });
  await assert.rejects(b.seal('river'), (error) => error.code === 'NOT_HOST');
});

test('로컬 백엔드: 마감이 지나면 읽을 때 저절로 닫힌다', async () => {
  let current = base;
  const b = backend([], () => current);
  const capsule = await b.create({ title: 'x', mode: 'solo', deadlineDays: 1, openAt });
  await b.addItem(capsule.id, { kind: 'letter', text: '하나' });
  current = new Date('2026-10-29T10:00:00+09:00');
  const [after] = await b.load();
  assert.equal(after.status, 'sealed');
});
