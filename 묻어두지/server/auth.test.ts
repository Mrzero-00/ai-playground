import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import type { Capsule } from '../src/domain/capsule';
import { createCapsuleServer } from './app';
import { APPLE_ISSUER, APPLE_JWKS_URL, GOOGLE_TOKENINFO_URL, KAKAO_ME_URL } from './auth';
import { fixture, me, PNG, START_TIME } from './test-fixture';

type Handler = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>;

/** Fake outbound HTTP: routes by origin+path; anything else behaves like an unreachable host. */
function stubFetch(routes: Record<string, Handler>) {
  const calls: { url: URL; init: RequestInit | undefined }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push({ url, init });
    const handler = routes[`${url.origin}${url.pathname}`];
    if (!handler) throw new TypeError('fetch failed');
    return handler(url, init);
  }) as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const login = (f: Awaited<ReturnType<typeof fixture>>, token: string, body: Record<string, unknown>) =>
  f.request('/auth/login', { method: 'POST', token, body });

test('dev login creates an account, /auth/me reflects it, logout detaches the session', async (t) => {
  const f = await fixture(t, { auth: { dev: true } });
  const token = await f.session();
  const anonymous = await f.request('/auth/me', { token });
  assert.deepEqual(anonymous.body, { account: null, displayName: '나', providers: ['dev'] });

  const result = await login(f, token, { provider: 'dev', name: '테스터' });
  assert.equal(result.status, 200, result.text);
  assert.equal(result.body.displayName, '테스터');
  assert.equal(result.body.serverNow, new Date(START_TIME).toISOString());
  assert.deepEqual({ ...result.body.account, id: 'x' }, { id: 'x', provider: 'dev', displayName: '테스터', avatarUrl: null });

  const mine = await f.request('/auth/me', { token });
  assert.deepEqual(mine.body, { account: result.body.account, displayName: '테스터', providers: ['dev'] });

  // A device that already picked a name keeps it as the account name on first login.
  const named = await f.session('상길');
  const second = await login(f, named, { provider: 'dev', name: 'sangil' });
  assert.equal(second.body.displayName, '상길');
  // Logging in again as an existing account returns the same account.
  const again = await login(f, await f.session('딴이름'), { provider: 'dev', name: '테스터' });
  assert.equal(again.body.account.id, result.body.account.id);
  assert.equal(again.body.displayName, '테스터');

  assert.deepEqual((await f.request('/auth/logout', { method: 'POST', token })).body, { ok: true });
  assert.equal((await f.request('/auth/me', { token })).body.account, null);
});

test('PROVIDER_DISABLED for providers the server has not configured; bad bodies are VALIDATION; login needs a session', async (t) => {
  const f = await fixture(t);
  const token = await f.session();
  assert.deepEqual((await f.request('/auth/me', { token })).body.providers, []);
  for (const body of [{ provider: 'dev', name: '민지' }, { provider: 'google', idToken: 'x' }, { provider: 'apple', idToken: 'x' }, { provider: 'kakao', accessToken: 'x' }]) {
    const result = await login(f, token, body);
    assert.equal(result.status, 400, JSON.stringify(body));
    assert.equal(result.body.error.code, 'PROVIDER_DISABLED');
  }
  assert.equal((await login(f, token, { provider: 'naver' })).body.error.code, 'VALIDATION');
  assert.equal((await f.request('/auth/login', { method: 'POST', body: { provider: 'dev', name: '민지' } })).status, 401);
  assert.equal((await f.request('/auth/me')).status, 401);

  const all = await fixture(t, { auth: { googleClientIds: ['g'], appleClientIds: ['a'], kakao: true, dev: true } });
  assert.deepEqual((await all.request('/auth/me', { token: await all.session() })).body.providers, ['google', 'apple', 'kakao', 'dev']);
  assert.equal((await login(all, await all.session(), { provider: 'google' })).body.error.code, 'VALIDATION');
});

test('google: tokeninfo with our aud logs in; wrong aud, rejected token and unreachable Google are AUTH_FAILED', async (t) => {
  let reply: () => Response = () => json({ aud: 'web-client', sub: 'g-123', name: '구글 민지', picture: 'https://example.com/p.png', email_verified: 'true' });
  const stub = stubFetch({ [GOOGLE_TOKENINFO_URL]: () => reply() });
  const f = await fixture(t, { fetchImpl: stub.impl, auth: { googleClientIds: ['ios-client', 'web-client'] } });
  const token = await f.session();

  const ok = await login(f, token, { provider: 'google', idToken: 'good-token' });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(stub.calls[0].url.searchParams.get('id_token'), 'good-token');
  assert.deepEqual({ ...ok.body.account, id: 'x' }, { id: 'x', provider: 'google', displayName: '구글 민지', avatarUrl: 'https://example.com/p.png' });

  reply = () => json({ aud: 'someone-elses-app', sub: 'g-123' });
  const wrongAud = await login(f, token, { provider: 'google', idToken: 'good-token' });
  assert.equal(wrongAud.status, 401);
  assert.equal(wrongAud.body.error.code, 'AUTH_FAILED');
  assert.ok(wrongAud.body.error.message.length > 0);

  reply = () => json({ error: 'invalid_token' }, 400);
  const rejected = await login(f, token, { provider: 'google', idToken: 'expired' });
  assert.equal(rejected.status, 401);
  assert.equal(rejected.body.error.code, 'AUTH_FAILED');

  reply = () => { throw new TypeError('fetch failed'); };
  const down = await login(f, token, { provider: 'google', idToken: 'good-token' });
  assert.equal(down.status, 502);
  assert.equal(down.body.error.code, 'AUTH_FAILED');
  // A failed login does not detach the session from the account it already had.
  assert.equal((await f.request('/auth/me', { token })).body.account.id, ok.body.account.id);
});

test('kakao: user/me with the access token logs in; a rejected token is AUTH_FAILED', async (t) => {
  const stub = stubFetch({
    [KAKAO_ME_URL]: (_url, init) => {
      const authorization = new Headers(init?.headers).get('authorization');
      if (authorization !== 'Bearer kakao-good') return json({ msg: 'this access token does not exist', code: -401 }, 401);
      return json({ id: 4242, kakao_account: { profile: { nickname: '카카오민지', profile_image_url: 'https://k.example/a.jpg' } } });
    },
  });
  const f = await fixture(t, { fetchImpl: stub.impl, auth: { kakao: true } });
  const token = await f.session();
  const ok = await login(f, token, { provider: 'kakao', accessToken: 'kakao-good' });
  assert.equal(ok.status, 200, ok.text);
  assert.deepEqual({ ...ok.body.account, id: 'x' }, { id: 'x', provider: 'kakao', displayName: '카카오민지', avatarUrl: 'https://k.example/a.jpg' });
  const bad = await login(f, token, { provider: 'kakao', accessToken: 'kakao-bad' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error.code, 'AUTH_FAILED');
});

function appleSigner() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-kid', alg: 'RS256', use: 'sig' };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const jwt = (claims: Record<string, unknown>, key: KeyObject = privateKey, kid = 'test-kid') => {
    const head = `${encode({ alg: 'RS256', kid })}.${encode(claims)}`;
    return `${head}.${sign('RSA-SHA256', Buffer.from(head), key).toString('base64url')}`;
  };
  return { jwk, jwt };
}

test('apple: an RS256 id token signed by a JWKS key logs in; expired, wrong aud/iss, bad signature are AUTH_FAILED', async (t) => {
  const apple = appleSigner();
  const stub = stubFetch({ [APPLE_JWKS_URL]: () => json({ keys: [apple.jwk] }) });
  const f = await fixture(t, { fetchImpl: stub.impl, auth: { appleClientIds: ['com.example.mudeodooji'] } });
  const exp = Math.floor(START_TIME / 1000) + 600;
  const claims = { iss: APPLE_ISSUER, aud: 'com.example.mudeodooji', sub: 'apple-001', exp, iat: exp - 1200 };

  const first = await login(f, await f.session(), { provider: 'apple', idToken: apple.jwt(claims), fullName: '김사과' });
  assert.equal(first.status, 200, first.text);
  assert.deepEqual({ ...first.body.account, id: 'x' }, { id: 'x', provider: 'apple', displayName: '김사과', avatarUrl: null });
  // Apple sends the name only once; later logins keep the stored one.
  const later = await login(f, await f.session(), { provider: 'apple', idToken: apple.jwt(claims) });
  assert.equal(later.body.account.id, first.body.account.id);
  assert.equal(later.body.displayName, '김사과');
  const nameless = await login(f, await f.session(), { provider: 'apple', idToken: apple.jwt({ ...claims, sub: 'apple-002' }) });
  assert.equal(nameless.body.displayName, '사과 사용자');

  const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const token = await f.session();
  for (const [label, idToken] of [
    ['expired', apple.jwt({ ...claims, exp: Math.floor(START_TIME / 1000) - 1 })],
    ['wrong aud', apple.jwt({ ...claims, aud: 'com.someone.else' })],
    ['wrong iss', apple.jwt({ ...claims, iss: 'https://evil.example' })],
    ['foreign key', apple.jwt(claims, other.privateKey)],
    ['unknown kid', apple.jwt(claims, other.privateKey, 'nope')],
    ['tampered', `${apple.jwt(claims).split('.').slice(0, 2).join('.')}.${Buffer.from('x').toString('base64url')}`],
    ['garbage', 'not-a-jwt'],
  ] as const) {
    const result = await login(f, token, { provider: 'apple', idToken });
    assert.equal(result.status, 401, `${label}: ${result.text}`);
    assert.equal(result.body.error.code, 'AUTH_FAILED', label);
  }
  assert.equal((await f.request('/auth/me', { token })).body.account, null);
});

test('cross-device: one account sees, fills and seals the same capsule as a single member; logout hides it again', async (t) => {
  const f = await fixture(t, { auth: { dev: true } });
  const a = await f.session('민지');
  const friend = await f.session('상길');
  const capsule = await f.create(a);
  assert.equal((await f.add(a, capsule.id, { kind: 'letter', text: '기기 A 편지' })).status, 201);
  const photo = await f.add(a, capsule.id, { kind: 'photo', media: { mimeType: 'image/png', base64: PNG } });
  const uriBeforeLogin: string = photo.body.item.uri;
  assert.equal((await f.join(friend, capsule.inviteCode)).status, 200);
  assert.equal((await f.add(friend, capsule.id)).status, 201);
  const memberIdBefore = me(await f.get(a, capsule.id)).id;

  const loginA = await login(f, a, { provider: 'dev', name: '민지' });
  assert.equal(loginA.status, 200, loginA.text);
  const b = await f.session();
  const loginB = await login(f, b, { provider: 'dev', name: '민지' });
  assert.equal(loginB.body.account.id, loginA.body.account.id);
  assert.equal(loginB.body.displayName, '민지');

  const list = await f.request('/capsules', { token: b });
  assert.equal(list.status, 200, list.text);
  assert.deepEqual(list.body.capsules.map((entry: Capsule) => entry.id), [capsule.id]);
  const seenByB: Capsule = list.body.capsules[0];
  assert.equal(seenByB.members.length, 2);
  assert.equal(seenByB.members.filter((member) => member.isMe).length, 1);
  assert.deepEqual({ ...me(seenByB), items: me(seenByB).items.length }, { id: memberIdBefore, name: '민지', isMe: true, isHost: true, items: 2 });
  assert.equal(me(seenByB).items[0].text, '기기 A 편지');
  assert.equal((await f.join(b, capsule.inviteCode)).body.already, true);

  // A third device that joined on its own collapses into the same member once it logs in.
  const c = await f.session('딴폰');
  assert.equal((await f.join(c, capsule.inviteCode)).status, 200);
  assert.equal((await f.get(a, capsule.id)).members.length, 3);
  await login(f, c, { provider: 'dev', name: '민지' });
  assert.equal((await f.get(a, capsule.id)).members.length, 2);

  // Slots are shared: A already has 2, so B can add 3 more and then everyone is full.
  for (let index = 0; index < 3; index += 1) assert.equal((await f.add(b, capsule.id)).status, 201);
  assert.equal((await f.add(b, capsule.id)).body.error.code, 'SLOTS_FULL');
  assert.equal((await f.add(a, capsule.id)).body.error.code, 'SLOTS_FULL');
  const seenByA = await f.get(a, capsule.id);
  assert.equal(me(seenByA).items.length, 5);
  assert.equal(seenByA.members.find((member) => !member.isMe)!.name, '상길');

  // B edits and deletes an item A put in.
  const letterId = me(seenByA).items[0].id;
  const edited = await f.request(`/capsules/${capsule.id}/items/${letterId}`, { method: 'PATCH', token: b, body: { text: 'B가 고침' } });
  assert.equal(edited.status, 200, edited.text);
  assert.equal(edited.body.item.text, 'B가 고침');
  assert.equal((await f.request(`/capsules/${capsule.id}/items/${letterId}`, { method: 'DELETE', token: b })).status, 200);
  assert.equal(me(await f.get(a, capsule.id)).items.length, 4);

  // The media URL A got before logging in still works, and so do fresh ones for B.
  assert.equal((await f.request(uriBeforeLogin)).status, 200);
  const photoForB = me(await f.get(b, capsule.id)).items.find((item) => item.kind === 'photo')!;
  assert.equal((await f.request(photoForB.uri!)).status, 200);

  // The friend still cannot touch the account's items.
  assert.equal((await f.request(`/capsules/${capsule.id}/items/${photoForB.id}`, { method: 'DELETE', token: friend })).status, 404);

  // A name change on one device follows the account everywhere.
  assert.deepEqual((await f.request('/sessions/me', { method: 'PATCH', token: b, body: { displayName: '민지B' } })).body, { displayName: '민지B' });
  assert.equal(me(await f.get(a, capsule.id)).name, '민지B');
  assert.equal((await f.request('/auth/me', { token: a })).body.displayName, '민지B');
  assert.equal((await f.get(friend, capsule.id)).members[0].name, '민지B');

  // B was never the host's device, but the account is the host.
  const sealed = await f.request(`/capsules/${capsule.id}/seal`, { method: 'POST', token: b });
  assert.equal(sealed.status, 200, sealed.text);
  assert.equal(sealed.body.capsule.status, 'sealed');

  assert.deepEqual((await f.request('/auth/logout', { method: 'POST', token: b })).body, { ok: true });
  assert.deepEqual((await f.request('/capsules', { token: b })).body.capsules, []);
  assert.equal((await f.request(`/capsules/${capsule.id}`, { token: b })).status, 404);
  assert.equal((await f.request('/capsules', { token: a })).body.capsules.length, 1);
});

test('a v2 database is migrated in place: capsules and sessions survive, sessions gain user_id', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'capsule-v2-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const databasePath = join(directory, 'capsules.sqlite');
  const token = 'A'.repeat(43);
  const { createHash } = await import('node:crypto');
  const v2 = new DatabaseSync(databasePath);
  v2.exec(`
    CREATE TABLE sessions (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE capsules (id TEXT PRIMARY KEY, title TEXT NOT NULL, mode TEXT NOT NULL CHECK (mode IN ('solo', 'group')),
      status TEXT NOT NULL CHECK (status IN ('collecting', 'sealed', 'opened')), created_at TEXT NOT NULL, deadline_at TEXT NOT NULL,
      open_at TEXT NOT NULL, sealed_at TEXT, opened_at TEXT, invite_code TEXT NOT NULL UNIQUE, host_session_id TEXT NOT NULL REFERENCES sessions(id),
      latitude REAL, longitude REAL, accuracy REAL, place_label TEXT, planted_at TEXT);
    CREATE TABLE members (capsule_id TEXT NOT NULL REFERENCES capsules(id) ON DELETE CASCADE, session_id TEXT NOT NULL REFERENCES sessions(id),
      member_id TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, is_host INTEGER NOT NULL DEFAULT 0, joined_at TEXT NOT NULL, PRIMARY KEY (capsule_id, session_id));
    CREATE TABLE items (id TEXT PRIMARY KEY, capsule_id TEXT NOT NULL REFERENCES capsules(id) ON DELETE CASCADE, session_id TEXT NOT NULL REFERENCES sessions(id),
      kind TEXT NOT NULL, created_at TEXT NOT NULL, text TEXT, duration_ms INTEGER, media_mime TEXT, media_blob BLOB, media_bytes INTEGER);
    PRAGMA user_version = 2;
  `);
  const at = new Date(START_TIME).toISOString();
  v2.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run('s1', createHash('sha256').update(token).digest('hex'), '옛날민지', at);
  v2.prepare(`INSERT INTO capsules (id, title, mode, status, created_at, deadline_at, open_at, invite_code, host_session_id)
    VALUES ('c1', '남아 있어야 함', 'solo', 'collecting', ?, ?, ?, 'ABCDEF', 's1')`).run(at, '2026-09-22T03:00:00.000Z', '2026-11-01T03:00:00.000Z');
  v2.prepare("INSERT INTO members VALUES ('c1', 's1', 'm1', '옛날민지', 1, ?)").run(at);
  v2.prepare("INSERT INTO items (id, capsule_id, session_id, kind, created_at, text) VALUES ('i1', 'c1', 's1', 'letter', ?, '옛 편지')").run(at);
  v2.close();

  const app = createCapsuleServer({ databasePath, now: () => START_TIME, onError: (error) => { throw error; }, auth: { dev: true } });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const list = await (await fetch(`${base}/capsules`, { headers })).json() as { capsules: Capsule[] };
  assert.equal(list.capsules.length, 1);
  assert.equal(list.capsules[0].title, '남아 있어야 함');
  assert.equal(me(list.capsules[0]).items[0].text, '옛 편지');
  const loggedIn = await fetch(`${base}/auth/login`, { method: 'POST', headers, body: JSON.stringify({ provider: 'dev', name: '민지' }) });
  assert.equal(loggedIn.status, 200);
  assert.equal(((await loggedIn.json()) as { displayName: string }).displayName, '옛날민지');

  const db = new DatabaseSync(databasePath);
  const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  const columns = (db.prepare('PRAGMA table_info(sessions)').all() as { name: string }[]).map((column) => column.name);
  db.close();
  assert.equal(version, 3);
  assert.ok(columns.includes('user_id'));
});
