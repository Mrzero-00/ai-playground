import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { URL } from 'node:url';
import { ATTENDANCE_TTL_MS, type LocationFix } from '../src/shared/contracts';
import { createCapsuleServer } from './app';

const SECRET = '우리 셋이 모여야 읽는 편지';
const PHOTO = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const audio = { mimeType: 'audio/wav', fileName: 'tone.wav', base64: readFileSync(new URL('./fixtures/tone.wav', import.meta.url)).toString('base64') };
const video = { mimeType: 'video/mp4', fileName: 'blue.mp4', base64: readFileSync(new URL('./fixtures/blue.mp4', import.meta.url)).toString('base64') };
const content = { letter: SECRET, photo: { mimeType: 'image/png', base64: PHOTO }, audio, video };
function privateSafe(value: unknown) {
  const text = JSON.stringify(value);
  for (const secret of [SECRET, PHOTO, audio.base64, video.base64, audio.fileName, video.fileName]) assert.ok(!text.includes(secret));
  function scan(v: unknown) {
    if (!v || typeof v !== 'object') return;
    for (const [key, child] of Object.entries(v)) {
      assert.ok(!['content', 'letter', 'photo', 'audio', 'video', 'base64', 'fileName', 'session_id', 'host_id', 'token_hash'].includes(key), key);
      scan(child);
    }
  }
  scan(value);
}
async function fixture(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'dooji-group-test-'));
  const databasePath = join(dir, 'capsules.sqlite');
  let time = Date.UTC(2026, 8, 17, 12);
  let app = createCapsuleServer({ databasePath, now: () => time });
  let base = '';
  async function listen() {
    app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  }
  await listen();
  t.after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });
  async function req(path: string, token: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal(res.headers.get('cache-control'), 'no-store');
    return { status: res.status, body: await res.json() };
  }
  const tokens: string[] = [];
  for (let i = 0; i < 5; i++) tokens.push((await req('/sessions', '', {})).body.token);
  const loc = (changes: Partial<LocationFix> = {}): LocationFix => ({ latitude: 37.5665, longitude: 126.978, accuracy: 5, timestamp: time, ...changes });
  const createGroup = (count = 3) => req('/groups', tokens[0], { title: '우리의 모임', expectedCount: count, displayName: '첫째' });
  const joinGroup = (code: string, index: number, name = `친구${index}`) => req('/groups/join', tokens[index], { inviteCode: code, displayName: name });
  const input = (groupId?: string) => ({ title: '다 함께 여는 약속', placeName: '만났던 자리', unlockAfterSeconds: 15, location: loc(), content, ...(groupId ? { groupId } : {}) });
  async function sealed(count = 3) {
    const made = await createGroup(count);
    assert.equal(made.status, 201);
    const group = made.body.group;
    for (let i = 1; i < count; i++) assert.equal((await joinGroup(group.inviteCode, i)).status, 200);
    const result = await req('/capsules', tokens[0], input(group.id), { 'Idempotency-Key': 'group-seal-test-key-0001' });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return { group, capsule: result.body.capsule };
  }
  const start = (id: string, who: number, location = loc()) => req(`/capsules/${id}/attendance/start`, tokens[who], { location });
  const beat = (id: string, who: number, token: string, sequence: number, location = loc()) => req(`/capsules/${id}/attendance/heartbeat`, tokens[who], { attendanceToken: token, sequence, location });
  const open = (id: string, who: number, token?: string, location = loc()) => req(`/capsules/${id}/open`, tokens[who], { location, attendanceToken: token });
  return { tokens, req, loc, input, createGroup, joinGroup, sealed, start, beat, open,
    advance(ms: number) { time += ms; },
    async restart() { await app.close(); app = createCapsuleServer({ databasePath, now: () => time }); await listen(); } };
}

test('group size is validated; names and member capacity cannot be forged', async t => {
  const f = await fixture(t);
  for (const expectedCount of [1, 21, 2.5, '3', null]) {
    const res = await f.req('/groups', f.tokens[0], { title: '모임', displayName: '나', expectedCount });
    assert.equal(res.status, 400);
  }
  const g = (await f.createGroup(2)).body.group;
  assert.equal(g.members.length, 1); assert.equal(g.members[0].isMe, true);
  assert.match(g.inviteCode, /^[A-F0-9]{12}$/);
  assert.equal((await f.joinGroup(g.inviteCode, 1, '첫째')).body.error.code, 'NAME_TAKEN');
  const competing = await Promise.all([1, 2].map(i => f.joinGroup(g.inviteCode, i)));
  assert.deepEqual(competing.map(r => r.status).sort(), [200, 409]);
  const own = (await f.req('/groups', f.tokens[0])).body.groups[0];
  assert.equal(own.members.length, 2);
  privateSafe(own);
});

test('group membership is idempotent per session, not per submitted display name', async t => {
  const f = await fixture(t);
  const g = (await f.createGroup()).body.group;
  await f.joinGroup(g.inviteCode, 1);
  const again = await f.joinGroup(g.inviteCode, 1, '다른 이름');
  assert.equal(again.body.group.members.length, 2);
  assert.ok(again.body.group.members.some((m: { name: string }) => m.name === '친구1'));
  assert.equal((await f.req('/groups', f.tokens[4])).body.groups.length, 0);
  assert.equal((await f.joinGroup('000000000000', 4)).status, 404);
});

test('only the host of a full group may seal; nobody can change a sealed roster', async t => {
  const f = await fixture(t);
  const g = (await f.createGroup()).body.group;
  assert.equal((await f.req('/capsules', f.tokens[0], f.input(g.id))).body.error.code, 'GROUP_INCOMPLETE');
  await f.joinGroup(g.inviteCode, 1); await f.joinGroup(g.inviteCode, 2);
  assert.equal((await f.req('/capsules', f.tokens[1], f.input(g.id))).body.error.code, 'HOST_REQUIRED');
  assert.equal((await f.req('/capsules', f.tokens[4], f.input(g.id))).status, 404);
  const sealed = await f.req('/capsules', f.tokens[0], f.input(g.id));
  assert.equal(sealed.status, 201);
  assert.equal((await f.req('/capsules', f.tokens[0], f.input(g.id))).body.error.code, 'GROUP_SEALED');
  assert.equal((await f.joinGroup(g.inviteCode, 4)).body.error.code, 'GROUP_SEALED');
  assert.equal((await f.req('/groups', f.tokens[1])).body.groups[0].inviteCode, null);
  for (const i of [0, 1, 2]) {
    const list = (await f.req('/capsules', f.tokens[i])).body;
    assert.equal(list.capsules.length, 1); assert.equal(list.capsules[0].participantCount, 3); privateSafe(list);
  }
  assert.equal((await f.req('/capsules', f.tokens[4])).body.capsules.length, 0);
});

test('N-1 cannot open; all N nearby participants can each open all four content types', async t => {
  const f = await fixture(t); const { capsule } = await f.sealed();
  f.advance(15_000);
  const a = (await f.start(capsule.id, 0)).body;
  const b = (await f.start(capsule.id, 1)).body;
  assert.equal(b.eligibility.attendance.presentCount, 2);
  const denied = await f.open(capsule.id, 0, a.attendanceToken);
  assert.equal(denied.status, 403); assert.equal(denied.body.error.code, 'WAITING_PARTICIPANTS'); privateSafe(denied.body);
  const c = (await f.start(capsule.id, 2)).body;
  assert.equal(c.eligibility.code, 'READY');
  for (const [i, p] of [a, b, c].entries()) {
    const opened = await f.open(capsule.id, i, p.attendanceToken);
    assert.equal(opened.status, 200); assert.deepEqual(opened.body.content, content);
  }
  privateSafe((await f.req('/capsules', f.tokens[2])).body);
});

test('everybody gathering early does not bypass the server opening date', async t => {
  const f = await fixture(t); const { capsule } = await f.sealed(2);
  const a = (await f.start(capsule.id, 0)).body;
  await f.start(capsule.id, 1);
  const denied = await f.open(capsule.id, 0, a.attendanceToken);
  assert.equal(denied.body.error.code, 'TOO_EARLY'); privateSafe(denied.body);
});

test('attendance expires at 20 seconds; callers and previously opened capsules still recheck everyone', async t => {
  const f = await fixture(t); const { capsule } = await f.sealed(2); f.advance(15_000);
  const a = (await f.start(capsule.id, 0)).body; const b = (await f.start(capsule.id, 1)).body;
  assert.equal((await f.open(capsule.id, 0, a.attendanceToken)).status, 200);
  f.advance(ATTENDANCE_TTL_MS);
  await f.beat(capsule.id, 0, a.attendanceToken, 1);
  const denied = await f.open(capsule.id, 0, a.attendanceToken);
  assert.equal(denied.body.error.code, 'WAITING_PARTICIPANTS');
  assert.equal(denied.body.eligibility.attendance.presentCount, 1);
  await f.beat(capsule.id, 1, b.attendanceToken, 1);
  assert.equal((await f.open(capsule.id, 0, a.attendanceToken)).status, 200);
});

test('leaving immediately blocks opening and delayed heartbeats cannot resurrect the lease', async t => {
  const f = await fixture(t); const { capsule } = await f.sealed(2); f.advance(15_000);
  const a = (await f.start(capsule.id, 0)).body; const b = (await f.start(capsule.id, 1)).body;
  await f.req(`/capsules/${capsule.id}/attendance/leave`, f.tokens[1], { attendanceToken: b.attendanceToken });
  assert.equal((await f.beat(capsule.id, 1, b.attendanceToken, 1)).body.error.code, 'ATTENDANCE_EXPIRED');
  assert.equal((await f.open(capsule.id, 0, a.attendanceToken)).body.error.code, 'WAITING_PARTICIPANTS');
  const renewed = (await f.start(capsule.id, 1)).body;
  await f.req(`/capsules/${capsule.id}/attendance/leave`, f.tokens[1], { attendanceToken: b.attendanceToken });
  assert.equal((await f.open(capsule.id, 1, renewed.attendanceToken)).status, 200, 'old leave must not erase a new lease');
});

test('a far, stale, inaccurate or mocked heartbeat revokes the previous nearby attendance', async t => {
  const f = await fixture(t); const { capsule } = await f.sealed(2); f.advance(15_000);
  const a = (await f.start(capsule.id, 0)).body;
  for (const fix of [f.loc({ latitude: 38 }), f.loc({ accuracy: 26 }), f.loc({ timestamp: 1 }), f.loc({ mocked: true })]) {
    const b = (await f.start(capsule.id, 1)).body;
    const bad = await f.beat(capsule.id, 1, b.attendanceToken, 1, fix);
    assert.equal(bad.status, 403); privateSafe(bad.body);
    assert.equal((await f.open(capsule.id, 0, a.attendanceToken)).body.error.code, 'WAITING_PARTICIPANTS');
  }
});

test('stale sequence cannot overwrite newer attendance and a stolen peer token cannot count as that peer', async t => {
  const f = await fixture(t); const { capsule } = await f.sealed(2); f.advance(15_000);
  const a = (await f.start(capsule.id, 0)).body; const b = (await f.start(capsule.id, 1)).body;
  assert.equal((await f.beat(capsule.id, 1, b.attendanceToken, 2)).status, 200);
  assert.equal((await f.beat(capsule.id, 1, b.attendanceToken, 1)).body.error.code, 'ATTENDANCE_OUTDATED');
  assert.equal((await f.beat(capsule.id, 0, b.attendanceToken, 3)).body.error.code, 'ATTENDANCE_EXPIRED');
  assert.equal((await f.open(capsule.id, 0, b.attendanceToken)).body.error.code, 'ATTENDANCE_EXPIRED');
  assert.equal((await f.open(capsule.id, 0, a.attendanceToken)).status, 200);
});

test('nonmembers cannot inspect, check in, leave or open a shared capsule', async t => {
  const f = await fixture(t); const { capsule } = await f.sealed();
  for (const path of ['eligibility', 'open', 'attendance/start', 'attendance/heartbeat', 'attendance/leave']) {
    const denied = await f.req(`/capsules/${capsule.id}/${path}`, f.tokens[4], { location: f.loc(), attendanceToken: 'fake', memberId: 'first' });
    assert.equal(denied.status, 404); privateSafe(denied.body);
  }
});

test('a departure reported during open or eligibility immediately invalidates that member for peers', async t => {
  const f = await fixture(t); const { capsule } = await f.sealed(2); f.advance(15_000);
  const a = (await f.start(capsule.id, 0)).body;
  for (const route of ['open', 'eligibility']) {
    const b = (await f.start(capsule.id, 1)).body;
    const far = await f.req(`/capsules/${capsule.id}/${route}`, f.tokens[1], { location: f.loc({ latitude: 38 }), attendanceToken: b.attendanceToken });
    assert.equal(route === 'open' ? far.body.error.code : far.body.code, 'TOO_FAR');
    assert.equal((await f.open(capsule.id, 0, a.attendanceToken)).body.error.code, 'WAITING_PARTICIPANTS');
  }
});

test('restart preserves the roster and content but discards all presence leases', async t => {
  const f = await fixture(t); const { capsule } = await f.sealed(2); f.advance(15_000);
  const a = (await f.start(capsule.id, 0)).body; await f.start(capsule.id, 1);
  await f.restart();
  assert.equal((await f.open(capsule.id, 0, a.attendanceToken)).body.error.code, 'ATTENDANCE_EXPIRED');
  const list = (await f.req('/groups', f.tokens[1])).body.groups;
  assert.equal(list[0].members.length, 2); assert.equal(list[0].capsuleId, capsule.id);
  const renewed = (await f.start(capsule.id, 0)).body; await f.start(capsule.id, 1);
  assert.deepEqual((await f.open(capsule.id, 0, renewed.attendanceToken)).body.content, content);
});

test('group id is part of immutable sealing identity; legacy personal capsules need no attendance', async t => {
  const f = await fixture(t); const { group, capsule } = await f.sealed(2);
  const headers = { 'Idempotency-Key': 'group-seal-test-key-0001' };
  assert.equal((await f.req('/capsules', f.tokens[0], f.input(group.id), headers)).body.capsule.id, capsule.id);
  assert.equal((await f.req('/capsules', f.tokens[0], f.input(), headers)).body.error.code, 'IDEMPOTENCY_CONFLICT');
  const personal = (await f.req('/capsules', f.tokens[0], f.input())).body.capsule;
  assert.equal(personal.groupId, null); assert.equal(personal.participantCount, 1);
  f.advance(15_000);
  assert.equal((await f.open(personal.id, 0)).status, 200);
  assert.equal((await f.open(personal.id, 1)).status, 404);
});
