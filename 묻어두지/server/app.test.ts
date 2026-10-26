import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { URL } from 'node:url';

import {
  MAX_LOCATION_AGE_MS,
  MAX_PHOTO_BYTES,
  MAX_AUDIO_BYTES,
  MAX_VIDEO_BYTES,
  type AudioAttachment,
  type VideoAttachment,
  type CreateCapsuleInput,
  type LocationFix,
} from '../src/shared/contracts';
import { createCapsuleServer, distanceMeters, MAX_LOCATION_FUTURE_MS } from './app';

const START_TIME = Date.UTC(2026, 8, 15, 12, 0, 0);
const SECRET_LETTER = '봉인된 편지: one month later we meet again.';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const AUDIO: AudioAttachment[] = [
  { fileName: 'tone.m4a', mimeType: 'audio/mp4', base64: '' },
  { fileName: 'tone.mp3', mimeType: 'audio/mpeg', base64: '' },
  { fileName: 'tone.wav', mimeType: 'audio/wav', base64: '' },
].map(file => ({ ...file, base64: readFileSync(new URL(`./fixtures/${file.fileName}`, import.meta.url)).toString('base64') })) as AudioAttachment[];
const VIDEO: VideoAttachment[] = [
  { fileName: 'blue.mp4', mimeType: 'video/mp4', base64: '' },
  { fileName: 'blue.mov', mimeType: 'video/quicktime', base64: '' },
].map(file => ({ ...file, base64: readFileSync(new URL(`./fixtures/${file.fileName}`, import.meta.url)).toString('base64') })) as VideoAttachment[];

async function fixture(t: TestContext, beforeStart?: (databasePath: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'capsule-server-'));
  const databasePath = join(directory, 'capsules.sqlite');
  beforeStart?.(databasePath);
  let currentTime = START_TIME;
  let app = createCapsuleServer({ databasePath, now: () => currentTime, onError: (error) => { throw error; } });
  let baseUrl: string;
  async function listen() {
    app.server.listen(0, '127.0.0.1');
    await once(app.server, 'listening');
    baseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  }
  await listen();
  t.after(async () => {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  });
  async function request(path: string, options: { method?: string; body?: unknown; token?: string | null; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { ...options.headers };
    if (options.token !== null && (options.token ?? token)) headers.Authorization = `Bearer ${options.token ?? token}`;
    if (options.body !== undefined) headers['Content-Type'] ??= 'application/json';
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null, text };
  }
  let token: string | undefined;
  const session = await request('/sessions', { method: 'POST', token: null });
  assert.equal(session.status, 201);
  token = session.body.token;
  assert.equal(typeof token, 'string');
  const location = (overrides: Partial<LocationFix> = {}): LocationFix => ({
    latitude: 37.5665,
    longitude: 126.978,
    accuracy: 5,
    timestamp: currentTime,
    mocked: false,
    ...overrides,
  });
  function input(overrides: Partial<CreateCapsuleInput> = {}): CreateCapsuleInput {
    return {
      title: '한 달 뒤의 우리',
      placeName: '서울 광장',
      unlockAfterSeconds: 15,
      location: location(),
      content: { letter: SECRET_LETTER, photo: { mimeType: 'image/png', base64: PNG } },
      ...overrides,
    };
  }
  async function create(overrides: Partial<CreateCapsuleInput> = {}) {
    const result = await request('/capsules', { method: 'POST', body: input(overrides) });
    assert.equal(result.status, 201, result.text);
    return result.body.capsule;
  }
  return {
    request, location, input, create, databasePath,
    get token() { return token!; },
    now: () => currentTime,
    advance: (milliseconds: number) => { currentTime += milliseconds; },
    simulateUploadTime: (milliseconds: number) => {
      // Runs after the server captured arrival time and started reading the body.
      app.server.once('request', () => { currentTime += milliseconds; });
    },
    async restart() {
      await app.close();
      app = createCapsuleServer({ databasePath, now: () => currentTime });
      await listen();
    },
  };
}

function noContent(value: unknown) {
  const json = JSON.stringify(value);
  assert.ok(!json.includes(SECRET_LETTER), 'sealed letter must not leak');
  assert.ok(!json.includes(PNG), 'sealed photo must not leak');
  function inspect(candidate: unknown) {
    if (!candidate || typeof candidate !== 'object') return;
    for (const [key, child] of Object.entries(candidate)) {
      assert.ok(!['content', 'letter', 'photo', 'audio', 'video', 'base64', 'fileName', 'photo_base64', 'photo_mime_type',
        'audio_base64', 'audio_mime_type', 'audio_file_name', 'video_base64', 'video_mime_type', 'video_file_name', 'token_hash'].includes(key), `unexpected private field ${key}`);
      inspect(child);
    }
  }
  inspect(value);
}

test('HTTP health reports server time and every response disallows caching', async (t) => {
  const f = await fixture(t);
  const health = await f.request('/health', { token: null });
  assert.deepEqual(health.body, { ok: true, serverNow: new Date(START_TIME).toISOString() });
  assert.equal(health.headers.get('cache-control'), 'no-store');
  const denied = await f.request('/capsules', { token: null });
  assert.equal(denied.status, 401);
  assert.equal(denied.headers.get('cache-control'), 'no-store');
});

test('create, list and eligibility expose only capsule metadata; content has no direct GET route', async (t) => {
  const f = await fixture(t);
  const created = await f.request('/capsules', { method: 'POST', body: f.input() });
  assert.equal(created.status, 201);
  noContent(created.body);
  const capsule = created.body.capsule;
  assert.equal(capsule.hasPhoto, true);
  assert.equal(capsule.radiusMeters, 50);
  assert.equal(capsule.opensAt, new Date(START_TIME + 15_000).toISOString());
  const list = await f.request('/capsules');
  noContent(list.body);
  assert.equal(list.body.capsules.length, 1);
  const gate = await f.request(`/capsules/${capsule.id}/eligibility`, { method: 'POST', body: { location: f.location() } });
  noContent(gate.body);
  assert.equal(gate.body.code, 'TOO_EARLY');
  for (const path of [`/capsules/${capsule.id}`, `/capsules/${capsule.id}/content`, `/capsules/${capsule.id}/photo`, `/capsules/${capsule.id}/open`]) {
    const response = await f.request(path);
    assert.equal(response.status, 404);
    noContent(response.body);
  }
});

test('server clock prevents early opening and client-supplied unlock fields cannot override it', async (t) => {
  const f = await fixture(t);
  const created = await f.request('/capsules', {
    method: 'POST', body: { ...f.input(), opensAt: '2000-01-01T00:00:00.000Z', createdAt: 0, openedAt: '2000-01-01' },
  });
  const capsule = created.body.capsule;
  assert.equal(capsule.opensAt, new Date(START_TIME + 15_000).toISOString());
  assert.equal(capsule.openedAt, null);
  f.advance(14_999);
  const result = await f.request(`/capsules/${capsule.id}/open`, { method: 'POST', body: { location: f.location() } });
  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, 'TOO_EARLY');
  assert.equal(result.body.eligibility.remainingSeconds, 1);
  noContent(result.body);
});

test('at the exact opening time, a fresh accurate nearby fix unlocks the original letter and photo', async (t) => {
  const f = await fixture(t);
  const capsule = await f.create();
  f.advance(15_000);
  const gate = await f.request(`/capsules/${capsule.id}/eligibility`, { method: 'POST', body: { location: f.location() } });
  assert.equal(gate.body.eligible, true);
  assert.equal(gate.body.code, 'READY');
  const result = await f.request(`/capsules/${capsule.id}/open`, { method: 'POST', body: { location: f.location() } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.content, f.input().content);
  assert.equal(result.body.capsule.openedAt, new Date(f.now()).toISOString());
  assert.equal(result.headers.get('cache-control'), 'no-store');
  noContent((await f.request('/capsules')).body);
});

test('a location over 50m away cannot open a mature capsule', async (t) => {
  const f = await fixture(t);
  const capsule = await f.create();
  f.advance(15_000);
  const response = await f.request(`/capsules/${capsule.id}/open`, {
    method: 'POST', body: { location: f.location({ latitude: 37.5675 }) },
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'TOO_FAR');
  assert.ok(response.body.eligibility.distanceMeters > 100);
  noContent(response.body);
});

test('previously opening or checking eligibility never grants remote access later', async (t) => {
  const f = await fixture(t);
  const capsule = await f.create();
  f.advance(15_000);
  const body = { location: f.location() };
  assert.equal((await f.request(`/capsules/${capsule.id}/eligibility`, { method: 'POST', body })).body.code, 'READY');
  assert.equal((await f.request(`/capsules/${capsule.id}/open`, { method: 'POST', body })).status, 200);
  const remote = await f.request(`/capsules/${capsule.id}/open`, {
    method: 'POST', body: { location: f.location({ longitude: 127.978 }) },
  });
  assert.equal(remote.status, 403);
  assert.equal(remote.body.error.code, 'TOO_FAR');
  noContent(remote.body);
});

test('inaccurate, stale, far-future and known mocked fixes fail both burial and opening', async (t) => {
  const f = await fixture(t);
  const capsule = await f.create();
  f.advance(15_000);
  const scenarios: [Partial<LocationFix>, string][] = [
    [{ accuracy: 25.01 }, 'INACCURATE_LOCATION'],
    [{ timestamp: f.now() - MAX_LOCATION_AGE_MS - 1 }, 'STALE_LOCATION'],
    [{ timestamp: f.now() + MAX_LOCATION_FUTURE_MS + 1 }, 'STALE_LOCATION'],
    [{ mocked: true }, 'MOCKED_LOCATION'],
  ];
  for (const [overrides, code] of scenarios) {
    const location = f.location(overrides);
    const burial = await f.request('/capsules', { method: 'POST', body: f.input({ location }) });
    assert.equal(burial.status, 403, code);
    assert.equal(burial.body.error.code, code);
    const opened = await f.request(`/capsules/${capsule.id}/open`, { method: 'POST', body: { location } });
    assert.equal(opened.status, 403, code);
    assert.equal(opened.body.error.code, code);
    noContent(opened.body);
  }
});

test('location freshness, clock tolerance and accuracy accept their exact documented boundaries', async (t) => {
  const f = await fixture(t);
  const capsule = await f.create();
  f.advance(15_000);
  for (const timestamp of [f.now() - MAX_LOCATION_AGE_MS, f.now() + MAX_LOCATION_FUTURE_MS]) {
    const response = await f.request(`/capsules/${capsule.id}/open`, {
      method: 'POST', body: { location: f.location({ accuracy: 25, timestamp }) },
    });
    assert.equal(response.status, 200);
  }
});

test('malformed location values are rejected before geographic comparison', async (t) => {
  const f = await fixture(t);
  const capsule = await f.create();
  f.advance(15_000);
  const badLocations = [
    null, {}, f.location({ latitude: 91 }), f.location({ longitude: -181 }),
    f.location({ accuracy: -1 }), f.location({ timestamp: 0 }),
    { ...f.location(), mocked: 'false' }, { ...f.location(), latitude: '37.5665' },
    { ...f.location(), timestamp: null },
  ];
  for (const location of badLocations) {
    const result = await f.request(`/capsules/${capsule.id}/open`, { method: 'POST', body: { location } });
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, 'INVALID_INPUT');
    noContent(result.body);
  }
});

test('other sessions cannot list, inspect or open the owner capsule', async (t) => {
  const f = await fixture(t);
  const capsule = await f.create();
  const other = await f.request('/sessions', { method: 'POST', token: null });
  const token = other.body.token;
  const list = await f.request('/capsules', { token });
  assert.deepEqual(list.body.capsules, []);
  f.advance(15_000);
  for (const action of ['eligibility', 'open']) {
    const result = await f.request(`/capsules/${capsule.id}/${action}`, { method: 'POST', token, body: { location: f.location() } });
    assert.equal(result.status, 404);
    noContent(result.body);
  }
  const forged = await f.request('/capsules', { token: 'x'.repeat(43) });
  assert.equal(forged.status, 401);
});

test('sessions and sealed content persist across restart; token itself is not stored in SQLite', async (t) => {
  const f = await fixture(t);
  const capsule = await f.create();
  assert.equal(statSync(f.databasePath).mode & 0o777, 0o600);
  assert.ok(!readFileSync(f.databasePath).includes(Buffer.from(f.token)));
  await f.restart();
  const list = await f.request('/capsules');
  assert.equal(list.status, 200);
  assert.equal(list.body.capsules[0].id, capsule.id);
  noContent(list.body);
  const early = await f.request(`/capsules/${capsule.id}/open`, { method: 'POST', body: { location: f.location() } });
  assert.equal(early.status, 403);
  f.advance(15_000);
  const opened = await f.request(`/capsules/${capsule.id}/open`, { method: 'POST', body: { location: f.location() } });
  assert.equal(opened.status, 200);
  assert.equal(opened.body.content.letter, SECRET_LETTER);
  assert.equal(opened.body.content.photo.base64, PNG);
});

test('sealed capsules have no edit or delete API, and request overrides cannot change radius or owner', async (t) => {
  const f = await fixture(t);
  const result = await f.request('/capsules', {
    method: 'POST', body: { ...f.input(), radiusMeters: 999999, owner_id: 'other-person' },
  });
  assert.equal(result.body.capsule.radiusMeters, 50);
  const capsule = result.body.capsule;
  for (const method of ['PATCH', 'PUT', 'DELETE']) {
    const edit = await f.request(`/capsules/${capsule.id}`, { method, body: { content: { letter: 'changed' } } });
    assert.equal(edit.status, 404);
  }
  f.advance(15_000);
  const opened = await f.request(`/capsules/${capsule.id}/open`, { method: 'POST', body: { location: f.location() } });
  assert.equal(opened.body.content.letter, SECRET_LETTER);
});

test('capsule inputs enforce title, place, date, content and file-type limits', async (t) => {
  const f = await fixture(t);
  const invalidInputs: Partial<CreateCapsuleInput>[] = [
    { title: ' ' }, { title: 'a'.repeat(81) }, { placeName: 'p'.repeat(121) },
    { unlockAfterSeconds: 14 }, { unlockAfterSeconds: 15.1 }, { unlockAfterSeconds: 31_536_001 },
    { content: { letter: '', photo: null } },
    { content: { letter: 'a'.repeat(10_001), photo: null } },
    { content: { letter: '', photo: { mimeType: 'image/png', base64: Buffer.from('not a photo').toString('base64') } } },
    { content: { letter: '', photo: { mimeType: 'image/jpeg', base64: PNG } } },
    { content: { letter: '', photo: { mimeType: 'image/png', base64: 'not base64!' } } },
  ];
  for (const invalid of invalidInputs) {
    const response = await f.request('/capsules', { method: 'POST', body: f.input(invalid) });
    assert.equal(response.status, 400, JSON.stringify(invalid).slice(0, 180));
    assert.equal(response.body.error.code, 'INVALID_INPUT');
  }
  assert.equal((await f.request('/capsules')).body.capsules.length, 0);
});

test('photo validation handles realistic payload sizes and rejects over 4MB', async (t) => {
  const f = await fixture(t);
  const bytes = Buffer.alloc(MAX_PHOTO_BYTES);
  Buffer.from(PNG, 'base64').copy(bytes);
  const accepted = await f.request('/capsules', {
    method: 'POST', body: f.input({ content: { letter: '', photo: { mimeType: 'image/png', base64: bytes.toString('base64') } } }),
  });
  assert.equal(accepted.status, 201);
  const tooBig = Buffer.concat([bytes, Buffer.from([0])]);
  const rejected = await f.request('/capsules', {
    method: 'POST', body: f.input({ content: { letter: '', photo: { mimeType: 'image/png', base64: tooBig.toString('base64') } } }),
  });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.error.code, 'INVALID_INPUT');
});

test('HTTP rejects unsupported content type and oversized body', async (t) => {
  const f = await fixture(t);
  const unsupported = await f.request('/capsules', { method: 'POST', body: f.input(), headers: { 'Content-Type': 'text/plain' } });
  assert.equal(unsupported.status, 415);
  const oversized = await f.request('/capsules', { method: 'POST', body: { huge: 'a'.repeat(53 * 1024 * 1024) } });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('CORS supports local preview and rejects unrelated browser origins', async (t) => {
  const f = await fixture(t);
  const local = await f.request('/capsules', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8081' }, token: null });
  assert.equal(local.status, 204);
  assert.equal(local.headers.get('access-control-allow-origin'), 'http://localhost:8081');
  assert.ok(local.headers.get('access-control-allow-headers')?.includes('Idempotency-Key'));
  assert.equal(local.headers.get('cache-control'), 'no-store');
  const external = await f.request('/sessions', { method: 'POST', headers: { Origin: 'https://unrelated.example' }, token: null });
  assert.equal(external.status, 403);
  assert.equal(external.headers.get('access-control-allow-origin'), null);
});

test('repeating a burial key returns the same sealed capsule, including after restart or an old GPS fix', async (t) => {
  const f = await fixture(t);
  const input = f.input();
  const headers = { 'Idempotency-Key': 'retry-burial-00000001' };
  const first = await f.request('/capsules', { method: 'POST', body: input, headers });
  assert.equal(first.status, 201);
  f.advance(60_000);
  await f.restart();
  const repeat = await f.request('/capsules', { method: 'POST', body: input, headers });
  assert.equal(repeat.status, 200);
  assert.deepEqual(repeat.body.capsule, first.body.capsule);
  noContent(repeat.body);
  const concurrentRetries = await Promise.all([0.001, 0.002].map(offset => f.request('/capsules', {
    method: 'POST', headers, body: { ...input, location: f.location({ latitude: input.location.latitude + offset }) },
  })));
  for (const retry of concurrentRetries) {
    assert.equal(retry.status, 200);
    assert.deepEqual(retry.body.capsule, first.body.capsule, 'a fresh retry must preserve the original burial place and time');
  }
  assert.equal((await f.request('/capsules')).body.capsules.length, 1);
  const remote = await f.request(`/capsules/${first.body.capsule.id}/open`, {
    method: 'POST', body: { location: f.location({ latitude: 37.9 }) },
  });
  assert.equal(remote.status, 403);
});

test('burial key cannot mutate sealed content and is isolated per owner', async (t) => {
  const f = await fixture(t);
  const headers = { 'Idempotency-Key': 'retry-burial-00000002' };
  const first = await f.request('/capsules', { method: 'POST', body: f.input(), headers });
  assert.equal(first.status, 201);
  const changed = await f.request('/capsules', { method: 'POST', body: f.input({ title: 'changed' }), headers });
  assert.equal(changed.status, 409);
  assert.equal(changed.body.error.code, 'IDEMPOTENCY_CONFLICT');
  noContent(changed.body);
  const anotherSession = await f.request('/sessions', { method: 'POST', token: null });
  const other = await f.request('/capsules', { method: 'POST', body: f.input(), headers, token: anotherSession.body.token });
  assert.equal(other.status, 201);
  assert.notEqual(other.body.capsule.id, first.body.capsule.id);
  const invalidKey = await f.request('/capsules', { method: 'POST', body: f.input(), headers: { 'Idempotency-Key': 'short' } });
  assert.equal(invalidKey.status, 400);
});

test('burial recovery returns only owner metadata and survives restart', async (t) => {
  const f = await fixture(t);
  const key = 'recover-burial-00000001';
  const before = await f.request(`/capsules/by-request/${key}`);
  assert.equal(before.status, 404);
  const first = await f.request('/capsules', { method: 'POST', body: f.input(), headers: { 'Idempotency-Key': key } });
  await f.restart();
  const recovered = await f.request(`/capsules/by-request/${key}`);
  assert.equal(recovered.status, 200);
  assert.deepEqual(recovered.body.capsule, first.body.capsule);
  assert.equal(recovered.headers.get('cache-control'), 'no-store');
  noContent(recovered.body);
  const otherSession = await f.request('/sessions', { method: 'POST', token: null });
  const other = await f.request(`/capsules/by-request/${key}`, { token: otherSession.body.token });
  assert.equal(other.status, 404);
  noContent(other.body);
});

test('distance math handles the same point, an expected city distance and the date line', () => {
  assert.equal(distanceMeters({ latitude: 37, longitude: 127 }, { latitude: 37, longitude: 127 }), 0);
  const seoulToBusan = distanceMeters({ latitude: 37.5665, longitude: 126.978 }, { latitude: 35.1796, longitude: 129.0756 });
  assert.ok(seoulToBusan > 320_000 && seoulToBusan < 330_000);
  const dateLine = distanceMeters({ latitude: 0, longitude: 179.9999 }, { latitude: 0, longitude: -179.9999 });
  assert.ok(dateLine > 22 && dateLine < 23);
});

test('audio-only and video-only capsules accept every supported format and preserve bytes after restart', async (t) => {
  const f = await fixture(t);
  const contents: CreateCapsuleInput['content'][] = [
    ...AUDIO.map(audio => ({ letter: '', photo: null, audio })),
    ...VIDEO.map(video => ({ letter: '', photo: null, video })),
    { ...f.input().content, audio: AUDIO[0], video: VIDEO[0] },
  ];
  const capsules = [];
  for (const content of contents) {
    const capsule = await f.create({ content });
    assert.equal(capsule.hasAudio, !!content.audio);
    assert.equal(capsule.hasVideo, !!content.video);
    capsules.push(capsule);
  }
  await f.restart();
  f.advance(15_000);
  for (const [index, capsule] of capsules.entries()) {
    const opened = await f.request(`/capsules/${capsule.id}/open`, { method: 'POST', body: { location: f.location() } });
    assert.equal(opened.status, 200);
    assert.deepEqual(opened.body.content, contents[index]);
  }
});

test('audio/video bytes and filenames never leak through summaries, recovery, denial or another owner', async (t) => {
  const f = await fixture(t);
  const key = 'private-media-request-0001';
  const first = await f.request('/capsules', {
    method: 'POST', headers: { 'Idempotency-Key': key },
    body: f.input({ content: { ...f.input().content, audio: AUDIO[0], video: VIDEO[0] } }),
  });
  assert.equal(first.status, 201);
  const id = first.body.capsule.id;
  const responses = [first, await f.request('/capsules'), await f.request(`/capsules/by-request/${key}`)];
  const early = await f.request(`/capsules/${id}/open`, { method: 'POST', body: { location: f.location() } });
  assert.equal(early.status, 403);
  responses.push(early);
  f.advance(15_000);
  for (const location of [f.location({ latitude: 38 }), f.location({ accuracy: 100 }), f.location({ timestamp: START_TIME - 30_001 }), f.location({ mocked: true })]) {
    const denied = await f.request(`/capsules/${id}/open`, { method: 'POST', body: { location } });
    assert.equal(denied.status, 403);
    responses.push(denied);
  }
  responses.push(await f.request(`/capsules/${id}/eligibility`, { method: 'POST', body: { location: f.location() } }));
  for (const field of ['audio', 'video', 'content']) {
    const direct = await f.request(`/capsules/${id}/${field}`);
    assert.equal(direct.status, 404);
    responses.push(direct);
  }
  const other = await f.request('/sessions', { method: 'POST', token: null });
  for (const path of [`/capsules/${id}/open`, `/capsules/${id}/eligibility`]) {
    const denied = await f.request(path, { method: 'POST', token: other.body.token, body: { location: f.location() } });
    assert.equal(denied.status, 404);
    responses.push(denied);
  }
  const otherRecovery = await f.request(`/capsules/by-request/${key}`, { token: other.body.token });
  assert.equal(otherRecovery.status, 404);
  responses.push(otherRecovery);
  for (const response of responses) {
    noContent(response.body);
    for (const file of [...AUDIO, ...VIDEO]) {
      assert.ok(!response.text.includes(file.base64));
      assert.ok(!response.text.includes(file.fileName));
    }
  }
});

test('media content participates in immutable idempotency checks while unchanged retries return only metadata', async (t) => {
  const f = await fixture(t);
  const headers = { 'Idempotency-Key': 'media-retry-request-0001' };
  const content = { ...f.input().content, audio: AUDIO[0], video: VIDEO[0] };
  const first = await f.request('/capsules', { method: 'POST', headers, body: f.input({ content }) });
  assert.equal(first.status, 201);
  const repeat = await f.request('/capsules', { method: 'POST', headers, body: f.input({ content }) });
  assert.equal(repeat.status, 200);
  assert.deepEqual(repeat.body.capsule, first.body.capsule);
  noContent(repeat.body);
  for (const changed of [{ ...content, audio: AUDIO[1] }, { ...content, video: VIDEO[1] }, { ...content, audio: null },
    { ...content, video: { ...VIDEO[0], fileName: 'changed.mp4' } }]) {
    const conflict = await f.request('/capsules', { method: 'POST', headers, body: f.input({ content: changed }) });
    assert.equal(conflict.status, 409);
    noContent(conflict.body);
  }
});

function paddedIsoMedia(base64: string, size: number): string {
  const source = Buffer.from(base64, 'base64');
  const bytes = Buffer.alloc(size);
  source.copy(bytes);
  bytes.writeUInt32BE(size - source.length, source.length);
  bytes.write('free', source.length + 4, 'ascii');
  return bytes.toString('base64');
}

test('request budget permits all three attachments at their byte limits, rejecting each oversize attachment', async (t) => {
  const f = await fixture(t);
  const photoBytes = Buffer.alloc(MAX_PHOTO_BYTES);
  Buffer.from(PNG, 'base64').copy(photoBytes);
  const audio = { ...AUDIO[0], base64: paddedIsoMedia(AUDIO[0].base64, MAX_AUDIO_BYTES) };
  const video = { ...VIDEO[0], base64: paddedIsoMedia(VIDEO[0].base64, MAX_VIDEO_BYTES) };
  const accepted = await f.request('/capsules', { method: 'POST', body: f.input({ content: {
    letter: 'a'.repeat(10_000), photo: { mimeType: 'image/png', base64: photoBytes.toString('base64') }, audio, video,
  } }) });
  assert.equal(accepted.status, 201, accepted.text);
  noContent(accepted.body);
  for (const content of [
    { letter: '', photo: null, audio: { ...audio, base64: paddedIsoMedia(AUDIO[0].base64, MAX_AUDIO_BYTES + 1) } },
    { letter: '', photo: null, video: { ...video, base64: paddedIsoMedia(VIDEO[0].base64, MAX_VIDEO_BYTES + 1) } },
  ]) {
    const oversized = await f.request('/capsules', { method: 'POST', body: f.input({ content }) });
    assert.equal(oversized.status, 400);
    assert.equal(oversized.body.error.code, 'INVALID_INPUT');
  }
});

test('media validation rejects malformed bytes, MIME/container mismatches and unsafe filenames', async (t) => {
  const f = await fixture(t);
  const audioCases = [
    { ...AUDIO[0], mimeType: 'audio/ogg' }, { ...AUDIO[0], base64: VIDEO[0].base64 },
    { ...AUDIO[0], base64: VIDEO[1].base64 }, { ...AUDIO[0], base64: AUDIO[2].base64 },
    { ...AUDIO[1], base64: 'SUQzBAAAAAAA' }, // incomplete ID3 header, no MPEG frame
    { ...AUDIO[0], base64: 'not base64!' }, { ...AUDIO[0], base64: 'Zh==' }, // noncanonical pad bits
    { ...AUDIO[0], base64: AUDIO[0].base64.slice(0, 16) },
    ...['../secret.m4a', 'folder\\voice.m4a', '\u0000.m4a', '\u202E.m4a', '..', '', 'a'.repeat(161)].map(fileName => ({ ...AUDIO[0], fileName })),
  ];
  const videoCases = [
    { ...VIDEO[0], mimeType: 'video/webm' }, { ...VIDEO[0], base64: AUDIO[0].base64 },
    { ...VIDEO[0], base64: VIDEO[1].base64 }, { ...VIDEO[1], base64: VIDEO[0].base64 },
    { ...VIDEO[0], base64: PNG }, { ...VIDEO[0], fileName: '../film.mp4' },
  ];
  for (const content of [
    ...audioCases.map(audio => ({ letter: '', photo: null, audio })),
    ...videoCases.map(video => ({ letter: '', photo: null, video })),
  ]) {
    const rejected = await f.request('/capsules', { method: 'POST', body: { ...f.input(), content } });
    assert.equal(rejected.status, 400, JSON.stringify(content).slice(0, 180));
    assert.equal(rejected.body.error.code, 'INVALID_INPUT');
    noContent(rejected.body);
  }
  assert.equal((await f.request('/capsules')).body.capsules.length, 0);
});

test('existing pre-media database and idempotency hashes migrate without changing sealed content', async (t) => {
  const legacyToken = 'l'.repeat(43);
  const legacyId = '12345678-1234-1234-1234-123456789012';
  const key = 'legacy-request-key-0001';
  // Match the old server's parsed field ordering (not a client's JSON ordering).
  const content = { letter: SECRET_LETTER, photo: { base64: PNG, mimeType: 'image/png' as const } };
  const hash = createHash('sha256').update(JSON.stringify({
    title: '한 달 뒤의 우리', placeName: '서울 광장', unlockAfterSeconds: 15, content,
  })).digest('hex');
  const f = await fixture(t, databasePath => {
    const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE sessions (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);
      CREATE TABLE capsules (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES sessions(id), title TEXT NOT NULL,
        place_name TEXT NOT NULL, created_at INTEGER NOT NULL, opens_at INTEGER NOT NULL, opened_at INTEGER,
        latitude REAL NOT NULL, longitude REAL NOT NULL, radius_meters REAL NOT NULL, letter TEXT NOT NULL,
        photo_base64 TEXT, photo_mime_type TEXT);
      CREATE TABLE creation_requests (owner_id TEXT NOT NULL REFERENCES sessions(id), request_key TEXT NOT NULL,
        request_hash TEXT NOT NULL, capsule_id TEXT NOT NULL REFERENCES capsules(id), PRIMARY KEY(owner_id, request_key));
    `);
    database.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run('legacy-owner', createHash('sha256').update(legacyToken).digest('hex'), START_TIME);
    database.prepare('INSERT INTO capsules VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(legacyId, 'legacy-owner', '한 달 뒤의 우리', '서울 광장', START_TIME, START_TIME + 15_000, null, 37.5665, 126.978, 50, SECRET_LETTER, PNG, 'image/png');
    database.prepare('INSERT INTO creation_requests VALUES (?, ?, ?, ?)').run('legacy-owner', key, hash, legacyId);
    database.close();
  });
  await f.restart(); // migration must also be safe when already applied
  for (const legacyContent of [content, { ...content, audio: null, video: null }]) {
    const repeat = await f.request('/capsules', {
      method: 'POST', token: legacyToken, headers: { 'Idempotency-Key': key }, body: f.input({ content: legacyContent }),
    });
    assert.equal(repeat.status, 200, repeat.text);
    assert.equal(repeat.body.capsule.id, legacyId);
    assert.equal(repeat.body.capsule.hasAudio, false);
    assert.equal(repeat.body.capsule.hasVideo, false);
    noContent(repeat.body);
  }
  const recovered = await f.request(`/capsules/by-request/${key}`, { token: legacyToken });
  assert.equal(recovered.status, 200);
  noContent(recovered.body);
  f.advance(15_000);
  const opened = await f.request(`/capsules/${legacyId}/open`, { method: 'POST', token: legacyToken, body: { location: f.location() } });
  assert.equal(opened.status, 200);
  assert.deepEqual(opened.body.content, content);
  await f.create({ content: { letter: '', photo: null, audio: AUDIO[0], video: VIDEO[0] } });
});

test('upload transit time does not stale a fresh burial fix, but seal time and opening freshness use current server time', async (t) => {
  const f = await fixture(t);
  const input = f.input({ content: { letter: '', photo: null, video: VIDEO[0] } });
  f.simulateUploadTime(60_000);
  const created = await f.request('/capsules', { method: 'POST', body: input });
  assert.equal(created.status, 201, created.text);
  assert.equal(created.body.capsule.createdAt, new Date(START_TIME + 60_000).toISOString());
  assert.equal(created.body.capsule.opensAt, new Date(START_TIME + 75_000).toISOString());
  const staleAtArrival = await f.request('/capsules', { method: 'POST', body: input });
  assert.equal(staleAtArrival.status, 403);
  assert.equal(staleAtArrival.body.error.code, 'STALE_LOCATION');
  f.advance(15_000);
  const body = { location: f.location() };
  f.simulateUploadTime(31_000);
  const opened = await f.request(`/capsules/${created.body.capsule.id}/open`, { method: 'POST', body });
  assert.equal(opened.status, 403);
  assert.equal(opened.body.error.code, 'STALE_LOCATION');
  noContent(opened.body);
});
