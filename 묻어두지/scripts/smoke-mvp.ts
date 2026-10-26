/** Real-clock HTTP smoke test. Isolated temp DB; synthetic GPS, no camera AR. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { URL } from 'node:url';
import { createCapsuleServer } from '../server/app';
import type { CapsuleContent, LocationFix } from '../src/shared/contracts';

async function main() {
  const directory = mkdtempSync(join(tmpdir(), 'dooji-mvp-smoke-'));
  const databasePath = join(directory, 'capsules.sqlite');
  let app = createCapsuleServer({ databasePath });
  let baseUrl = '';
  let token = '';
  const results: { name: string; passed: true }[] = [];
  const passed = (name: string) => { results.push({ name, passed: true }); console.log(`PASS ${name}`); };
  const location = (overrides: Partial<LocationFix> = {}): LocationFix => ({
    latitude: 37.5665, longitude: 126.978, accuracy: 5, timestamp: Date.now(), mocked: false, ...overrides,
  });
  const fixture = (name: string) => readFileSync(new URL(`../server/fixtures/${name}`, import.meta.url)).toString('base64');
  const content: CapsuleContent = {
    letter: 'MVP 자동 검증 자료입니다. 실제 개인정보가 아닙니다.',
    photo: { mimeType: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=' },
    audio: { mimeType: 'audio/wav', fileName: 'tone.wav', base64: fixture('tone.wav') },
    video: { mimeType: 'video/mp4', fileName: 'blue.mp4', base64: fixture('blue.mp4') },
  };
  function noContent(value: unknown) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!['content', 'letter', 'photo', 'audio', 'video', 'base64', 'fileName'].includes(key), `private field: ${key}`);
      noContent(child);
    }
  }
  async function listen() {
    app.server.listen(0, '127.0.0.1');
    await once(app.server, 'listening');
    baseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  }
  async function request(path: string, body?: unknown, auth = token, headers: Record<string, string> = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json();
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, data };
  }
  const startedAt = new Date().toISOString();
  try {
    await listen();
    const session = await request('/sessions', {});
    assert.equal(session.status, 201);
    token = session.data.token;
    const key = `smoke_${randomUUID()}`;
    const input = { title: 'MVP 15초 왕복 테스트', placeName: '합성 좌표 · GPS 검증 아님', unlockAfterSeconds: 15, location: location(), content };
    const created = await request('/capsules', input, token, { 'Idempotency-Key': key });
    assert.equal(created.status, 201);
    noContent(created.data);
    const capsule = created.data.capsule;
    assert.ok(capsule.hasPhoto && capsule.hasAudio && capsule.hasVideo);
    passed('편지·사진·음성·영상 함께 봉인 / 생성 응답 내용 비공개');

    const retries = await Promise.all(Array.from({ length: 3 }, () => request('/capsules', input, token, { 'Idempotency-Key': key })));
    for (const retry of retries) {
      assert.ok([200, 201].includes(retry.status));
      assert.equal(retry.data.capsule.id, capsule.id);
      noContent(retry.data);
    }
    const listing = await request('/capsules');
    assert.equal(listing.data.capsules.length, 1);
    noContent(listing.data);
    const recovered = await request(`/capsules/by-request/${key}`);
    assert.equal(recovered.data.capsule.id, capsule.id);
    noContent(recovered.data);
    passed('동시 재전송 3회에도 캡슐 1개 / 봉인 결과 복구');

    const early = await request(`/capsules/${capsule.id}/open`, { location: location() });
    assert.equal(early.status, 403);
    assert.equal(early.data.error.code, 'TOO_EARLY');
    noContent(early.data);
    passed('실제 개봉 시간 전 접근 거부 / 내용 비공개');

    const other = (await request('/sessions', {}, '')).data.token;
    const foreign = await request(`/capsules/${capsule.id}/open`, { location: location() }, other);
    assert.equal(foreign.status, 404);
    noContent(foreign.data);
    passed('다른 기기 세션의 캡슐 개봉 차단');

    console.log('실제 서버 시계로 15초 만료를 기다립니다.');
    await delay(Math.max(0, Date.parse(capsule.opensAt) - Date.now() + 100));
    for (const [overrides, code] of [
      [{ latitude: 37.5675 }, 'TOO_FAR'],
      [{ accuracy: 26 }, 'INACCURATE_LOCATION'],
      [{ timestamp: Date.now() - 31_000 }, 'STALE_LOCATION'],
    ] as const) {
      const denied = await request(`/capsules/${capsule.id}/open`, { location: location(overrides) });
      assert.equal(denied.status, 403);
      assert.equal(denied.data.error.code, code);
      noContent(denied.data);
    }
    passed('시간 경과 뒤에도 먼 위치·부정확한 위치·오래된 위치 차단');

    await app.close();
    app = createCapsuleServer({ databasePath });
    await listen();
    const gate = await request(`/capsules/${capsule.id}/eligibility`, { location: location() });
    assert.equal(gate.data.code, 'READY');
    noContent(gate.data);
    const opened = await request(`/capsules/${capsule.id}/open`, { location: location() });
    assert.equal(opened.status, 200);
    assert.equal(opened.data.content.letter, content.letter);
    for (const kind of ['photo', 'audio', 'video'] as const) {
      const expected = content[kind]!;
      const actual = opened.data.content[kind];
      assert.equal(actual.mimeType, expected.mimeType);
      const hash = (base64: string) => createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex');
      assert.equal(hash(actual.base64), hash(expected.base64), `${kind} must round-trip byte-for-byte`);
    }
    passed('서버 재시작 후 동일 세션 개봉 / 편지 및 세 첨부 원본 일치');

    const remoteAfterOpen = await request(`/capsules/${capsule.id}/open`, { location: location({ latitude: 37.5675 }) });
    assert.equal(remoteAfterOpen.status, 403);
    assert.equal(remoteAfterOpen.data.error.code, 'TOO_FAR');
    noContent(remoteAfterOpen.data);
    noContent((await request('/capsules')).data);
    passed('한 번 열었어도 원격 재개봉 차단 / 목록 내용 비공개 유지');
    const report = {
      passed: true, startedAt, finishedAt: new Date().toISOString(), realServerClock: true,
      syntheticLocation: true, deviceARTested: false, isolatedTemporaryDatabase: true, results,
    };
    const reportDir = new URL('../.build/mvp-check/', import.meta.url);
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(new URL('api-smoke.json', reportDir), JSON.stringify(report, null, 2) + '\n');
  } finally {
    await app.close();
    // Only this test's mkdtemp directory; never a user database.
    rmSync(directory, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
