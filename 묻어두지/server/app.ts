import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { chmodSync, mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  CAPSULE_RADIUS_METERS,
  MAX_LOCATION_ACCURACY_METERS,
  MAX_LOCATION_AGE_MS,
  MAX_AUDIO_BYTES,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  type AudioMimeType,
  type ApiErrorBody,
  type CapsuleContent,
  type CapsuleSummary,
  type CreateCapsuleInput,
  type Eligibility,
  type LocationFix,
  type VideoMimeType,
} from '../src/shared/contracts';
import { parseMedia } from './media';

// A small allowance handles capture/transport clock jitter. Larger clock drift
// must be corrected on the phone; a future timestamp must not bypass freshness.
export const MAX_LOCATION_FUTURE_MS = 5_000;
const MAX_REQUEST_BYTES = [MAX_PHOTO_BYTES, MAX_AUDIO_BYTES, MAX_VIDEO_BYTES]
  .reduce((sum, limit) => sum + Math.ceil(limit / 3) * 4, 100_000);
const MAX_UNLOCK_SECONDS = 365 * 24 * 60 * 60;
const JSON_CONTENT_TYPE = /^application\/json(?:\s*;|$)/i;
const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/;

type CapsuleMetadataRow = {
  id: string;
  title: string;
  place_name: string;
  created_at: number;
  opens_at: number;
  opened_at: number | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  has_photo: number;
  has_audio: number;
  has_video: number;
};

type CapsuleContentRow = {
  letter: string;
  photo_base64: string | null;
  photo_mime_type: 'image/jpeg' | 'image/png' | null;
  audio_base64: string | null;
  audio_mime_type: AudioMimeType | null;
  audio_file_name: string | null;
  video_base64: string | null;
  video_mime_type: VideoMimeType | null;
  video_file_name: string | null;
};

// Large Base64 fields remain inside SQLite for metadata and gate requests.
// Only a successful /open query transfers attachment bytes into Node memory.
const METADATA_COLUMNS = `id, title, place_name, created_at, opens_at, opened_at,
  latitude, longitude, radius_meters,
  photo_base64 IS NOT NULL AS has_photo,
  audio_base64 IS NOT NULL AS has_audio,
  video_base64 IS NOT NULL AS has_video`;

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly eligibility?: Eligibility,
  ) {
    super(message);
  }
}

function rejectInput(message: string): never {
  throw new ApiError(400, 'INVALID_INPUT', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string') rejectInput(`${name}을(를) 입력해 주세요.`);
  const result = value.trim();
  if (!result || result.length > max) rejectInput(`${name}은(는) 1~${max}자로 입력해 주세요.`);
  return result;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseLocation(value: unknown): LocationFix {
  if (!isRecord(value)) rejectInput('현재 위치가 필요합니다.');
  const { latitude, longitude, accuracy, timestamp, mocked } = value;
  if (!finiteNumber(latitude) || latitude < -90 || latitude > 90) {
    rejectInput('올바른 위도가 필요합니다.');
  }
  if (!finiteNumber(longitude) || longitude < -180 || longitude > 180) {
    rejectInput('올바른 경도가 필요합니다.');
  }
  if (!finiteNumber(accuracy) || accuracy < 0) rejectInput('올바른 위치 정확도가 필요합니다.');
  if (!finiteNumber(timestamp) || timestamp <= 0) rejectInput('올바른 위치 측정 시각이 필요합니다.');
  if (mocked !== undefined && typeof mocked !== 'boolean') rejectInput('잘못된 위치 정보입니다.');
  return { latitude, longitude, accuracy, timestamp, mocked };
}

function parsePhoto(value: unknown): CapsuleContent['photo'] {
  if (value === null) return null;
  if (!isRecord(value)) rejectInput('사진 형식이 올바르지 않습니다.');
  const { base64, mimeType } = value;
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
    rejectInput('JPEG 또는 PNG 사진만 넣을 수 있습니다.');
  }
  if (
    typeof base64 !== 'string' ||
    base64.length === 0 ||
    base64.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 ||
    base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
  ) {
    rejectInput('사진은 4MB 이하의 올바른 Base64 파일이어야 합니다.');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_PHOTO_BYTES || bytes.toString('base64') !== base64) {
    rejectInput('사진은 4MB 이하여야 합니다.');
  }
  const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const isPng = bytes.length >= 8 && timingSafeEqual(bytes.subarray(0, 8), pngHeader);
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if ((mimeType === 'image/png' && !isPng) || (mimeType === 'image/jpeg' && !isJpeg)) {
    rejectInput('사진 파일과 이미지 형식이 일치하지 않습니다.');
  }
  return { base64, mimeType };
}

function parseCreateInput(value: unknown): CreateCapsuleInput {
  if (!isRecord(value)) rejectInput('캡슐 정보가 필요합니다.');
  const title = boundedText(value.title, '캡슐 이름', 80);
  const placeName = boundedText(value.placeName, '장소 이름', 120);
  const unlockAfterSeconds = value.unlockAfterSeconds;
  if (
    !finiteNumber(unlockAfterSeconds) ||
    !Number.isInteger(unlockAfterSeconds) ||
    unlockAfterSeconds < 15 ||
    unlockAfterSeconds > MAX_UNLOCK_SECONDS
  ) {
    rejectInput('개봉 시간은 15초부터 1년 사이로 설정해 주세요.');
  }
  if (!isRecord(value.content) || typeof value.content.letter !== 'string') {
    rejectInput('편지 내용이 올바르지 않습니다.');
  }
  if (value.content.letter.length > 10_000) rejectInput('편지는 10,000자 이하로 작성해 주세요.');
  const photo = parsePhoto(value.content.photo);
  const audio = parseMedia(value.content.audio, 'audio', rejectInput);
  const video = parseMedia(value.content.video, 'video', rejectInput);
  if (!value.content.letter.trim() && !photo && !audio && !video) rejectInput('편지, 사진, 음성 또는 영상을 하나 이상 넣어 주세요.');
  return {
    title,
    placeName,
    unlockAfterSeconds,
    location: parseLocation(value.location),
    content: { letter: value.content.letter, photo, ...(audio ? { audio } : {}), ...(video ? { video } : {}) },
  };
}

function createRequestKey(request: IncomingMessage): string | null {
  const key = request.headers['idempotency-key'];
  if (key === undefined) return null;
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    rejectInput('봉인 요청 식별자가 올바르지 않습니다.');
  }
  return key;
}

function createRequestHash(input: CreateCapsuleInput): string {
  // A retry may have a newer GPS fix. The first successful burial keeps its
  // original place/time; only the immutable user-authored payload must match.
  return createHash('sha256').update(JSON.stringify({
    title: input.title,
    placeName: input.placeName,
    unlockAfterSeconds: input.unlockAfterSeconds,
    // Omit absent new fields so pre-media requests keep their original hash.
    content: {
      letter: input.content.letter,
      photo: input.content.photo,
      ...(input.content.audio ? { audio: input.content.audio } : {}),
      ...(input.content.video ? { video: input.content.video } : {}),
    },
  })).digest('hex');
}

export function distanceMeters(a: Pick<LocationFix, 'latitude' | 'longitude'>, b: Pick<LocationFix, 'latitude' | 'longitude'>): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = radians(b.latitude - a.latitude);
  const deltaLongitude = radians(b.longitude - a.longitude);
  const haversine = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(Math.min(1, haversine)), Math.sqrt(Math.max(0, 1 - haversine)));
}

function locationGate(location: LocationFix, now: number): Eligibility['code'] | null {
  if (location.mocked) return 'MOCKED_LOCATION';
  if (now - location.timestamp > MAX_LOCATION_AGE_MS || location.timestamp - now > MAX_LOCATION_FUTURE_MS) {
    return 'STALE_LOCATION';
  }
  if (location.accuracy > MAX_LOCATION_ACCURACY_METERS) return 'INACCURATE_LOCATION';
  return null;
}

const GATE_MESSAGES: Record<Exclude<Eligibility['code'], 'READY'>, string> = {
  TOO_EARLY: '아직 개봉 시간이 되지 않았어요.',
  TOO_FAR: '캡슐을 묻은 장소의 50m 안으로 돌아와 주세요.',
  INACCURATE_LOCATION: '위치 오차가 커요. 하늘이 보이는 곳에서 정확한 위치를 다시 확인해 주세요.',
  STALE_LOCATION: '위치를 다시 측정해 주세요. 계속 실패하면 휴대폰의 날짜와 시간을 자동으로 설정해 주세요.',
  MOCKED_LOCATION: '모의 위치로는 캡슐을 묻거나 열 수 없어요.',
};

function summary(row: CapsuleMetadataRow): CapsuleSummary {
  // Deliberately enumerate public fields: never spread a database row here.
  return {
    id: row.id,
    title: row.title,
    placeName: row.place_name,
    createdAt: new Date(row.created_at).toISOString(),
    opensAt: new Date(row.opens_at).toISOString(),
    openedAt: row.opened_at === null ? null : new Date(row.opened_at).toISOString(),
    latitude: row.latitude,
    longitude: row.longitude,
    radiusMeters: row.radius_meters,
    hasPhoto: row.has_photo === 1,
    hasAudio: row.has_audio === 1,
    hasVideo: row.has_video === 1,
  };
}

function eligibility(row: CapsuleMetadataRow, location: LocationFix, now: number): Eligibility {
  const distance = distanceMeters(location, row);
  const remainingSeconds = Math.max(0, Math.ceil((row.opens_at - now) / 1_000));
  const code = locationGate(location, now)
    ?? (now < row.opens_at ? 'TOO_EARLY' : distance > row.radius_meters ? 'TOO_FAR' : 'READY');
  return {
    eligible: code === 'READY',
    code,
    distanceMeters: Math.round(distance * 10) / 10,
    radiusMeters: row.radius_meters,
    remainingSeconds,
    serverNow: new Date(now).toISOString(),
  };
}

function readJson(request: IncomingMessage, maxBytes = 100_000): Promise<unknown> {
  if (!JSON_CONTENT_TYPE.test(request.headers['content-type'] ?? '')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'application/json 요청이 필요합니다.');
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        settled = true;
        chunks.length = 0;
        reject(new ApiError(413, 'PAYLOAD_TOO_LARGE', '요청이 너무 커요. 사진 4MB, 음성 10MB, 영상 25MB 이하로 넣어 주세요.'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new ApiError(400, 'INVALID_JSON', 'JSON 요청을 읽을 수 없습니다.'));
      }
    });
    request.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    request.on('aborted', () => {
      if (settled) return;
      settled = true;
      reject(new ApiError(400, 'REQUEST_ABORTED', '요청이 중단되었습니다.'));
    });
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

export type CapsuleServerOptions = {
  databasePath: string;
  now?: () => number;
  onError?: (error: unknown) => void;
};

export function createCapsuleServer({ databasePath, now = Date.now, onError = console.error }: CapsuleServerOptions) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(databasePath);
  if (databasePath !== ':memory:') chmodSync(databasePath, 0o600);
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = DELETE;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS capsules (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES sessions(id),
      title TEXT NOT NULL,
      place_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      opens_at INTEGER NOT NULL,
      opened_at INTEGER,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius_meters REAL NOT NULL,
      letter TEXT NOT NULL,
      photo_base64 TEXT,
      photo_mime_type TEXT
    );
    CREATE INDEX IF NOT EXISTS capsules_owner_created ON capsules(owner_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS creation_requests (
      owner_id TEXT NOT NULL REFERENCES sessions(id),
      request_key TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      capsule_id TEXT NOT NULL REFERENCES capsules(id),
      PRIMARY KEY (owner_id, request_key)
    );
  `);

  // Nullable additive migration preserves all existing capsules, sessions and
  // idempotency keys. A transaction makes partially applied upgrades atomic.
  const columns = new Set((database.prepare('PRAGMA table_info(capsules)').all() as { name: string }[]).map(column => column.name));
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const column of ['audio_base64', 'audio_mime_type', 'audio_file_name', 'video_base64', 'video_mime_type', 'video_file_name']) {
      if (!columns.has(column)) database.exec(`ALTER TABLE capsules ADD COLUMN ${column} TEXT`);
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    database.close();
    throw error;
  }

  function owner(request: IncomingMessage): string {
    const authorization = request.headers.authorization;
    if (!authorization || !/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization)) {
      throw new ApiError(401, 'UNAUTHORIZED', '기기 인증이 필요합니다. 다시 연결해 주세요.');
    }
    const tokenHash = createHash('sha256').update(authorization.slice(7)).digest('hex');
    const session = database.prepare('SELECT id FROM sessions WHERE token_hash = ?').get(tokenHash) as { id: string } | undefined;
    if (!session) throw new ApiError(401, 'UNAUTHORIZED', '기기 인증이 만료되었거나 올바르지 않습니다.');
    return session.id;
  }

  function ownedCapsule(id: string, ownerId: string): CapsuleMetadataRow {
    const capsule = database.prepare(`SELECT ${METADATA_COLUMNS} FROM capsules WHERE id = ? AND owner_id = ?`)
      .get(id, ownerId) as CapsuleMetadataRow | undefined;
    if (!capsule) throw new ApiError(404, 'NOT_FOUND', '캡슐을 찾을 수 없습니다.');
    return capsule;
  }

  const server = createServer(async (request, response) => {
    const receivedAt = now();
    try {
      const origin = request.headers.origin;
      if (origin) {
        if (!LOCAL_ORIGIN.test(origin)) throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', '이 서버는 로컬 개발용입니다.');
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
      }
      if (request.method === 'OPTIONS') return respond(response, 204);
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;

      if (request.method === 'GET' && pathname === '/health') {
        return respond(response, 200, { ok: true, serverNow: new Date(now()).toISOString() });
      }
      if (request.method === 'POST' && pathname === '/sessions') {
        const token = randomBytes(32).toString('base64url');
        database.prepare('INSERT INTO sessions (id, token_hash, created_at) VALUES (?, ?, ?)')
          .run(randomUUID(), createHash('sha256').update(token).digest('hex'), now());
        return respond(response, 201, { token });
      }

      const ownerId = owner(request);
      const recoveryRoute = /^\/capsules\/by-request\/([A-Za-z0-9_-]{16,128})$/.exec(pathname);
      if (request.method === 'GET' && recoveryRoute) {
        const previous = database.prepare('SELECT capsule_id FROM creation_requests WHERE owner_id = ? AND request_key = ?')
          .get(ownerId, recoveryRoute[1]) as { capsule_id: string } | undefined;
        if (!previous) throw new ApiError(404, 'NOT_FOUND', '이 봉인 요청으로 저장한 캡슐을 아직 찾지 못했어요.');
        return respond(response, 200, { capsule: summary(ownedCapsule(previous.capsule_id, ownerId)), serverNow: new Date(now()).toISOString() });
      }
      if (request.method === 'GET' && pathname === '/capsules') {
        const rows = database.prepare(`SELECT ${METADATA_COLUMNS} FROM capsules WHERE owner_id = ? ORDER BY created_at DESC, id ASC`)
          .all(ownerId) as CapsuleMetadataRow[];
        return respond(response, 200, { capsules: rows.map(summary), serverNow: new Date(now()).toISOString() });
      }
      if (request.method === 'POST' && pathname === '/capsules') {
        const requestKey = createRequestKey(request);
        const input = parseCreateInput(await readJson(request, MAX_REQUEST_BYTES));
        const currentTime = now();
        const requestHash = requestKey ? createRequestHash(input) : null;
        if (requestKey) {
          const previous = database.prepare('SELECT request_hash, capsule_id FROM creation_requests WHERE owner_id = ? AND request_key = ?')
            .get(ownerId, requestKey) as { request_hash: string; capsule_id: string } | undefined;
          if (previous) {
            if (previous.request_hash !== requestHash) {
              throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', '이미 봉인한 요청의 내용은 바꿀 수 없어요. 기존 캡슐을 확인해 주세요.');
            }
            // This only returns metadata for a completed operation. It does not
            // bury again or grant content access, even if the GPS fix is old.
            return respond(response, 200, { capsule: summary(ownedCapsule(previous.capsule_id, ownerId)), serverNow: new Date(currentTime).toISOString() });
          }
        }
        // Uploads can take longer than GPS freshness. Check the burial fix at
        // request arrival; the immutable seal/opening times use actual commit
        // time. Opening requests still validate freshness at evaluation time.
        const locationFailure = locationGate(input.location, receivedAt);
        if (locationFailure && locationFailure !== 'READY') {
          throw new ApiError(403, locationFailure, GATE_MESSAGES[locationFailure]);
        }
        const id = randomUUID();
        database.exec('BEGIN IMMEDIATE');
        try {
          database.prepare(`INSERT INTO capsules
            (id, owner_id, title, place_name, created_at, opens_at, latitude, longitude, radius_meters, letter, photo_base64, photo_mime_type,
              audio_base64, audio_mime_type, audio_file_name, video_base64, video_mime_type, video_file_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, ownerId, input.title, input.placeName, currentTime,
              currentTime + input.unlockAfterSeconds * 1_000, input.location.latitude,
              input.location.longitude, CAPSULE_RADIUS_METERS, input.content.letter,
              input.content.photo?.base64 ?? null, input.content.photo?.mimeType ?? null,
              input.content.audio?.base64 ?? null, input.content.audio?.mimeType ?? null, input.content.audio?.fileName ?? null,
              input.content.video?.base64 ?? null, input.content.video?.mimeType ?? null, input.content.video?.fileName ?? null);
          if (requestKey) {
            database.prepare('INSERT INTO creation_requests (owner_id, request_key, request_hash, capsule_id) VALUES (?, ?, ?, ?)')
              .run(ownerId, requestKey, requestHash!, id);
          }
          database.exec('COMMIT');
        } catch (error) {
          database.exec('ROLLBACK');
          throw error;
        }
        return respond(response, 201, { capsule: summary(ownedCapsule(id, ownerId)), serverNow: new Date(currentTime).toISOString() });
      }

      const route = /^\/capsules\/([a-f0-9-]{36})\/(eligibility|open)$/.exec(pathname);
      if (request.method === 'POST' && route) {
        // Scope by owner before evaluating or parsing anything capsule-specific.
        const capsule = ownedCapsule(route[1], ownerId);
        const body = await readJson(request);
        if (!isRecord(body)) rejectInput('현재 위치가 필요합니다.');
        const location = parseLocation(body.location);
        const currentTime = now();
        const gate = eligibility(capsule, location, currentTime);
        if (route[2] === 'eligibility') return respond(response, 200, gate);
        if (!gate.eligible && gate.code !== 'READY') {
          throw new ApiError(403, gate.code, GATE_MESSAGES[gate.code], gate);
        }
        // Opening once does not waive time/location checks on later requests.
        if (capsule.opened_at === null) {
          database.prepare('UPDATE capsules SET opened_at = ? WHERE id = ? AND opened_at IS NULL')
            .run(currentTime, capsule.id);
        }
        const opened = ownedCapsule(capsule.id, ownerId);
        const stored = database.prepare(`SELECT letter, photo_base64, photo_mime_type,
          audio_base64, audio_mime_type, audio_file_name, video_base64, video_mime_type, video_file_name
          FROM capsules WHERE id = ? AND owner_id = ?`).get(capsule.id, ownerId) as CapsuleContentRow;
        const content: CapsuleContent = {
          letter: stored.letter,
          photo: stored.photo_base64 && stored.photo_mime_type
            ? { base64: stored.photo_base64, mimeType: stored.photo_mime_type }
            : null,
          ...(stored.audio_base64 && stored.audio_mime_type && stored.audio_file_name
            ? { audio: { base64: stored.audio_base64, mimeType: stored.audio_mime_type, fileName: stored.audio_file_name } }
            : {}),
          ...(stored.video_base64 && stored.video_mime_type && stored.video_file_name
            ? { video: { base64: stored.video_base64, mimeType: stored.video_mime_type, fileName: stored.video_file_name } }
            : {}),
        };
        return respond(response, 200, { capsule: summary(opened), content, serverNow: new Date(currentTime).toISOString() });
      }

      throw new ApiError(404, 'NOT_FOUND', '지원하지 않는 요청입니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        const body: ApiErrorBody = { error: { code: error.code, message: error.message } };
        if (error.eligibility) body.eligibility = error.eligibility;
        respond(response, error.status, body);
      } else {
        onError(error);
        respond(response, 500, { error: { code: 'INTERNAL_ERROR', message: '서버에서 요청을 처리하지 못했습니다.' } });
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
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
      database.close();
    },
  };
}
