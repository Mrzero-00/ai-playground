import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import { URL } from 'node:url';

import { addDays, MAX_MEMBERS, VIDEO_MAX_MS, type Capsule } from '../src/domain/capsule';
import { MEDIA_LIMITS_BYTES, MEDIA_URL_TTL_MS, type CreateCapsuleInput } from '../src/shared/capsule-api';
import { createCapsuleServer, type CapsuleServerOptions } from './app';

const START_TIME = Date.UTC(2026, 8, 15, 3, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const fixtureBase64 = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url)).toString('base64');
const WAV = fixtureBase64('tone.wav');
const MP4 = fixtureBase64('blue.mp4');
// Minimal EBML header with DocType "webm" — enough for the container sniff.
const WEBM = Buffer.concat([
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84]),
  Buffer.from('webm', 'ascii'),
  Buffer.alloc(16),
]).toString('base64');

type ApiResult = { status: number; headers: Headers; body: any; text: string };

async function fixture(t: TestContext, options: Partial<CapsuleServerOptions> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'capsule-server-'));
  const databasePath = join(directory, 'capsules.sqlite');
  let currentTime = START_TIME;
  const app = createCapsuleServer({ databasePath, now: () => currentTime, onError: (error) => { throw error; }, corsOrigins: [], ...options });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const baseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  t.after(async () => {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  });

  async function request(path: string, init: { method?: string; body?: unknown; token?: string; headers?: Record<string, string>; raw?: string } = {}): Promise<ApiResult> {
    const headers: Record<string, string> = { ...init.headers };
    if (init.token) headers.Authorization = `Bearer ${init.token}`;
    if (init.body !== undefined || init.raw !== undefined) headers['Content-Type'] ??= 'application/json';
    const response = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
    });
    const text = await response.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    return { status: response.status, headers: response.headers, body, text };
  }

  async function session(displayName?: string) {
    const result = await request('/sessions', { method: 'POST', body: displayName === undefined ? {} : { displayName } });
    assert.equal(result.status, 201, result.text);
    return result.body.token as string;
  }

  const createdIso = () => new Date(currentTime).toISOString();
  function input(overrides: Partial<CreateCapsuleInput> = {}): CreateCapsuleInput {
    return { title: '한 달 뒤의 우리', mode: 'group', deadlineDays: 1, openAt: addDays(createdIso(), 40), ...overrides };
  }
  async function create(token: string, overrides: Partial<CreateCapsuleInput> = {}): Promise<Capsule> {
    const result = await request('/capsules', { method: 'POST', token, body: input(overrides) });
    assert.equal(result.status, 201, result.text);
    return result.body.capsule;
  }
  async function joinCode(token: string, code: string) {
    return request('/capsules/join', { method: 'POST', token, body: { code } });
  }
  async function add(token: string, capsuleId: string, body: Record<string, unknown> = { kind: 'letter', text: '안녕, 미래의 나' }) {
    return request(`/capsules/${capsuleId}/items`, { method: 'POST', token, body });
  }
  async function get(token: string, capsuleId: string): Promise<Capsule> {
    const result = await request(`/capsules/${capsuleId}`, { token });
    assert.equal(result.status, 200, result.text);
    return result.body.capsule;
  }
  /** Group capsule with a host and one friend who joined by invite code. */
  async function pair() {
    const host = await session('민지');
    const friend = await session('상길');
    const capsule = await create(host);
    assert.equal((await joinCode(friend, capsule.inviteCode)).status, 200);
    return { host, friend, capsule };
  }

  return {
    databasePath,
    request,
    session,
    input,
    create,
    join: joinCode,
    add,
    get,
    pair,
    advance: (ms: number) => { currentTime += ms; },
    setTime: (time: number) => { currentTime = time; },
    get now() { return currentTime; },
  };
}

const me = (capsule: Capsule) => capsule.members.find((member) => member.isMe)!;
const other = (capsule: Capsule) => capsule.members.find((member) => !member.isMe)!;

test('health reports server time', async (t) => {
  const f = await fixture(t);
  const result = await f.request('/health');
  assert.deepEqual(result.body, { ok: true, serverNow: new Date(START_TIME).toISOString() });
});

test('sessions mint a token, default the name to 나 and validate display names', async (t) => {
  const f = await fixture(t);
  const empty = await f.request('/sessions', { method: 'POST' });
  assert.equal(empty.status, 201);
  assert.equal(empty.body.displayName, '나');
  assert.match(empty.body.token, /^[A-Za-z0-9_-]{43}$/);
  const named = await f.request('/sessions', { method: 'POST', body: { displayName: '  민지  ' } });
  assert.equal(named.body.displayName, '민지');
  const tooLong = await f.request('/sessions', { method: 'POST', body: { displayName: '가'.repeat(13) } });
  assert.equal(tooLong.status, 400);
  assert.equal(tooLong.body.error.code, 'VALIDATION');

  const capsule = await f.create(named.body.token);
  const renamed = await f.request('/sessions/me', { method: 'PATCH', token: named.body.token, body: { displayName: '민지짱' } });
  assert.deepEqual(renamed.body, { displayName: '민지짱' });
  assert.equal(me(await f.get(named.body.token, capsule.id)).name, '민지짱');
  assert.equal((await f.request('/sessions/me', { method: 'PATCH', token: named.body.token, body: { displayName: ' ' } })).status, 400);
});

test('every non-session route requires a valid bearer token, and only its hash is stored', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request('/capsules')).status, 401);
  const bad = await f.request('/capsules', { token: 'A'.repeat(43) });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error.code, 'UNAUTHORIZED');
  const token = await f.session();
  const db = new DatabaseSync(f.databasePath);
  const stored = db.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[];
  db.close();
  assert.ok(stored.every((row) => row.token_hash !== token && /^[a-f0-9]{64}$/.test(row.token_hash)));
  assert.equal(statSync(f.databasePath).mode & 0o777, 0o600);
});

test('create validates title, mode, deadline options and the openAt window', async (t) => {
  const f = await fixture(t);
  const token = await f.session();
  const post = (overrides: Record<string, unknown>) => f.request('/capsules', { method: 'POST', token, body: { ...f.input(), ...overrides } });
  for (const overrides of [
    { title: '' },
    { title: '가'.repeat(31) },
    { mode: 'party' },
    { deadlineDays: 2 },
    { deadlineDays: '7' },
    { openAt: addDays(new Date(START_TIME).toISOString(), 10) },
    { openAt: addDays(new Date(START_TIME).toISOString(), 200) },
    { openAt: 'someday' },
    { location: { latitude: 200, longitude: 0 } },
  ]) {
    const result = await post(overrides);
    assert.equal(result.status, 400, JSON.stringify(overrides));
    assert.equal(result.body.error.code, 'VALIDATION');
    assert.ok(result.body.error.message.length > 0);
  }
  const ok = await post({ title: '  우리 셋  ', deadlineDays: 14, location: { latitude: 37.5, longitude: 127, accuracy: 12, label: '한강' } });
  assert.equal(ok.status, 201, ok.text);
  const capsule: Capsule = ok.body.capsule;
  assert.equal(capsule.title, '우리 셋');
  assert.equal(capsule.status, 'collecting');
  assert.equal(capsule.deadlineAt, addDays(capsule.createdAt, 14));
  assert.match(capsule.inviteCode, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(capsule.location?.label, '한강');
  assert.equal(capsule.location?.plantedAt, capsule.createdAt);
  assert.equal(capsule.members.length, 1);
  assert.deepEqual({ ...me(capsule), id: 'x' }, { id: 'x', name: '나', isMe: true, isHost: true, items: [] });
  assert.equal(ok.body.serverNow, new Date(START_TIME).toISOString());
});

test('solo capsule: one letter is enough to seal', async (t) => {
  const f = await fixture(t);
  const token = await f.session();
  const capsule = await f.create(token, { mode: 'solo' });
  const empty = await f.request(`/capsules/${capsule.id}/seal`, { method: 'POST', token });
  assert.equal(empty.status, 409);
  assert.equal(empty.body.error.code, 'CANNOT_SEAL');
  assert.equal((await f.add(token, capsule.id)).status, 201);
  const sealed = await f.request(`/capsules/${capsule.id}/seal`, { method: 'POST', token });
  assert.equal(sealed.status, 200, sealed.text);
  assert.equal(sealed.body.capsule.status, 'sealed');
  assert.equal(sealed.body.capsule.sealedAt, new Date(START_TIME).toISOString());
  assert.equal(sealed.body.capsule.openAt, capsule.openAt);
  // A retry returns the same sealed capsule.
  assert.equal((await f.request(`/capsules/${capsule.id}/seal`, { method: 'POST', token })).body.capsule.status, 'sealed');
});

test('group capsule: seal refused with one contributor, allowed with two; lowercase invite code joins', async (t) => {
  const f = await fixture(t);
  const host = await f.session('민지');
  const friend = await f.session('상길');
  const capsule = await f.create(host);
  const joined = await f.join(friend, `${capsule.inviteCode.slice(0, 3).toLowerCase()}-${capsule.inviteCode.slice(3).toLowerCase()}`);
  assert.equal(joined.status, 200, joined.text);
  assert.equal(joined.body.already, false);
  assert.equal(joined.body.capsule.members.length, 2);
  assert.deepEqual(me(joined.body.capsule).name, '상길');
  assert.equal(me(joined.body.capsule).isHost, false);
  const again = await f.join(friend, capsule.inviteCode);
  assert.equal(again.status, 200);
  assert.equal(again.body.already, true);

  await f.add(host, capsule.id);
  await f.add(host, capsule.id);
  const refused = await f.request(`/capsules/${capsule.id}/seal`, { method: 'POST', token: host });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.error.code, 'CANNOT_SEAL');
  await f.add(friend, capsule.id);
  const notHost = await f.request(`/capsules/${capsule.id}/seal`, { method: 'POST', token: friend });
  assert.equal(notHost.status, 403);
  assert.equal(notHost.body.error.code, 'NOT_HOST');
  const sealed = await f.request(`/capsules/${capsule.id}/seal`, { method: 'POST', token: host });
  assert.equal(sealed.status, 200);
  assert.equal(sealed.body.capsule.status, 'sealed');
});

test('a sixth item is SLOTS_FULL; items need valid letters, media families and durations', async (t) => {
  const f = await fixture(t);
  const { host, capsule } = await f.pair();
  const tooLong = await f.add(host, capsule.id, { kind: 'letter', text: '가'.repeat(181) });
  assert.equal(tooLong.body.error.code, 'VALIDATION');
  assert.equal((await f.add(host, capsule.id, { kind: 'letter', text: '   ' })).body.error.code, 'VALIDATION');
  assert.equal((await f.add(host, capsule.id, { kind: 'photo' })).body.error.code, 'VALIDATION');
  assert.equal((await f.add(host, capsule.id, { kind: 'sticker' })).body.error.code, 'VALIDATION');
  const wrongFamily = await f.add(host, capsule.id, { kind: 'photo', media: { mimeType: 'audio/wav', base64: WAV } });
  assert.equal(wrongFamily.status, 400);
  assert.equal(wrongFamily.body.error.code, 'VALIDATION');
  const longVideo = await f.add(host, capsule.id, { kind: 'video', durationMs: VIDEO_MAX_MS + 1, media: { mimeType: 'video/mp4', base64: MP4 } });
  assert.equal(longVideo.body.error.code, 'VALIDATION');
  const longVoice = await f.add(host, capsule.id, { kind: 'voice', durationMs: 60_001, media: { mimeType: 'audio/wav', base64: WAV } });
  assert.equal(longVoice.body.error.code, 'VALIDATION');

  const added = [
    await f.add(host, capsule.id),
    await f.add(host, capsule.id, { kind: 'photo', media: { mimeType: 'image/png', base64: PNG } }),
    await f.add(host, capsule.id, { kind: 'voice', durationMs: 100, media: { mimeType: 'audio/wav', base64: WAV } }),
    await f.add(host, capsule.id, { kind: 'voice', durationMs: 900, media: { mimeType: 'audio/webm', base64: WEBM } }),
    await f.add(host, capsule.id, { kind: 'video', durationMs: 3000, media: { mimeType: 'video/mp4', base64: MP4 } }),
  ];
  for (const result of added) assert.equal(result.status, 201, result.text);
  assert.equal(added[2].body.item.durationMs, 100);
  assert.ok(added[1].body.item.uri.startsWith(`/capsules/${capsule.id}/items/`));
  const sixth = await f.add(host, capsule.id);
  assert.equal(sixth.status, 409);
  assert.equal(sixth.body.error.code, 'SLOTS_FULL');
  // Deleting one frees a slot.
  const removed = await f.request(`/capsules/${capsule.id}/items/${added[0].body.item.id}`, { method: 'DELETE', token: host });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.item.id, added[0].body.item.id);
  assert.equal(me(removed.body.capsule).items.length, 4);
  assert.equal((await f.add(host, capsule.id)).status, 201);
});

test('media is sniffed: mismatched bytes are MEDIA_INVALID, oversized files 413', async (t) => {
  const f = await fixture(t);
  const token = await f.session();
  const capsule = await f.create(token, { mode: 'solo' });
  for (const media of [
    { mimeType: 'image/jpeg', base64: PNG },
    { mimeType: 'image/webp', base64: PNG },
    { mimeType: 'image/png', base64: 'not base64!' },
  ]) {
    const result = await f.add(token, capsule.id, { kind: 'photo', media });
    assert.equal(result.status, 400, JSON.stringify(media));
    assert.equal(result.body.error.code, 'MEDIA_INVALID');
  }
  assert.equal((await f.add(token, capsule.id, { kind: 'voice', media: { mimeType: 'audio/webm', base64: WAV } })).body.error.code, 'MEDIA_INVALID');
  assert.equal((await f.add(token, capsule.id, { kind: 'video', media: { mimeType: 'video/quicktime', base64: MP4 } })).body.error.code, 'MEDIA_INVALID');
  assert.equal((await f.add(token, capsule.id, { kind: 'video', media: { mimeType: 'video/webm', base64: WEBM } })).status, 201);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]).toString('base64');
  assert.equal((await f.add(token, capsule.id, { kind: 'photo', media: { mimeType: 'image/jpeg', base64: jpeg } })).status, 201);

  const huge = Buffer.alloc(MEDIA_LIMITS_BYTES.photo + 3);
  Buffer.from(PNG, 'base64').copy(huge);
  const oversized = await f.add(token, capsule.id, { kind: 'photo', media: { mimeType: 'image/png', base64: huge.toString('base64') } });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.body.error.code, 'PAYLOAD_TOO_LARGE');
  const bigJson = await f.request('/capsules', { method: 'POST', token, body: { ...f.input(), title: 'x'.repeat(40_000) } });
  assert.equal(bigJson.status, 413);
  assert.equal(bigJson.body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('visibility: own items while collecting, nobody while sealed, everyone once opened; media URLs follow', async (t) => {
  const f = await fixture(t);
  const { host, friend, capsule } = await f.pair();
  const letter = await f.add(host, capsule.id, { kind: 'letter', text: '비밀 편지' });
  const photo = await f.add(host, capsule.id, { kind: 'photo', media: { mimeType: 'image/png', base64: PNG } });
  await f.add(friend, capsule.id, { kind: 'voice', durationMs: 100, media: { mimeType: 'audio/wav', base64: WAV } });

  const hostView = await f.get(host, capsule.id);
  assert.equal(me(hostView).items[0].text, '비밀 편지');
  const ownUri = me(hostView).items[1].uri!;
  assert.match(ownUri, /^\/capsules\/[^/]+\/items\/[^/]+\/media\?m=[^&]+&exp=\d+&sig=[a-f0-9]{64}$/);
  assert.equal(other(hostView).items[0].text, undefined);
  assert.equal(other(hostView).items[0].uri, undefined);
  assert.equal(other(hostView).items[0].durationMs, 100);

  const friendView = await f.get(friend, capsule.id);
  assert.deepEqual(other(friendView).items.map((item) => Object.keys(item).sort()), [['createdAt', 'id', 'kind'], ['createdAt', 'id', 'kind']]);
  assert.ok(!JSON.stringify(friendView).includes('비밀 편지'));

  const media = await f.request(ownUri);
  assert.equal(media.status, 200);
  assert.equal(media.headers.get('content-type'), 'image/png');
  assert.equal(media.headers.get('cache-control'), 'private, no-store');
  assert.equal(Buffer.from(media.text, 'latin1').length > 0, true);
  // The friend cannot re-sign the host's URL as themselves, nor tamper with it.
  const friendMemberId = me(friendView).id;
  assert.equal((await f.request(ownUri.replace(/m=[^&]+/, `m=${friendMemberId}`))).status, 403);
  assert.equal((await f.request(ownUri.replace(/sig=[a-f0-9]{4}/, 'sig=0000'))).status, 403);
  assert.equal((await f.request(ownUri.replace(/exp=\d+/, `exp=${f.now + MEDIA_URL_TTL_MS * 10}`))).status, 403);
  assert.equal((await f.request(`/capsules/${capsule.id}/items/${photo.body.item.id}/media`)).status, 403);
  // Own item edits are allowed; another member's are not found.
  const edited = await f.request(`/capsules/${capsule.id}/items/${letter.body.item.id}`, { method: 'PATCH', token: host, body: { text: '고친 편지' } });
  assert.equal(edited.status, 200, edited.text);
  assert.equal(edited.body.item.text, '고친 편지');
  assert.equal((await f.request(`/capsules/${capsule.id}/items/${letter.body.item.id}`, { method: 'PATCH', token: friend, body: { text: '내가 고침' } })).status, 404);
  assert.equal((await f.request(`/capsules/${capsule.id}/items/${letter.body.item.id}`, { method: 'DELETE', token: friend })).status, 404);

  // Sealed: nobody sees text or uri, not even the author, and old URLs stop working.
  assert.equal((await f.request(`/capsules/${capsule.id}/seal`, { method: 'POST', token: host })).status, 200);
  const sealedView = await f.get(host, capsule.id);
  assert.ok(sealedView.members.every((member) => member.items.every((item) => item.text === undefined && item.uri === undefined)));
  assert.equal((await f.request(ownUri)).status, 403);
  const closedEdit = await f.request(`/capsules/${capsule.id}/items/${letter.body.item.id}`, { method: 'PATCH', token: host, body: { text: '늦은 수정' } });
  assert.equal(closedEdit.body.error.code, 'CAPSULE_CLOSED');
  assert.equal((await f.add(friend, capsule.id)).body.error.code, 'CAPSULE_CLOSED');
  assert.equal((await f.request(`/capsules/${capsule.id}/items/${letter.body.item.id}`, { method: 'DELETE', token: host })).body.error.code, 'CAPSULE_CLOSED');

  // Opened: everyone sees everything; the friend gets a working URL for the host's photo.
  f.setTime(Date.parse(capsule.openAt!));
  const opened = await f.request(`/capsules/${capsule.id}/open`, { method: 'POST', token: friend });
  assert.equal(opened.status, 200, opened.text);
  const hostItems = other(opened.body.capsule as Capsule).items;
  assert.equal(hostItems[0].text, '고친 편지');
  const friendUri = hostItems[1].uri!;
  assert.equal((await f.request(friendUri)).status, 200);
  f.advance(MEDIA_URL_TTL_MS + 1);
  assert.equal((await f.request(friendUri)).status, 403);
});

test('open: NOT_SEALED while collecting, TOO_EARLY before openAt, then any member opens', async (t) => {
  const f = await fixture(t);
  const { host, friend, capsule } = await f.pair();
  const notSealed = await f.request(`/capsules/${capsule.id}/open`, { method: 'POST', token: host });
  assert.equal(notSealed.status, 409);
  assert.equal(notSealed.body.error.code, 'NOT_SEALED');
  await f.add(host, capsule.id);
  await f.add(friend, capsule.id);
  await f.request(`/capsules/${capsule.id}/seal`, { method: 'POST', token: host });
  f.setTime(Date.parse(capsule.openAt!) - 1);
  const early = await f.request(`/capsules/${capsule.id}/open`, { method: 'POST', token: friend });
  assert.equal(early.status, 409);
  assert.equal(early.body.error.code, 'TOO_EARLY');
  f.advance(1);
  const opened = await f.request(`/capsules/${capsule.id}/open`, { method: 'POST', token: friend });
  assert.equal(opened.status, 200);
  assert.equal(opened.body.capsule.status, 'opened');
  assert.equal(opened.body.capsule.openedAt, capsule.openAt);
  f.advance(DAY);
  const again = await f.request(`/capsules/${capsule.id}/open`, { method: 'POST', token: host });
  assert.equal(again.status, 200);
  assert.equal(again.body.capsule.openedAt, capsule.openAt);
});

test('auto-seal when the deadline passes with enough contributors', async (t) => {
  const f = await fixture(t);
  const { host, friend, capsule } = await f.pair();
  await f.add(host, capsule.id);
  await f.add(friend, capsule.id);
  f.advance(DAY - 1);
  assert.equal((await f.get(host, capsule.id)).status, 'collecting');
  f.advance(1);
  const list = await f.request('/capsules', { token: friend });
  assert.equal(list.body.capsules[0].status, 'sealed');
  assert.equal(list.body.capsules[0].sealedAt, capsule.deadlineAt);
  assert.equal(list.body.serverNow, capsule.deadlineAt);
  assert.equal((await f.add(host, capsule.id)).body.error.code, 'CAPSULE_CLOSED');
});

test('past the deadline with one contributor the capsule keeps collecting until a second one adds', async (t) => {
  const f = await fixture(t);
  const { host, friend, capsule } = await f.pair();
  await f.add(host, capsule.id);
  f.advance(2 * DAY);
  assert.equal((await f.get(host, capsule.id)).status, 'collecting');
  const second = await f.add(friend, capsule.id);
  assert.equal(second.status, 201);
  assert.equal(second.body.capsule.status, 'sealed');
});

test('auto-seal when everyone has filled five slots', async (t) => {
  const f = await fixture(t);
  const { host, friend, capsule } = await f.pair();
  for (let index = 0; index < 5; index += 1) assert.equal((await f.add(host, capsule.id)).status, 201);
  for (let index = 0; index < 4; index += 1) assert.equal((await f.add(friend, capsule.id)).status, 201);
  assert.equal((await f.get(host, capsule.id)).status, 'collecting');
  const last = await f.add(friend, capsule.id);
  assert.equal(last.status, 201);
  assert.equal(last.body.capsule.status, 'sealed');
  assert.equal(last.body.item.text, undefined);
});

test('join errors: unknown code, closed capsule, solo capsule, full at eight', async (t) => {
  const f = await fixture(t);
  const host = await f.session();
  const stranger = await f.session();
  const missing = await f.join(stranger, 'ZZZZZZ');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'INVITE_NOT_FOUND');
  assert.equal((await f.join(stranger, '12')).body.error.code, 'INVITE_NOT_FOUND');

  const solo = await f.create(host, { mode: 'solo' });
  const soloJoin = await f.join(stranger, solo.inviteCode);
  assert.equal(soloJoin.status, 409);
  assert.equal(soloJoin.body.error.code, 'CAPSULE_CLOSED');

  const group = await f.create(host);
  for (let index = 1; index < MAX_MEMBERS; index += 1) {
    assert.equal((await f.join(await f.session(`친구${index}`), group.inviteCode)).status, 200);
  }
  const full = await f.join(stranger, group.inviteCode);
  assert.equal(full.status, 409);
  assert.equal(full.body.error.code, 'CAPSULE_FULL');
  assert.equal((await f.get(host, group.id)).members.length, MAX_MEMBERS);

  const sealedPair = await f.pair();
  await f.add(sealedPair.host, sealedPair.capsule.id);
  await f.add(sealedPair.friend, sealedPair.capsule.id);
  await f.request(`/capsules/${sealedPair.capsule.id}/seal`, { method: 'POST', token: sealedPair.host });
  const closed = await f.join(stranger, sealedPair.capsule.inviteCode);
  assert.equal(closed.status, 409);
  assert.equal(closed.body.error.code, 'CAPSULE_CLOSED');
  // Non-members cannot read the capsule at all.
  assert.equal((await f.request(`/capsules/${sealedPair.capsule.id}`, { token: stranger })).status, 404);
});

test('plant is host only and stores the chosen spot', async (t) => {
  const f = await fixture(t);
  const { host, friend, capsule } = await f.pair();
  assert.equal(capsule.location, null);
  const location = { latitude: 37.5665, longitude: 126.978, accuracy: 8, label: '서울광장', plantedAt: '2000-01-01T00:00:00.000Z' };
  const denied = await f.request(`/capsules/${capsule.id}/plant`, { method: 'POST', token: friend, body: { location } });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'NOT_HOST');
  f.advance(1000);
  const planted = await f.request(`/capsules/${capsule.id}/plant`, { method: 'POST', token: host, body: { location } });
  assert.equal(planted.status, 200, planted.text);
  assert.deepEqual(planted.body.capsule.location, { ...location, plantedAt: new Date(f.now).toISOString() });
  assert.deepEqual((await f.get(friend, capsule.id)).location, planted.body.capsule.location);
});

test('list returns only my capsules, newest first', async (t) => {
  const f = await fixture(t);
  const a = await f.session();
  const b = await f.session();
  const first = await f.create(a, { title: '첫째' });
  f.advance(1000);
  const second = await f.create(a, { title: '둘째' });
  await f.create(b, { title: '남의 것' });
  const list = await f.request('/capsules', { token: a });
  assert.deepEqual(list.body.capsules.map((capsule: Capsule) => capsule.id), [second.id, first.id]);
});

test('CORS allows local origins and CORS_ORIGINS, rejects others', async (t) => {
  const f = await fixture(t, { corsOrigins: ['https://mudeodooji.vercel.app'] });
  const preflight = await f.request('/capsules', { method: 'OPTIONS', headers: { Origin: 'https://mudeodooji.vercel.app' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://mudeodooji.vercel.app');
  assert.match(preflight.headers.get('access-control-allow-headers') ?? '', /Authorization, Content-Type/);
  assert.match(preflight.headers.get('access-control-allow-methods') ?? '', /PATCH/);
  const local = await f.request('/health', { headers: { Origin: 'http://localhost:8081' } });
  assert.equal(local.headers.get('access-control-allow-origin'), 'http://localhost:8081');
  const evil = await f.request('/health', { headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.status, 403);
  assert.equal(evil.body.error.code, 'ORIGIN_NOT_ALLOWED');
});

test('a legacy PoC database is replaced by the new schema', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'capsule-legacy-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const databasePath = join(directory, 'capsules.sqlite');
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`CREATE TABLE sessions (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);
    CREATE TABLE capsules (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES sessions(id), title TEXT NOT NULL);`);
  legacy.close();
  const app = createCapsuleServer({ databasePath, onError: (error) => { throw error; } });
  await app.close();
  const db = new DatabaseSync(databasePath);
  const columns = (db.prepare('PRAGMA table_info(capsules)').all() as { name: string }[]).map((column) => column.name);
  db.close();
  assert.ok(columns.includes('invite_code'));
});
