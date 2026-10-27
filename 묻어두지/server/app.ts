import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { chmodSync, mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  DEADLINE_DAY_OPTIONS,
  LETTER_MAX_CHARS,
  MAX_ITEMS_PER_MEMBER,
  MAX_MEMBERS,
  VIDEO_MAX_MS,
  VOICE_MAX_MS,
  addDays,
  autoSealReason,
  canAddItem,
  canSeal,
  generateInviteCode,
  isLetterValid,
  isValidOpenAtForCreate,
  normalizeInviteCode,
  type Capsule,
  type CapsuleItem,
  type CapsuleMode,
  type CapsuleStatus,
  type ItemKind,
  type Member,
  type PlantedLocation,
} from '../src/domain/capsule';
import { MEDIA_LIMITS_BYTES, MEDIA_URL_TTL_MS, type ApiErrorBody, type ApiErrorCode } from '../src/shared/capsule-api';
import { MediaError, parseMedia, type ParsedMedia } from './media';

const SCHEMA_VERSION = 2;
const SMALL_BODY_BYTES = 16 * 1024;
/** Item routes carry one Base64 attachment; the largest allowed one is a video. */
const ITEM_BODY_BYTES = Math.ceil(MEDIA_LIMITS_BYTES.video / 3) * 4 + 64 * 1024;
const JSON_CONTENT_TYPE = /^application\/json(?:\s*;|$)/i;
const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/;
const DEFAULT_DISPLAY_NAME = '나';
const DISPLAY_NAME_MAX = 12;
const TITLE_MAX = 30;
const PLACE_LABEL_MAX = 60;
const ID = '([A-Za-z0-9-]{1,64})';

type SessionRow = { id: string; display_name: string };
type CapsuleRow = {
  id: string;
  title: string;
  mode: CapsuleMode;
  status: CapsuleStatus;
  created_at: string;
  deadline_at: string;
  open_at: string;
  sealed_at: string | null;
  opened_at: string | null;
  invite_code: string;
  host_session_id: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  place_label: string | null;
  planted_at: string | null;
};
type MemberRow = { session_id: string; member_id: string; display_name: string; is_host: number };
type ItemRow = {
  id: string;
  session_id: string;
  kind: ItemKind;
  created_at: string;
  text: string | null;
  duration_ms: number | null;
  media_mime: string | null;
  media_bytes: number | null;
};

class ApiError extends Error {
  constructor(readonly status: number, readonly code: ApiErrorCode, message: string) {
    super(message);
  }
}

function invalid(message: string): never {
  throw new ApiError(400, 'VALIDATION', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function boundedText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') invalid(`${label}을(를) 입력해 주세요.`);
  const text = value.trim();
  if (!text || text.length > max) invalid(`${label}은(는) 1~${max}자로 입력해 주세요.`);
  return text;
}

function parseDisplayName(value: unknown, fallback?: string): string {
  if (value === undefined && fallback !== undefined) return fallback;
  return boundedText(value, '이름', DISPLAY_NAME_MAX);
}

function parseLocation(value: unknown, plantedAt: string): PlantedLocation {
  if (!isRecord(value)) invalid('심을 자리를 지도에서 골라 주세요.');
  const { latitude, longitude, accuracy, label } = value;
  if (!finiteNumber(latitude) || latitude < -90 || latitude > 90) invalid('올바른 위도가 필요해요.');
  if (!finiteNumber(longitude) || longitude < -180 || longitude > 180) invalid('올바른 경도가 필요해요.');
  if (accuracy !== null && accuracy !== undefined && (!finiteNumber(accuracy) || accuracy < 0)) invalid('위치 정확도가 올바르지 않아요.');
  if (label !== undefined && typeof label !== 'string') invalid('장소 이름이 올바르지 않아요.');
  const trimmed = (label ?? '').trim();
  if (trimmed.length > PLACE_LABEL_MAX) invalid(`장소 이름은 ${PLACE_LABEL_MAX}자 이하로 적어 주세요.`);
  return { latitude, longitude, accuracy: accuracy ?? null, label: trimmed, plantedAt };
}

function parseDuration(value: unknown, kind: ItemKind): number | null {
  if (kind !== 'voice' && kind !== 'video') return null;
  if (value === undefined || value === null) return null;
  if (!finiteNumber(value) || !Number.isInteger(value) || value < 0) invalid('길이(durationMs)가 올바르지 않아요.');
  const max = kind === 'voice' ? VOICE_MAX_MS : VIDEO_MAX_MS;
  if (value > max) invalid(kind === 'voice' ? `음성은 ${VOICE_MAX_MS / 1000}초까지 넣을 수 있어요.` : `동영상은 ${VIDEO_MAX_MS / 1000}초까지 넣을 수 있어요.`);
  return value;
}

function parseLetter(value: unknown): string {
  if (typeof value !== 'string' || !isLetterValid(value)) invalid(`편지는 1~${LETTER_MAX_CHARS}자로 적어 주세요.`);
  return value;
}

function parseItemMedia(value: unknown, kind: Exclude<ItemKind, 'letter'>): ParsedMedia {
  try {
    return parseMedia(value, kind);
  } catch (error) {
    if (!(error instanceof MediaError)) throw error;
    if (error.reason === 'TOO_LARGE') throw new ApiError(413, 'PAYLOAD_TOO_LARGE', error.message);
    throw new ApiError(400, error.reason, error.message);
  }
}

function readJson(request: IncomingMessage, maxBytes: number): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks: Buffer[] = [];
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      chunks.length = 0;
      reject(error);
    };
    request.on('data', (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        fail(new ApiError(413, 'PAYLOAD_TOO_LARGE', '요청이 너무 커요. 사진 8MB, 음성 4MB, 동영상 40MB 이하로 넣어 주세요.'));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      if (!JSON_CONTENT_TYPE.test(request.headers['content-type'] ?? '')) {
        return reject(new ApiError(400, 'VALIDATION', 'application/json 요청이 필요해요.'));
      }
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return reject(new ApiError(400, 'VALIDATION', 'JSON 객체가 필요해요.'));
        resolve(parsed);
      } catch {
        reject(new ApiError(400, 'VALIDATION', 'JSON 요청을 읽을 수 없어요.'));
      }
    });
    request.on('error', fail);
    request.on('aborted', () => fail(new ApiError(400, 'VALIDATION', '요청이 중단됐어요.')));
  });
}

function respond(response: ServerResponse, status: number, body?: unknown): void {
  if (response.destroyed) return;
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body === undefined ? undefined : JSON.stringify(body));
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseOrigins(value: string | undefined): string[] {
  return (value ?? '').split(',').map((origin) => origin.trim().replace(/\/+$/, '')).filter(Boolean);
}

export type CapsuleServerOptions = {
  databasePath: string;
  now?: () => number;
  onError?: (error: unknown) => void;
  /** Extra allowed browser origins. Defaults to env CORS_ORIGINS (comma separated). */
  corsOrigins?: string[];
  /** HMAC key for media URLs. Defaults to env MEDIA_SIGNING_SECRET, else random per process. */
  mediaSigningSecret?: string;
};

export function createCapsuleServer({
  databasePath,
  now = Date.now,
  onError = console.error,
  corsOrigins = parseOrigins(process.env.CORS_ORIGINS),
  mediaSigningSecret = process.env.MEDIA_SIGNING_SECRET || randomBytes(32).toString('hex'),
}: CapsuleServerOptions) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(databasePath);
  if (databasePath !== ':memory:') chmodSync(databasePath, 0o600);
  const allowedOrigins = new Set(parseOrigins(corsOrigins.join(',')));

  try {
    database.exec('PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL;');
    const { user_version: version } = database.prepare('PRAGMA user_version').get() as { user_version: number };
    if (version < SCHEMA_VERSION) {
      // The pre-v2 PoC stored one letter per "pit" with groups and attendance. That data model
      // cannot be mapped onto member-owned items, so local PoC tables are dropped.
      database.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE IF EXISTS group_members;
        DROP TABLE IF EXISTS capsule_groups;
        DROP TABLE IF EXISTS creation_requests;
        DROP TABLE IF EXISTS items;
        DROP TABLE IF EXISTS members;
        DROP TABLE IF EXISTS capsules;
        DROP TABLE IF EXISTS sessions;
      `);
    }
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS capsules (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('solo', 'group')),
        status TEXT NOT NULL CHECK (status IN ('collecting', 'sealed', 'opened')),
        created_at TEXT NOT NULL,
        deadline_at TEXT NOT NULL,
        open_at TEXT NOT NULL,
        sealed_at TEXT,
        opened_at TEXT,
        invite_code TEXT NOT NULL UNIQUE,
        host_session_id TEXT NOT NULL REFERENCES sessions(id),
        latitude REAL,
        longitude REAL,
        accuracy REAL,
        place_label TEXT,
        planted_at TEXT
      );
      CREATE TABLE IF NOT EXISTS members (
        capsule_id TEXT NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        member_id TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        is_host INTEGER NOT NULL DEFAULT 0,
        joined_at TEXT NOT NULL,
        PRIMARY KEY (capsule_id, session_id)
      );
      CREATE INDEX IF NOT EXISTS members_session ON members(session_id);
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        capsule_id TEXT NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        kind TEXT NOT NULL CHECK (kind IN ('letter', 'photo', 'voice', 'video')),
        created_at TEXT NOT NULL,
        text TEXT,
        duration_ms INTEGER,
        media_mime TEXT,
        media_blob BLOB,
        media_bytes INTEGER
      );
      CREATE INDEX IF NOT EXISTS items_capsule_session ON items(capsule_id, session_id);
      PRAGMA user_version = ${SCHEMA_VERSION};
    `);
  } catch (error) {
    database.close();
    throw error;
  }

  const iso = (time = now()) => new Date(time).toISOString();

  function transaction<T>(work: () => T): T {
    database.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      database.exec('COMMIT');
      return result;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function authenticate(request: IncomingMessage): SessionRow {
    const authorization = request.headers.authorization;
    if (!authorization || !/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization)) {
      throw new ApiError(401, 'UNAUTHORIZED', '기기 인증이 필요해요. 앱을 다시 열어 주세요.');
    }
    const session = database.prepare('SELECT id, display_name FROM sessions WHERE token_hash = ?')
      .get(hashToken(authorization.slice(7))) as SessionRow | undefined;
    if (!session) throw new ApiError(401, 'UNAUTHORIZED', '기기 인증이 만료됐거나 올바르지 않아요. 앱을 다시 열어 주세요.');
    return session;
  }

  const capsuleRow = (id: string) => database.prepare('SELECT * FROM capsules WHERE id = ?').get(id) as CapsuleRow | undefined;
  const membersOf = (capsuleId: string) => database.prepare(
    'SELECT session_id, member_id, display_name, is_host FROM members WHERE capsule_id = ? ORDER BY joined_at, rowid',
  ).all(capsuleId) as MemberRow[];
  const itemsOf = (capsuleId: string) => database.prepare(
    `SELECT id, session_id, kind, created_at, text, duration_ms, media_mime, media_bytes
     FROM items WHERE capsule_id = ? ORDER BY created_at, rowid`,
  ).all(capsuleId) as ItemRow[];
  const itemCount = (capsuleId: string, sessionId: string) => (database.prepare(
    'SELECT COUNT(*) AS count FROM items WHERE capsule_id = ? AND session_id = ?',
  ).get(capsuleId, sessionId) as { count: number }).count;

  /** Item counts only — enough for canSeal / autoSealReason without touching contents. */
  function judgeable(row: CapsuleRow) {
    const items = itemsOf(row.id);
    return {
      status: row.status,
      mode: row.mode,
      deadlineAt: row.deadline_at,
      members: membersOf(row.id).map((member): Member => ({
        id: member.member_id,
        name: member.display_name,
        isMe: false,
        isHost: member.is_host === 1,
        items: items
          .filter((item) => item.session_id === member.session_id)
          .map((item) => ({ id: item.id, kind: item.kind, createdAt: item.created_at })),
      })),
    };
  }

  /** Persists an automatic seal (deadline passed or everyone full) before anything reads or writes the capsule. */
  function settle(row: CapsuleRow): CapsuleRow {
    if (row.status !== 'collecting') return row;
    if (!autoSealReason(judgeable(row), new Date(now()))) return row;
    const sealedAt = iso();
    database.prepare("UPDATE capsules SET status = 'sealed', sealed_at = ? WHERE id = ? AND status = 'collecting'").run(sealedAt, row.id);
    return { ...row, status: 'sealed', sealed_at: sealedAt };
  }

  /** Loads a capsule the caller belongs to (404 otherwise) and settles it. */
  function memberCapsule(id: string, sessionId: string): CapsuleRow {
    const row = capsuleRow(id);
    if (!row || !database.prepare('SELECT 1 FROM members WHERE capsule_id = ? AND session_id = ?').get(id, sessionId)) {
      throw new ApiError(404, 'NOT_FOUND', '캡슐을 찾을 수 없어요.');
    }
    return settle(row);
  }

  function sign(capsuleId: string, itemId: string, memberId: string, exp: number): string {
    return createHmac('sha256', mediaSigningSecret).update(`${capsuleId}:${itemId}:${memberId}:${exp}`).digest('hex');
  }

  function mediaPath(capsuleId: string, itemId: string, memberId: string): string {
    const exp = now() + MEDIA_URL_TTL_MS;
    const query = new URLSearchParams({ m: memberId, exp: String(exp), sig: sign(capsuleId, itemId, memberId, exp) });
    return `/capsules/${capsuleId}/items/${itemId}/media?${query}`;
  }

  /** Contract visibility: own items while collecting, nobody's while sealed, everyone's once opened. */
  const contentVisible = (status: CapsuleStatus, isOwn: boolean) => status === 'opened' || (status === 'collecting' && isOwn);

  function serializeItem(row: CapsuleRow, item: ItemRow, viewerSessionId: string, viewerMemberId: string | null): CapsuleItem {
    const result: CapsuleItem = { id: item.id, kind: item.kind, createdAt: item.created_at };
    if (item.duration_ms !== null) result.durationMs = item.duration_ms;
    if (!contentVisible(row.status, item.session_id === viewerSessionId)) return result;
    if (item.text !== null) result.text = item.text;
    if (item.media_mime !== null && viewerMemberId) result.uri = mediaPath(row.id, item.id, viewerMemberId);
    return result;
  }

  function serializeCapsule(stored: CapsuleRow, sessionId: string): Capsule {
    const row = settle(stored);
    const members = membersOf(row.id);
    const items = itemsOf(row.id);
    const viewer = members.find((member) => member.session_id === sessionId) ?? null;
    const location: PlantedLocation | null = row.latitude !== null && row.longitude !== null
      ? { latitude: row.latitude, longitude: row.longitude, accuracy: row.accuracy, label: row.place_label ?? '', plantedAt: row.planted_at ?? row.created_at }
      : null;
    return {
      id: row.id,
      title: row.title,
      mode: row.mode,
      createdAt: row.created_at,
      deadlineAt: row.deadline_at,
      status: row.status,
      sealedAt: row.sealed_at,
      openAt: row.open_at,
      openedAt: row.opened_at,
      inviteCode: row.invite_code,
      location,
      members: members.map((member) => ({
        id: member.member_id,
        name: member.display_name,
        isMe: member.session_id === sessionId,
        isHost: member.is_host === 1,
        items: items
          .filter((item) => item.session_id === member.session_id)
          .map((item) => serializeItem(row, item, sessionId, viewer?.member_id ?? null)),
      })),
    };
  }

  const capsuleResponse = (id: string, sessionId: string) => ({ capsule: serializeCapsule(capsuleRow(id)!, sessionId), serverNow: iso() });

  function requireCollecting(row: CapsuleRow) {
    if (row.status !== 'collecting') throw new ApiError(409, 'CAPSULE_CLOSED', '이미 닫힌 캡슐이에요. 이제는 넣거나 고칠 수 없어요.');
  }

  function requireHost(row: CapsuleRow, sessionId: string) {
    if (row.host_session_id !== sessionId) throw new ApiError(403, 'NOT_HOST', '방장만 할 수 있어요.');
  }

  function ownItem(capsuleId: string, itemId: string, sessionId: string): ItemRow {
    const item = database.prepare(
      `SELECT id, session_id, kind, created_at, text, duration_ms, media_mime, media_bytes
       FROM items WHERE id = ? AND capsule_id = ? AND session_id = ?`,
    ).get(itemId, capsuleId, sessionId) as ItemRow | undefined;
    if (!item) throw new ApiError(404, 'NOT_FOUND', '내가 넣은 물건을 찾을 수 없어요.');
    return item;
  }

  function itemResponse(capsuleId: string, item: ItemRow, sessionId: string) {
    const capsule = serializeCapsule(capsuleRow(capsuleId)!, sessionId);
    const row = capsuleRow(capsuleId)!;
    const viewer = capsule.members.find((member) => member.isMe)!;
    return { item: serializeItem(row, item, sessionId, viewer.id), capsule, serverNow: iso() };
  }

  function createCapsule(session: SessionRow, body: Record<string, unknown>) {
    const title = boundedText(body.title, '캡슐 이름', TITLE_MAX);
    const mode = body.mode;
    if (mode !== 'solo' && mode !== 'group') invalid('혼자 묻을지, 함께 묻을지 골라 주세요.');
    const deadlineDays = body.deadlineDays;
    if (!(DEADLINE_DAY_OPTIONS as readonly unknown[]).includes(deadlineDays)) {
      invalid(`넣기 마감은 ${DEADLINE_DAY_OPTIONS.join('·')}일 중에서 골라 주세요.`);
    }
    const createdAt = iso();
    const deadlineAt = addDays(createdAt, deadlineDays as number);
    const openTime = typeof body.openAt === 'string' ? Date.parse(body.openAt) : NaN;
    if (!Number.isFinite(openTime)) invalid('여는 날을 골라 주세요.');
    const openAt = new Date(openTime).toISOString();
    if (!isValidOpenAtForCreate(createdAt, deadlineAt, openAt)) {
      invalid('여는 날은 오늘부터 30~180일 사이, 넣기 마감 뒤로 골라 주세요.');
    }
    const location = body.location === undefined || body.location === null ? null : parseLocation(body.location, createdAt);
    const id = randomUUID();
    transaction(() => {
      for (let attempt = 0; ; attempt += 1) {
        const code = generateInviteCode(() => randomBytes(1)[0] / 256);
        if (database.prepare('SELECT 1 FROM capsules WHERE invite_code = ?').get(code)) {
          if (attempt > 20) throw new Error('Could not allocate an invite code.');
          continue;
        }
        database.prepare(`INSERT INTO capsules
          (id, title, mode, status, created_at, deadline_at, open_at, invite_code, host_session_id, latitude, longitude, accuracy, place_label, planted_at)
          VALUES (?, ?, ?, 'collecting', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id, title, mode, createdAt, deadlineAt, openAt, code, session.id,
            location?.latitude ?? null, location?.longitude ?? null, location?.accuracy ?? null,
            location?.label ?? null, location?.plantedAt ?? null);
        break;
      }
      database.prepare('INSERT INTO members (capsule_id, session_id, member_id, display_name, is_host, joined_at) VALUES (?, ?, ?, ?, 1, ?)')
        .run(id, session.id, randomUUID(), session.display_name, createdAt);
    });
    return id;
  }

  function joinCapsule(session: SessionRow, body: Record<string, unknown>) {
    if (typeof body.code !== 'string') invalid('초대 코드를 입력해 주세요.');
    const code = normalizeInviteCode(body.code);
    const found = code.length === 6 ? database.prepare('SELECT * FROM capsules WHERE invite_code = ?').get(code) as CapsuleRow | undefined : undefined;
    if (!found) throw new ApiError(404, 'INVITE_NOT_FOUND', '그 초대 코드로는 캡슐을 찾지 못했어요. 코드 6자리를 다시 확인해 주세요.');
    if (database.prepare('SELECT 1 FROM members WHERE capsule_id = ? AND session_id = ?').get(found.id, session.id)) {
      return { id: found.id, already: true };
    }
    const row = settle(found);
    if (row.status !== 'collecting') throw new ApiError(409, 'CAPSULE_CLOSED', '이미 닫힌 캡슐이라 들어갈 수 없어요.');
    if (row.mode === 'solo') throw new ApiError(409, 'CAPSULE_CLOSED', '혼자 묻는 캡슐에는 들어갈 수 없어요.');
    if (membersOf(row.id).length >= MAX_MEMBERS) throw new ApiError(409, 'CAPSULE_FULL', `한 캡슐에는 ${MAX_MEMBERS}명까지만 함께할 수 있어요.`);
    database.prepare('INSERT INTO members (capsule_id, session_id, member_id, display_name, is_host, joined_at) VALUES (?, ?, ?, ?, 0, ?)')
      .run(row.id, session.id, randomUUID(), session.display_name, iso());
    return { id: row.id, already: false };
  }

  function addItem(session: SessionRow, row: CapsuleRow, body: Record<string, unknown>) {
    requireCollecting(row);
    const kind = body.kind;
    if (kind !== 'letter' && kind !== 'photo' && kind !== 'voice' && kind !== 'video') invalid('넣을 물건 종류를 골라 주세요.');
    if (!canAddItem({ items: new Array<CapsuleItem>(itemCount(row.id, session.id)) })) {
      throw new ApiError(409, 'SLOTS_FULL', `한 사람은 ${MAX_ITEMS_PER_MEMBER}개까지 넣을 수 있어요. 하나를 빼고 다시 넣어 주세요.`);
    }
    const text = kind === 'letter' ? parseLetter(body.text) : null;
    const durationMs = parseDuration(body.durationMs, kind);
    const media = kind === 'letter' ? null : parseItemMedia(body.media, kind);
    const id = randomUUID();
    database.prepare(`INSERT INTO items (id, capsule_id, session_id, kind, created_at, text, duration_ms, media_mime, media_blob, media_bytes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, row.id, session.id, kind, iso(), text, durationMs, media?.mimeType ?? null, media?.bytes ?? null, media?.bytes.length ?? null);
    return ownItem(row.id, id, session.id);
  }

  function updateItem(session: SessionRow, row: CapsuleRow, itemId: string, body: Record<string, unknown>) {
    const item = ownItem(row.id, itemId, session.id);
    requireCollecting(row);
    if (item.kind === 'letter') {
      if (body.text !== undefined) database.prepare('UPDATE items SET text = ? WHERE id = ?').run(parseLetter(body.text), item.id);
    } else {
      if (body.durationMs !== undefined) database.prepare('UPDATE items SET duration_ms = ? WHERE id = ?').run(parseDuration(body.durationMs, item.kind), item.id);
      if (body.media !== undefined) {
        const media = parseItemMedia(body.media, item.kind);
        database.prepare('UPDATE items SET media_mime = ?, media_blob = ?, media_bytes = ? WHERE id = ?')
          .run(media.mimeType, media.bytes, media.bytes.length, item.id);
      }
    }
    return ownItem(row.id, item.id, session.id);
  }

  function serveMedia(request: IncomingMessage, response: ServerResponse, url: URL, capsuleId: string, itemId: string) {
    const deny = () => new ApiError(403, 'UNAUTHORIZED', '이 파일은 지금 볼 수 없어요. 캡슐을 다시 불러와 주세요.');
    const memberId = url.searchParams.get('m') ?? '';
    const expText = url.searchParams.get('exp') ?? '';
    const sig = url.searchParams.get('sig') ?? '';
    const exp = Number(expText);
    if (!/^\d{1,16}$/.test(expText) || !/^[a-f0-9]{64}$/.test(sig) || exp < now()) throw deny();
    const expected = Buffer.from(sign(capsuleId, itemId, memberId, exp), 'hex');
    if (!timingSafeEqual(expected, Buffer.from(sig, 'hex'))) throw deny();
    const member = database.prepare('SELECT session_id FROM members WHERE member_id = ? AND capsule_id = ?')
      .get(memberId, capsuleId) as { session_id: string } | undefined;
    const stored = capsuleRow(capsuleId);
    if (!member || !stored) throw deny();
    const row = settle(stored);
    const item = database.prepare('SELECT session_id, media_mime, media_blob FROM items WHERE id = ? AND capsule_id = ?')
      .get(itemId, capsuleId) as { session_id: string; media_mime: string | null; media_blob: Uint8Array | null } | undefined;
    if (!item || !item.media_blob || !item.media_mime || !contentVisible(row.status, item.session_id === member.session_id)) throw deny();

    const blob = Buffer.from(item.media_blob);
    const headers: Record<string, string | number> = {
      'Content-Type': item.media_mime,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    };
    // Safari's <video> insists on byte ranges.
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '');
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : Math.max(0, blob.length - Number(range[2]));
      let end = range[1] && range[2] ? Math.min(Number(range[2]), blob.length - 1) : blob.length - 1;
      if (start >= blob.length || start > end) {
        response.writeHead(416, { ...headers, 'Content-Range': `bytes */${blob.length}` });
        response.end();
        return;
      }
      start = Math.max(0, start);
      end = Math.max(start, end);
      response.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${blob.length}`, 'Content-Length': end - start + 1 });
      response.end(request.method === 'HEAD' ? undefined : blob.subarray(start, end + 1));
      return;
    }
    response.writeHead(200, { ...headers, 'Content-Length': blob.length });
    response.end(request.method === 'HEAD' ? undefined : blob);
  }

  const server = createServer(async (request, response) => {
    try {
      const origin = request.headers.origin;
      if (origin) {
        if (!LOCAL_ORIGIN.test(origin) && !allowedOrigins.has(origin)) {
          throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', '허용되지 않은 웹 주소에서 온 요청이에요.');
        }
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        response.setHeader('Access-Control-Max-Age', '600');
      }
      if (request.method === 'OPTIONS') return respond(response, 204);
      const url = new URL(request.url ?? '/', 'http://localhost');
      const { pathname } = url;
      const method = request.method ?? 'GET';

      if (method === 'GET' && pathname === '/health') return respond(response, 200, { ok: true, serverNow: iso() });

      const mediaRoute = new RegExp(`^/capsules/${ID}/items/${ID}/media$`).exec(pathname);
      if ((method === 'GET' || method === 'HEAD') && mediaRoute) return serveMedia(request, response, url, mediaRoute[1], mediaRoute[2]);

      if (method === 'POST' && pathname === '/sessions') {
        const body = await readJson(request, SMALL_BODY_BYTES);
        const displayName = parseDisplayName(body.displayName, DEFAULT_DISPLAY_NAME);
        const token = randomBytes(32).toString('base64url');
        database.prepare('INSERT INTO sessions (id, token_hash, display_name, created_at) VALUES (?, ?, ?, ?)')
          .run(randomUUID(), hashToken(token), displayName, iso());
        return respond(response, 201, { token, displayName });
      }

      const session = authenticate(request);

      if (method === 'PATCH' && pathname === '/sessions/me') {
        const body = await readJson(request, SMALL_BODY_BYTES);
        const displayName = parseDisplayName(body.displayName);
        transaction(() => {
          database.prepare('UPDATE sessions SET display_name = ? WHERE id = ?').run(displayName, session.id);
          database.prepare('UPDATE members SET display_name = ? WHERE session_id = ?').run(displayName, session.id);
        });
        return respond(response, 200, { displayName });
      }

      if (method === 'GET' && pathname === '/capsules') {
        const rows = database.prepare(`SELECT capsules.* FROM capsules JOIN members ON members.capsule_id = capsules.id
          WHERE members.session_id = ? ORDER BY capsules.created_at DESC, capsules.rowid DESC`).all(session.id) as CapsuleRow[];
        return respond(response, 200, { capsules: rows.map((row) => serializeCapsule(row, session.id)), serverNow: iso() });
      }
      if (method === 'POST' && pathname === '/capsules') {
        const id = createCapsule(session, await readJson(request, SMALL_BODY_BYTES));
        return respond(response, 201, capsuleResponse(id, session.id));
      }
      if (method === 'POST' && pathname === '/capsules/join') {
        const { id, already } = joinCapsule(session, await readJson(request, SMALL_BODY_BYTES));
        return respond(response, 200, { ...capsuleResponse(id, session.id), already });
      }

      const capsuleRoute = new RegExp(`^/capsules/${ID}$`).exec(pathname);
      if (method === 'GET' && capsuleRoute) {
        memberCapsule(capsuleRoute[1], session.id);
        return respond(response, 200, capsuleResponse(capsuleRoute[1], session.id));
      }

      const itemsRoute = new RegExp(`^/capsules/${ID}/items$`).exec(pathname);
      if (method === 'POST' && itemsRoute) {
        const row = memberCapsule(itemsRoute[1], session.id);
        const body = await readJson(request, ITEM_BODY_BYTES);
        // Re-read after the upload: the deadline may have passed while bytes were arriving.
        const item = addItem(session, memberCapsule(row.id, session.id), body);
        return respond(response, 201, itemResponse(row.id, item, session.id));
      }

      const itemRoute = new RegExp(`^/capsules/${ID}/items/${ID}$`).exec(pathname);
      if ((method === 'PATCH' || method === 'DELETE') && itemRoute) {
        const [, capsuleId, itemId] = itemRoute;
        memberCapsule(capsuleId, session.id);
        if (method === 'PATCH') {
          const body = await readJson(request, ITEM_BODY_BYTES);
          const item = updateItem(session, memberCapsule(capsuleId, session.id), itemId, body);
          return respond(response, 200, itemResponse(capsuleId, item, session.id));
        }
        const row = memberCapsule(capsuleId, session.id);
        const item = ownItem(capsuleId, itemId, session.id);
        requireCollecting(row);
        database.prepare('DELETE FROM items WHERE id = ?').run(item.id);
        const capsule = serializeCapsule(capsuleRow(capsuleId)!, session.id);
        const removed: CapsuleItem = { id: item.id, kind: item.kind, createdAt: item.created_at };
        if (item.text !== null) removed.text = item.text;
        if (item.duration_ms !== null) removed.durationMs = item.duration_ms;
        return respond(response, 200, { item: removed, capsule, serverNow: iso() });
      }

      const actionRoute = new RegExp(`^/capsules/${ID}/(seal|open|plant)$`).exec(pathname);
      if (method === 'POST' && actionRoute) {
        const [, capsuleId, action] = actionRoute;
        const row = memberCapsule(capsuleId, session.id);
        if (action === 'seal') {
          requireHost(row, session.id);
          // A retry, or a seal that the deadline already performed, returns the sealed capsule.
          if (row.status === 'collecting') {
            if (!canSeal(judgeable(row))) {
              throw new ApiError(409, 'CANNOT_SEAL', row.mode === 'solo'
                ? '물건을 하나 이상 넣은 뒤 닫을 수 있어요.'
                : '물건을 넣은 사람이 2명 이상이어야 닫을 수 있어요. 친구에게 초대 코드를 보내 주세요.');
            }
            database.prepare("UPDATE capsules SET status = 'sealed', sealed_at = ? WHERE id = ? AND status = 'collecting'").run(iso(), row.id);
          }
        } else if (action === 'open') {
          if (row.status === 'collecting') throw new ApiError(409, 'NOT_SEALED', '아직 닫히지 않은 캡슐이에요. 먼저 닫아야 열 날을 기다릴 수 있어요.');
          if (row.status === 'sealed') {
            if (now() < Date.parse(row.open_at)) throw new ApiError(409, 'TOO_EARLY', '아직 여는 날이 아니에요. 조금만 더 기다려 주세요.');
            database.prepare("UPDATE capsules SET status = 'opened', opened_at = ? WHERE id = ? AND status = 'sealed'").run(iso(), row.id);
          }
        } else {
          requireHost(row, session.id);
          const body = await readJson(request, SMALL_BODY_BYTES);
          const location = parseLocation(body.location, iso());
          database.prepare('UPDATE capsules SET latitude = ?, longitude = ?, accuracy = ?, place_label = ?, planted_at = ? WHERE id = ?')
            .run(location.latitude, location.longitude, location.accuracy, location.label, location.plantedAt, row.id);
        }
        return respond(response, 200, capsuleResponse(capsuleId, session.id));
      }

      throw new ApiError(404, 'NOT_FOUND', '지원하지 않는 요청이에요.');
    } catch (error) {
      if (error instanceof ApiError) {
        const body: ApiErrorBody = { error: { code: error.code, message: error.message } };
        respond(response, error.status, body);
      } else {
        onError(error);
        respond(response, 500, { error: { code: 'INTERNAL_ERROR', message: '서버가 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.' } });
      }
    }
  });
  server.requestTimeout = 120_000;
  server.headersTimeout = 10_000;
  let closed = false;
  return {
    server,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      if (server.listening) {
        await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      }
      database.close();
    },
  };
}
