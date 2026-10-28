/** Shared harness for server integration tests: temp SQLite, real HTTP on a random port, injectable clock. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { URL } from 'node:url';

import { addDays, type Capsule } from '../src/domain/capsule';
import type { CreateCapsuleInput } from '../src/shared/capsule-api';
import { createCapsuleServer, type CapsuleServerOptions } from './app';

export const START_TIME = Date.UTC(2026, 8, 15, 3, 0, 0);
export const DAY = 24 * 60 * 60 * 1000;
export const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const fixtureBase64 = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url)).toString('base64');
export const WAV = fixtureBase64('tone.wav');
export const MP4 = fixtureBase64('blue.mp4');
// Minimal EBML header with DocType "webm" — enough for the container sniff.
export const WEBM = Buffer.concat([
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84]),
  Buffer.from('webm', 'ascii'),
  Buffer.alloc(16),
]).toString('base64');

export type ApiResult = { status: number; headers: Headers; body: any; text: string };

export async function fixture(t: TestContext, options: Partial<CapsuleServerOptions> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'capsule-server-'));
  const databasePath = join(directory, 'capsules.sqlite');
  let currentTime = START_TIME;
  const app = createCapsuleServer({
    databasePath,
    now: () => currentTime,
    onError: (error) => { throw error; },
    corsOrigins: [],
    // Tests never inherit login providers from the developer's env.
    auth: { googleClientIds: [], appleClientIds: [], kakao: false, dev: false },
    ...options,
  });
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

export const me = (capsule: Capsule) => capsule.members.find((member) => member.isMe)!;
export const other = (capsule: Capsule) => capsule.members.find((member) => !member.isMe)!;
