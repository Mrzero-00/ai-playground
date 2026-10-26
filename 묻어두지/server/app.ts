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
  MAX_GROUP_MEMBERS,
  ATTENDANCE_TTL_MS,
  type CapsuleGroup,
  type AttendanceStatus,
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
  group_id: string | null;
  participant_count: number;
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
  video_base64 IS NOT NULL AS has_video, group_id,
  COALESCE((SELECT expected_count FROM capsule_groups WHERE id = capsules.group_id), 1) AS participant_count`;

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
  const groupId = value.groupId;
  if (groupId !== undefined && (typeof groupId !== 'string' || !/^[a-f0-9-]{36}$/.test(groupId))) rejectInput('공동 캡슐 모임을 확인해 주세요.');
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
    ...(groupId ? { groupId: groupId as string } : {}),
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
    ...(input.groupId ? { groupId: input.groupId } : {}),
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
  WAITING_PARTICIPANTS: '참여자 전원이 이 장소에서 함께 열기에 참여해야 해요.',
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
    groupId: row.group_id,
    participantCount: row.participant_count,
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
    CREATE TABLE IF NOT EXISTS capsule_groups (
      id TEXT PRIMARY KEY,
      host_id TEXT NOT NULL REFERENCES sessions(id),
      title TEXT NOT NULL,
      expected_count INTEGER NOT NULL CHECK(expected_count BETWEEN 2 AND 20),
      invite_code TEXT NOT NULL UNIQUE,
      capsule_id TEXT UNIQUE REFERENCES capsules(id),
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT NOT NULL UNIQUE,
      group_id TEXT NOT NULL REFERENCES capsule_groups(id),
      session_id TEXT NOT NULL REFERENCES sessions(id),
      display_name TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (group_id, session_id),
      UNIQUE (group_id, display_name)
    );
    CREATE INDEX IF NOT EXISTS group_members_session ON group_members(session_id);
  `);

  // Nullable additive migration preserves all existing capsules, sessions and
  // idempotency keys. A transaction makes partially applied upgrades atomic.
  const columns = new Set((database.prepare('PRAGMA table_info(capsules)').all() as { name: string }[]).map(column => column.name));
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const column of ['audio_base64', 'audio_mime_type', 'audio_file_name', 'video_base64', 'video_mime_type', 'video_file_name']) {
      if (!columns.has(column)) database.exec(`ALTER TABLE capsules ADD COLUMN ${column} TEXT`);
    }
    if (!columns.has('group_id')) database.exec('ALTER TABLE capsules ADD COLUMN group_id TEXT REFERENCES capsule_groups(id)');
    database.exec('CREATE UNIQUE INDEX IF NOT EXISTS capsules_group ON capsules(group_id) WHERE group_id IS NOT NULL');
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
    const capsule = database.prepare(`SELECT ${METADATA_COLUMNS} FROM capsules WHERE id = ? AND
      (owner_id = ? OR EXISTS (SELECT 1 FROM group_members WHERE group_id = capsules.group_id AND session_id = ?))`)
      .get(id, ownerId, ownerId) as CapsuleMetadataRow | undefined;
    if (!capsule) throw new ApiError(404, 'NOT_FOUND', '캡슐을 찾을 수 없습니다.');
    return capsule;
  }

  type GroupRow = { id: string; host_id: string; title: string; expected_count: number; invite_code: string; capsule_id: string | null };
  type MemberRow = { id: string; session_id: string; display_name: string };
  const membersOf = (groupId: string) => database.prepare('SELECT id, session_id, display_name FROM group_members WHERE group_id = ? ORDER BY joined_at, id').all(groupId) as MemberRow[];
  function groupForMember(id: string, sessionId: string): GroupRow {
    const row = database.prepare(`SELECT * FROM capsule_groups WHERE id = ? AND EXISTS
      (SELECT 1 FROM group_members WHERE group_id = capsule_groups.id AND session_id = ?)`)
      .get(id, sessionId) as GroupRow | undefined;
    if (!row) throw new ApiError(404, 'NOT_FOUND', '참여한 모임을 찾을 수 없어요.');
    return row;
  }
  function groupSummary(row: GroupRow, sessionId: string): CapsuleGroup {
    return { id: row.id, title: row.title, expectedCount: row.expected_count, isHost: row.host_id === sessionId,
      inviteCode: row.capsule_id ? null : row.invite_code, capsuleId: row.capsule_id,
      members: membersOf(row.id).map(m => ({ id: m.id, name: m.display_name, isMe: m.session_id === sessionId })) };
  }

  // Ephemeral leases: raw attendance coordinates never enter SQLite or public
  // responses. Restarting the server requires everybody to check in again.
  type Presence = { token: string; location: LocationFix; seenAt: number; sequence: number };
  const presence = new Map<string, Presence>();
  const presenceKey = (capsuleId: string, sessionId: string) => `${capsuleId}:${sessionId}`;
  function attendance(capsule: CapsuleMetadataRow, sessionId: string, currentTime: number): AttendanceStatus {
    const members = membersOf(capsule.group_id!).map(member => {
      const p = presence.get(presenceKey(capsule.id, member.session_id));
      const present = !!p && currentTime >= p.seenAt && currentTime - p.seenAt < ATTENDANCE_TTL_MS
        && !locationGate(p.location, currentTime) && distanceMeters(p.location, capsule) <= capsule.radius_meters;
      return { id: member.id, name: member.display_name, isMe: member.session_id === sessionId, present };
    });
    return { requiredCount: capsule.participant_count, presentCount: members.filter(m => m.present).length,
      validForSeconds: ATTENDANCE_TTL_MS / 1000, members };
  }
  function fullGate(capsule: CapsuleMetadataRow, location: LocationFix, sessionId: string, currentTime: number): Eligibility {
    const gate = eligibility(capsule, location, currentTime);
    if (!capsule.group_id) return gate;
    const status = attendance(capsule, sessionId, currentTime);
    return { ...gate, attendance: status,
      ...(gate.eligible && (status.presentCount !== status.requiredCount || status.members.length !== status.requiredCount)
        ? { code: 'WAITING_PARTICIPANTS' as const, eligible: false } : {}) };
  }
  function currentLease(capsuleId: string, sessionId: string, token: unknown): Presence {
    const p = presence.get(presenceKey(capsuleId, sessionId));
    if (!p || typeof token !== 'string' || p.token !== token) {
      throw new ApiError(409, 'ATTENDANCE_EXPIRED', '함께 열기 참여가 끝났어요. 다시 참여해 주세요.');
    }
    return p;
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
      if (request.method === 'GET' && pathname === '/groups') {
        const rows = database.prepare(`SELECT * FROM capsule_groups WHERE EXISTS
          (SELECT 1 FROM group_members WHERE group_id = capsule_groups.id AND session_id = ?) ORDER BY created_at DESC, id`)
          .all(ownerId) as GroupRow[];
        return respond(response, 200, { groups: rows.map(row => groupSummary(row, ownerId)), serverNow: new Date(now()).toISOString() });
      }
      if (request.method === 'POST' && pathname === '/groups') {
        const body = await readJson(request);
        if (!isRecord(body)) rejectInput('모임 정보가 필요해요.');
        const title = boundedText(body.title, '모임 이름', 80);
        const displayName = boundedText(body.displayName, '내 이름', 24);
        const count = body.expectedCount;
        if (!finiteNumber(count) || !Number.isInteger(count) || count < 2 || count > MAX_GROUP_MEMBERS) {
          rejectInput(`함께 열 사람은 본인을 포함해 2~${MAX_GROUP_MEMBERS}명으로 정해 주세요.`);
        }
        const id = randomUUID();
        database.exec('BEGIN IMMEDIATE');
        try {
          database.prepare('INSERT INTO capsule_groups(id, host_id, title, expected_count, invite_code, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(id, ownerId, title, count, randomBytes(6).toString('hex').toUpperCase(), now());
          database.prepare('INSERT INTO group_members(id, group_id, session_id, display_name, joined_at) VALUES (?, ?, ?, ?, ?)')
            .run(randomUUID(), id, ownerId, displayName, now());
          database.exec('COMMIT');
        } catch (error) { database.exec('ROLLBACK'); throw error; }
        return respond(response, 201, { group: groupSummary(groupForMember(id, ownerId), ownerId), serverNow: new Date(now()).toISOString() });
      }
      if (request.method === 'POST' && pathname === '/groups/join') {
        const body = await readJson(request);
        if (!isRecord(body)) rejectInput('초대 코드와 이름을 입력해 주세요.');
        const code = boundedText(body.inviteCode, '초대 코드', 12).toUpperCase();
        const displayName = boundedText(body.displayName, '내 이름', 24);
        const row = database.prepare('SELECT * FROM capsule_groups WHERE invite_code = ?').get(code) as GroupRow | undefined;
        if (!row) throw new ApiError(404, 'NOT_FOUND', '참여 가능한 초대 코드를 찾을 수 없어요.');
        const members = membersOf(row.id);
        if (members.some(m => m.session_id === ownerId)) {
          return respond(response, 200, { group: groupSummary(row, ownerId), serverNow: new Date(now()).toISOString() });
        }
        if (row.capsule_id) throw new ApiError(409, 'GROUP_SEALED', '이미 봉인된 캡슐의 참여자는 바꿀 수 없어요.');
        if (members.length >= row.expected_count) throw new ApiError(409, 'GROUP_FULL', '정해진 인원이 모두 참여했어요.');
        if (members.some(m => m.display_name === displayName)) throw new ApiError(409, 'NAME_TAKEN', '모임에서 구별할 수 있는 다른 이름을 입력해 주세요.');
        // No await between the capacity check and insert: this synchronous
        // SQLite operation is serialized with sealing and other joins.
        database.prepare('INSERT INTO group_members(id, group_id, session_id, display_name, joined_at) VALUES (?, ?, ?, ?, ?)')
          .run(randomUUID(), row.id, ownerId, displayName, now());
        return respond(response, 200, { group: groupSummary(row, ownerId), serverNow: new Date(now()).toISOString() });
      }
      const recoveryRoute = /^\/capsules\/by-request\/([A-Za-z0-9_-]{16,128})$/.exec(pathname);
      if (request.method === 'GET' && recoveryRoute) {
        const previous = database.prepare('SELECT capsule_id FROM creation_requests WHERE owner_id = ? AND request_key = ?')
          .get(ownerId, recoveryRoute[1]) as { capsule_id: string } | undefined;
        if (!previous) throw new ApiError(404, 'NOT_FOUND', '이 봉인 요청으로 저장한 캡슐을 아직 찾지 못했어요.');
        return respond(response, 200, { capsule: summary(ownedCapsule(previous.capsule_id, ownerId)), serverNow: new Date(now()).toISOString() });
      }
      if (request.method === 'GET' && pathname === '/capsules') {
        const rows = database.prepare(`SELECT ${METADATA_COLUMNS} FROM capsules WHERE owner_id = ? OR EXISTS
          (SELECT 1 FROM group_members WHERE group_id = capsules.group_id AND session_id = ?) ORDER BY created_at DESC, id ASC`)
          .all(ownerId, ownerId) as CapsuleMetadataRow[];
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
          if (input.groupId) {
            const group = groupForMember(input.groupId, ownerId);
            if (group.host_id !== ownerId) throw new ApiError(403, 'HOST_REQUIRED', '모임을 만든 사람만 내용을 담고 봉인할 수 있어요.');
            if (group.capsule_id) throw new ApiError(409, 'GROUP_SEALED', '이 모임은 이미 캡슐을 봉인했어요.');
            if (membersOf(group.id).length !== group.expected_count) throw new ApiError(409, 'GROUP_INCOMPLETE', '초대한 인원이 모두 참여한 뒤 봉인해 주세요.');
          }
          database.prepare(`INSERT INTO capsules
            (id, owner_id, title, place_name, created_at, opens_at, latitude, longitude, radius_meters, letter, photo_base64, photo_mime_type,
              audio_base64, audio_mime_type, audio_file_name, video_base64, video_mime_type, video_file_name, group_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, ownerId, input.title, input.placeName, currentTime,
              currentTime + input.unlockAfterSeconds * 1_000, input.location.latitude,
              input.location.longitude, CAPSULE_RADIUS_METERS, input.content.letter,
              input.content.photo?.base64 ?? null, input.content.photo?.mimeType ?? null,
              input.content.audio?.base64 ?? null, input.content.audio?.mimeType ?? null, input.content.audio?.fileName ?? null,
              input.content.video?.base64 ?? null, input.content.video?.mimeType ?? null, input.content.video?.fileName ?? null, input.groupId ?? null);
          if (input.groupId) database.prepare('UPDATE capsule_groups SET capsule_id = ? WHERE id = ?').run(id, input.groupId);
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

      const attendanceRoute = /^\/capsules\/([a-f0-9-]{36})\/attendance\/(start|heartbeat|leave)$/.exec(pathname);
      if (request.method === 'POST' && attendanceRoute) {
        const capsule = ownedCapsule(attendanceRoute[1], ownerId);
        if (!capsule.group_id) throw new ApiError(400, 'PERSONAL_CAPSULE', '개인 캡슐에는 참석 확인이 필요하지 않아요.');
        const body = await readJson(request);
        if (!isRecord(body)) rejectInput('참석 확인 정보가 필요해요.');
        const key = presenceKey(capsule.id, ownerId);
        if (attendanceRoute[2] === 'leave') {
          // An old screen must not revoke a newer screen's attendance lease.
          if (presence.get(key)?.token === body.attendanceToken) presence.delete(key);
          return respond(response, 200, { ok: true });
        }
        const previous = attendanceRoute[2] === 'heartbeat' ? currentLease(capsule.id, ownerId, body.attendanceToken) : undefined;
        const sequence = body.sequence;
        if (previous && (!finiteNumber(sequence) || !Number.isSafeInteger(sequence) || sequence <= previous.sequence)) {
          throw new ApiError(409, 'ATTENDANCE_OUTDATED', '이전 참석 확인 요청이에요.');
        }
        let location: LocationFix;
        try { location = parseLocation(body.location); }
        catch (error) { presence.delete(key); throw error; }
        const currentTime = now();
        const locationFailure = locationGate(location, currentTime);
        if (locationFailure || distanceMeters(location, capsule) > capsule.radius_meters) {
          presence.delete(key);
          const gate = fullGate(capsule, location, ownerId, currentTime);
          const code = locationFailure ?? 'TOO_FAR';
          throw new ApiError(403, code, GATE_MESSAGES[code as Exclude<Eligibility['code'], 'READY'>], { ...gate, eligible: false, code });
        }
        const entry: Presence = { token: previous?.token ?? randomBytes(24).toString('base64url'), location, seenAt: currentTime, sequence: previous ? sequence as number : 0 };
        presence.set(key, entry);
        return respond(response, 200, { attendanceToken: entry.token, eligibility: fullGate(capsule, location, ownerId, currentTime) });
      }

      const route = /^\/capsules\/([a-f0-9-]{36})\/(eligibility|open)$/.exec(pathname);
      if (request.method === 'POST' && route) {
        // Scope by owner before evaluating or parsing anything capsule-specific.
        const capsule = ownedCapsule(route[1], ownerId);
        const body = await readJson(request);
        if (!isRecord(body)) rejectInput('현재 위치가 필요합니다.');
        let location: LocationFix;
        try { location = parseLocation(body.location); }
        catch (error) { if (capsule.group_id) presence.delete(presenceKey(capsule.id, ownerId)); throw error; }
        const currentTime = now();
        if (route[2] === 'open' && capsule.group_id) {
          currentLease(capsule.id, ownerId, body.attendanceToken);
        }
        if (capsule.group_id && (locationGate(location, currentTime) || distanceMeters(location, capsule) > capsule.radius_meters)) {
          // A newly reported departure invalidates the caller's old check-in
          // immediately, including when reported via /open or /eligibility.
          presence.delete(presenceKey(capsule.id, ownerId));
        }
        const gate = fullGate(capsule, location, ownerId, currentTime);
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
          FROM capsules WHERE id = ?`).get(capsule.id) as CapsuleContentRow;
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
