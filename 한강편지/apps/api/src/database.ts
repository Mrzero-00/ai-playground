import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
} from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { AppError } from './errors.js';
import { distanceMeters } from './geo.js';
import type {
  ClaimResult,
  Coordinates,
  FoundLetter,
  MoodTag,
  ParkSummary,
  RuntimeSettings,
  ScanResult,
  UserLetter,
} from './types.js';

interface ParkSeed {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  accent: string;
  points: Array<[number, number]>;
}

const PARKS: ParkSeed[] = [
  {
    id: 'yeouido',
    name: '여의도한강공원',
    latitude: 37.5283,
    longitude: 126.9326,
    accent: '#5B8FF9',
    points: [
      [37.52802, 126.93297],
      [37.52761, 126.93408],
      [37.52903, 126.93178],
    ],
  },
  {
    id: 'banpo',
    name: '반포한강공원',
    latitude: 37.5106,
    longitude: 126.9958,
    accent: '#9B7EDE',
    points: [
      [37.51122, 126.99502],
      [37.51041, 126.99674],
      [37.50992, 126.99493],
    ],
  },
  {
    id: 'ttukseom',
    name: '뚝섬한강공원',
    latitude: 37.5293,
    longitude: 127.0698,
    accent: '#48B6A3',
    points: [
      [37.52981, 127.06882],
      [37.52887, 127.07041],
      [37.53011, 127.07102],
    ],
  },
  {
    id: 'mangwon',
    name: '망원한강공원',
    latitude: 37.5524,
    longitude: 126.8998,
    accent: '#F39C6B',
    points: [
      [37.55188, 126.90039],
      [37.55302, 126.89917],
      [37.55209, 126.89891],
    ],
  },
  {
    id: 'jamsil',
    name: '잠실한강공원',
    latitude: 37.5177,
    longitude: 127.0865,
    accent: '#E676A0',
    points: [
      [37.51831, 127.08579],
      [37.51711, 127.08712],
      [37.51691, 127.08591],
    ],
  },
];

const SEED_LETTERS: Array<{ body: string; mood: MoodTag; parkId: string }> = [
  {
    body: '오늘 하루도 여기까지 온 것만으로 충분히 잘했어요. 강바람처럼 마음이 조금 가벼워지길 바라요.',
    mood: '위로',
    parkId: 'yeouido',
  },
  {
    body: '낯선 누군가에게 응원을 보냅니다. 망설이던 일이 있다면 아주 작은 한 걸음부터 시작해 봐요.',
    mood: '응원',
    parkId: 'banpo',
  },
  {
    body: '요즘 가장 고마웠던 순간은 평범한 저녁이었어요. 당신에게도 그런 조용한 행복이 있기를 바랍니다.',
    mood: '감사',
    parkId: 'ttukseom',
  },
  {
    body: '정답을 아직 몰라도 괜찮다고 스스로에게 말해 주는 중이에요. 이 편지를 줍는 분도 너무 서두르지 않았으면 해요.',
    mood: '고민',
    parkId: 'mangwon',
  },
  {
    body: '오늘 본 하늘은 유난히 맑았어요. 모르는 사람과도 이런 작은 장면을 나눌 수 있다는 게 좋네요.',
    mood: '일상',
    parkId: 'jamsil',
  },
];

type Row = Record<string, unknown>;

export class HangangDatabase {
  private readonly db: DatabaseSync;
  private readonly encryptionKey: Buffer;

  constructor(
    databasePath: string,
    private readonly settings: RuntimeSettings,
    encryptionSecret = process.env.LETTER_ENCRYPTION_KEY ?? 'hangang-letter-local-development-key',
  ) {
    if (databasePath !== ':memory:') {
      mkdirSync(dirname(databasePath), { recursive: true });
    }
    this.db = new DatabaseSync(databasePath);
    this.encryptionKey = createHash('sha256').update(encryptionSecret).digest();
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.initialize();
  }

  close(): void {
    this.db.close();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS parks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accent TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        operating_note TEXT NOT NULL DEFAULT '일출 후부터 공원 운영 종료 전까지 탐색할 수 있어요.',
        inventory_cap INTEGER NOT NULL DEFAULT 20,
        search_points_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS letters (
        id TEXT PRIMARY KEY,
        sender_user_id TEXT NOT NULL REFERENCES users(id),
        body_ciphertext TEXT NOT NULL,
        body_length INTEGER NOT NULL,
        mood_tag TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        drift_ends_at TEXT,
        first_landed_at TEXT,
        current_landing_sequence INTEGER NOT NULL DEFAULT 0,
        claimed_by_user_id TEXT REFERENCES users(id),
        claimed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS letter_landings (
        id TEXT PRIMARY KEY,
        letter_id TEXT NOT NULL REFERENCES letters(id),
        sequence INTEGER NOT NULL,
        park_id TEXT NOT NULL REFERENCES parks(id),
        target_latitude REAL NOT NULL,
        target_longitude REAL NOT NULL,
        claim_radius_m INTEGER NOT NULL DEFAULT 40,
        landed_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        status TEXT NOT NULL,
        UNIQUE(letter_id, sequence)
      );

      CREATE TABLE IF NOT EXISTS hunts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        park_id TEXT NOT NULL REFERENCES parks(id),
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        detected_landing_id TEXT REFERENCES letter_landings(id),
        claim_token_hash TEXT,
        claim_token_expires_at TEXT
      );

      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        letter_id TEXT NOT NULL UNIQUE REFERENCES letters(id),
        landing_id TEXT NOT NULL REFERENCES letter_landings(id),
        claimant_user_id TEXT NOT NULL REFERENCES users(id),
        claimed_at TEXT NOT NULL,
        accuracy_bucket TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        letter_id TEXT NOT NULL REFERENCES letters(id),
        reporter_user_id TEXT NOT NULL REFERENCES users(id),
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(letter_id, reporter_user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_letters_status_drift ON letters(status, drift_ends_at);
      CREATE INDEX IF NOT EXISTS idx_landings_park_status ON letter_landings(park_id, status, expires_at);
      CREATE INDEX IF NOT EXISTS idx_hunts_user_status ON hunts(user_id, status, expires_at);
    `);

    const insertPark = this.db.prepare(`
      INSERT OR IGNORE INTO parks
      (id, name, latitude, longitude, accent, search_points_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const park of PARKS) {
      insertPark.run(
        park.id,
        park.name,
        park.latitude,
        park.longitude,
        park.accent,
        JSON.stringify(park.points),
      );
    }

    this.seedLetters();
  }

  private seedLetters(): void {
    const count = this.db.prepare('SELECT COUNT(*) AS count FROM letters').get() as Row;
    if (Number(count.count) > 0) return;

    const now = new Date();
    const seedUserId = this.normalizeUserKey('seed-letter-writer');
    this.ensureUser(seedUserId, now.toISOString());

    for (const [index, seed] of SEED_LETTERS.entries()) {
      const id = randomUUID();
      const createdAt = new Date(now.getTime() - (index + 1) * 60_000).toISOString();
      this.db
        .prepare(`
          INSERT INTO letters
          (id, sender_user_id, body_ciphertext, body_length, mood_tag, status,
           created_at, drift_ends_at, current_landing_sequence)
          VALUES (?, ?, ?, ?, ?, 'DRIFTING', ?, ?, 0)
        `)
        .run(
          id,
          seedUserId,
          this.encrypt(seed.body),
          seed.body.length,
          seed.mood,
          createdAt,
          createdAt,
        );
      this.landLetter(id, 1, null, seed.parkId, now);
    }
  }

  normalizeUserKey(rawKey: string): string {
    if (!rawKey || rawKey.length > 512) {
      throw new AppError('INVALID_USER_KEY', '사용자 식별키가 올바르지 않아요.', 401);
    }
    return createHash('sha256').update(`hangang-letter:${rawKey}`).digest('hex');
  }

  ensureUser(userId: string, now = new Date().toISOString()): void {
    this.db.prepare('INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)').run(userId, now);
  }

  createLetter(userId: string, body: string, moodTag: MoodTag | null, now = new Date()): UserLetter {
    this.ensureUser(userId, now.toISOString());
    const id = randomUUID();
    const driftSeconds = randomInt(
      this.settings.driftMinSeconds,
      Math.max(this.settings.driftMinSeconds + 1, this.settings.driftMaxSeconds + 1),
    );
    const driftEndsAt = new Date(now.getTime() + driftSeconds * 1000).toISOString();
    this.db
      .prepare(`
        INSERT INTO letters
        (id, sender_user_id, body_ciphertext, body_length, mood_tag, status,
         created_at, drift_ends_at, current_landing_sequence)
        VALUES (?, ?, ?, ?, ?, 'DRIFTING', ?, ?, 0)
      `)
      .run(id, userId, this.encrypt(body), body.length, moodTag, now.toISOString(), driftEndsAt);
    return this.getUserLetter(userId, id);
  }

  listParks(now = new Date()): ParkSummary[] {
    this.runMaintenance(now);
    const rows = this.db
      .prepare(`
        SELECT p.id, p.name, p.latitude, p.longitude, p.accent, p.status,
               p.operating_note,
               COUNT(CASE WHEN ll.status = 'LANDED' AND l.status = 'LANDED' THEN 1 END) AS inventory_count
        FROM parks p
        LEFT JOIN letter_landings ll ON ll.park_id = p.id
        LEFT JOIN letters l ON l.id = ll.letter_id
        GROUP BY p.id
        ORDER BY CASE p.id
          WHEN 'mangwon' THEN 1 WHEN 'yeouido' THEN 2 WHEN 'banpo' THEN 3
          WHEN 'ttukseom' THEN 4 ELSE 5 END
      `)
      .all() as Row[];
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      accent: String(row.accent),
      status: row.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
      inventoryCount: Number(row.inventory_count),
      operatingNote: String(row.operating_note),
    }));
  }

  listUserLetters(userId: string, now = new Date()): UserLetter[] {
    this.runMaintenance(now);
    const rows = this.db
      .prepare(`
        SELECT l.*, p.name AS park_name
        FROM letters l
        LEFT JOIN letter_landings ll
          ON ll.letter_id = l.id AND ll.sequence = l.current_landing_sequence
        LEFT JOIN parks p ON p.id = ll.park_id
        WHERE l.sender_user_id = ?
        ORDER BY l.created_at DESC
      `)
      .all(userId) as Row[];
    return rows.map((row) => this.mapUserLetter(row));
  }

  listFoundLetters(userId: string): FoundLetter[] {
    const rows = this.db
      .prepare(`
        SELECT l.id, l.body_ciphertext, l.mood_tag, c.claimed_at, p.name AS park_name
        FROM claims c
        JOIN letters l ON l.id = c.letter_id
        JOIN letter_landings ll ON ll.id = c.landing_id
        JOIN parks p ON p.id = ll.park_id
        WHERE c.claimant_user_id = ? AND l.status IN ('CLAIMED', 'HIDDEN')
        ORDER BY c.claimed_at DESC
      `)
      .all(userId) as Row[];
    return rows.map((row) => this.mapFoundLetter(row));
  }

  startHunt(userId: string, parkId: string, now = new Date()): { huntId: string; expiresAt: string } {
    this.ensureUser(userId, now.toISOString());
    const park = this.db.prepare("SELECT id FROM parks WHERE id = ? AND status = 'ACTIVE'").get(parkId);
    if (!park) throw new AppError('PARK_PAUSED', '현재 이 공원에서는 탐색할 수 없어요.');

    this.db
      .prepare("UPDATE hunts SET status = 'ENDED' WHERE user_id = ? AND status = 'ACTIVE'")
      .run(userId);
    const huntId = randomUUID();
    const expiresAt = new Date(now.getTime() + 30 * 60_000).toISOString();
    this.db
      .prepare(`
        INSERT INTO hunts (id, user_id, park_id, status, created_at, expires_at)
        VALUES (?, ?, ?, 'ACTIVE', ?, ?)
      `)
      .run(huntId, userId, parkId, now.toISOString(), expiresAt);
    return { huntId, expiresAt };
  }

  scanHunt(
    userId: string,
    huntId: string,
    coordinates: Coordinates,
    simulate: boolean,
    now = new Date(),
  ): ScanResult {
    this.runMaintenance(now);
    const hunt = this.db
      .prepare(`
        SELECT h.*, p.latitude AS park_latitude, p.longitude AS park_longitude
        FROM hunts h JOIN parks p ON p.id = h.park_id
        WHERE h.id = ? AND h.user_id = ? AND h.status = 'ACTIVE'
      `)
      .get(huntId, userId) as Row | undefined;
    if (!hunt || String(hunt.expires_at) <= now.toISOString()) {
      throw new AppError('HUNT_EXPIRED', '탐색 시간이 끝났어요. 공원에서 다시 시작해 주세요.');
    }
    if (simulate && !this.settings.allowSimulatedLocation) {
      throw new AppError('SIMULATION_DISABLED', '운영 환경에서는 체험 위치를 사용할 수 없어요.', 403);
    }
    if (!simulate && coordinates.accuracy > 50) {
      return { detected: false, reason: 'LOCATION_ACCURACY_LOW' };
    }

    const parkDistance = distanceMeters(coordinates, {
      latitude: Number(hunt.park_latitude),
      longitude: Number(hunt.park_longitude),
    });
    if (!simulate && parkDistance > 1_500) {
      throw new AppError('OUTSIDE_PARK', '선택한 공원 안에서 탐색을 시작해 주세요.');
    }

    const candidates = this.db
      .prepare(`
        SELECT ll.*, l.sender_user_id
        FROM letter_landings ll
        JOIN letters l ON l.id = ll.letter_id
        WHERE ll.park_id = ? AND ll.status = 'LANDED' AND l.status = 'LANDED'
          AND l.sender_user_id <> ?
        ORDER BY ll.landed_at ASC
      `)
      .all(String(hunt.park_id), userId) as Row[];

    const detected = candidates.find((candidate) => {
      if (simulate) return true;
      const distance = distanceMeters(coordinates, {
        latitude: Number(candidate.target_latitude),
        longitude: Number(candidate.target_longitude),
      });
      return distance <= Number(candidate.claim_radius_m);
    });

    if (!detected) return { detected: false, reason: 'NO_LETTER_DETECTED' };

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const tokenExpiresAt = new Date(now.getTime() + 2 * 60_000).toISOString();
    this.db
      .prepare(`
        UPDATE hunts
        SET detected_landing_id = ?, claim_token_hash = ?, claim_token_expires_at = ?
        WHERE id = ?
      `)
      .run(String(detected.id), tokenHash, tokenExpiresAt, huntId);
    return {
      detected: true,
      claimToken: rawToken,
      tokenExpiresAt,
      visualSeed: this.visualSeed(String(detected.id)),
    };
  }

  claimLetter(
    userId: string,
    huntId: string,
    rawToken: string,
    accuracy: number,
    now = new Date(),
  ): ClaimResult {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const hunt = this.db
        .prepare(`
          SELECT h.*, ll.letter_id, ll.status AS landing_status, l.status AS letter_status,
                 l.sender_user_id
          FROM hunts h
          JOIN letter_landings ll ON ll.id = h.detected_landing_id
          JOIN letters l ON l.id = ll.letter_id
          WHERE h.id = ? AND h.user_id = ? AND h.status = 'ACTIVE'
        `)
        .get(huntId, userId) as Row | undefined;

      if (!hunt || hunt.claim_token_hash !== tokenHash) {
        throw new AppError('CLAIM_TOKEN_INVALID', '발견 인증이 만료되었어요. 다시 주변을 확인해 주세요.');
      }
      if (String(hunt.claim_token_expires_at) <= now.toISOString()) {
        throw new AppError('CLAIM_TOKEN_EXPIRED', '병을 줍는 시간이 지났어요. 다시 찾아 주세요.');
      }
      if (hunt.sender_user_id === userId) {
        throw new AppError('SELF_CLAIM_NOT_ALLOWED', '내가 띄운 편지는 직접 주울 수 없어요.');
      }
      if (hunt.landing_status !== 'LANDED' || hunt.letter_status !== 'LANDED') {
        throw new AppError('LETTER_ALREADY_CLAIMED', '조금 전 다른 사람이 먼저 편지를 발견했어요.', 409);
      }

      const claimedAt = now.toISOString();
      this.db
        .prepare(`
          INSERT INTO claims
          (id, letter_id, landing_id, claimant_user_id, claimed_at, accuracy_bucket)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          randomUUID(),
          String(hunt.letter_id),
          String(hunt.detected_landing_id),
          userId,
          claimedAt,
          accuracy <= 20 ? 'LTE_20M' : accuracy <= 50 ? 'LTE_50M' : 'SIMULATED',
        );
      this.db
        .prepare("UPDATE letters SET status = 'CLAIMED', claimed_by_user_id = ?, claimed_at = ? WHERE id = ?")
        .run(userId, claimedAt, String(hunt.letter_id));
      this.db
        .prepare("UPDATE letter_landings SET status = 'CLAIMED' WHERE id = ?")
        .run(String(hunt.detected_landing_id));
      this.db.prepare("UPDATE hunts SET status = 'CLAIMED' WHERE id = ?").run(huntId);
      this.db.exec('COMMIT');
      return { letter: this.getFoundLetter(userId, String(hunt.letter_id)) };
    } catch (error) {
      this.db.exec('ROLLBACK');
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : '';
      if (message.includes('UNIQUE constraint failed')) {
        throw new AppError('LETTER_ALREADY_CLAIMED', '조금 전 다른 사람이 먼저 편지를 발견했어요.', 409);
      }
      throw error;
    }
  }

  reportLetter(userId: string, letterId: string, reason: string, now = new Date()): void {
    const claim = this.db
      .prepare('SELECT 1 FROM claims WHERE letter_id = ? AND claimant_user_id = ?')
      .get(letterId, userId);
    if (!claim) throw new AppError('LETTER_NOT_FOUND', '획득한 편지만 신고할 수 있어요.', 404);
    this.db
      .prepare(`
        INSERT OR IGNORE INTO reports (id, letter_id, reporter_user_id, reason, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(randomUUID(), letterId, userId, reason.slice(0, 80), now.toISOString());
    this.db.prepare("UPDATE letters SET status = 'HIDDEN' WHERE id = ?").run(letterId);
  }

  runMaintenance(now = new Date()): void {
    const nowIso = now.toISOString();
    const drifting = this.db
      .prepare("SELECT id FROM letters WHERE status = 'DRIFTING' AND drift_ends_at <= ?")
      .all(nowIso) as Row[];
    for (const row of drifting) this.landLetter(String(row.id), 1, null, null, now);

    const expiredLandings = this.db
      .prepare(`
        SELECT ll.id, ll.letter_id, ll.park_id, ll.sequence
        FROM letter_landings ll
        JOIN letters l ON l.id = ll.letter_id
        WHERE ll.status = 'LANDED' AND l.status = 'LANDED' AND ll.expires_at <= ?
      `)
      .all(nowIso) as Row[];
    for (const landing of expiredLandings) {
      const sequence = Number(landing.sequence);
      if (sequence >= this.settings.maxLandingSequence) {
        this.db.prepare("UPDATE letter_landings SET status = 'EXPIRED' WHERE id = ?").run(String(landing.id));
        this.db.prepare("UPDATE letters SET status = 'EXPIRED' WHERE id = ?").run(String(landing.letter_id));
      } else {
        this.db.prepare("UPDATE letter_landings SET status = 'RELOCATED' WHERE id = ?").run(String(landing.id));
        this.db.prepare("UPDATE letters SET status = 'RELOCATING' WHERE id = ?").run(String(landing.letter_id));
        this.landLetter(
          String(landing.letter_id),
          sequence + 1,
          String(landing.park_id),
          null,
          now,
        );
      }
    }
  }

  private landLetter(
    letterId: string,
    sequence: number,
    excludedParkId: string | null,
    preferredParkId: string | null,
    now: Date,
  ): void {
    const parks = this.db
      .prepare(`
        SELECT p.*,
               COUNT(CASE WHEN ll.status = 'LANDED' THEN 1 END) AS inventory_count
        FROM parks p
        LEFT JOIN letter_landings ll ON ll.park_id = p.id
        WHERE p.status = 'ACTIVE'
        GROUP BY p.id
        HAVING inventory_count < p.inventory_cap
      `)
      .all() as Row[];
    const candidates = parks.filter((park) => park.id !== excludedParkId);
    if (candidates.length === 0) {
      this.db.prepare("UPDATE letters SET status = 'DRIFTING' WHERE id = ?").run(letterId);
      return;
    }
    const preferred = preferredParkId
      ? candidates.find((park) => park.id === preferredParkId)
      : undefined;
    const park = preferred ?? candidates[randomInt(candidates.length)];
    if (!park) throw new AppError('NO_ACTIVE_PARK', '현재 편지를 보낼 수 있는 공원이 없어요.', 503);
    const points = JSON.parse(String(park.search_points_json)) as Array<[number, number]>;
    const point = points[randomInt(points.length)];
    if (!point) throw new AppError('NO_SAFE_SEARCH_POINT', '안전한 탐색 지점을 찾지 못했어요.', 503);

    const landedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + this.settings.landingTtlSeconds * 1000).toISOString();
    this.db
      .prepare(`
        INSERT INTO letter_landings
        (id, letter_id, sequence, park_id, target_latitude, target_longitude,
         claim_radius_m, landed_at, expires_at, status)
        VALUES (?, ?, ?, ?, ?, ?, 40, ?, ?, 'LANDED')
      `)
      .run(randomUUID(), letterId, sequence, String(park.id), point[0], point[1], landedAt, expiresAt);
    this.db
      .prepare(`
        UPDATE letters
        SET status = 'LANDED', first_landed_at = COALESCE(first_landed_at, ?),
            current_landing_sequence = ?
        WHERE id = ?
      `)
      .run(landedAt, sequence, letterId);
  }

  private getUserLetter(userId: string, letterId: string): UserLetter {
    const row = this.db
      .prepare(`
        SELECT l.*, p.name AS park_name
        FROM letters l
        LEFT JOIN letter_landings ll
          ON ll.letter_id = l.id AND ll.sequence = l.current_landing_sequence
        LEFT JOIN parks p ON p.id = ll.park_id
        WHERE l.id = ? AND l.sender_user_id = ?
      `)
      .get(letterId, userId) as Row | undefined;
    if (!row) throw new AppError('LETTER_NOT_FOUND', '편지를 찾을 수 없어요.', 404);
    return this.mapUserLetter(row);
  }

  private getFoundLetter(userId: string, letterId: string): FoundLetter {
    const row = this.db
      .prepare(`
        SELECT l.id, l.body_ciphertext, l.mood_tag, c.claimed_at, p.name AS park_name
        FROM claims c
        JOIN letters l ON l.id = c.letter_id
        JOIN letter_landings ll ON ll.id = c.landing_id
        JOIN parks p ON p.id = ll.park_id
        WHERE c.claimant_user_id = ? AND l.id = ?
      `)
      .get(userId, letterId) as Row | undefined;
    if (!row) throw new AppError('LETTER_NOT_FOUND', '획득한 편지를 찾을 수 없어요.', 404);
    return this.mapFoundLetter(row);
  }

  private mapUserLetter(row: Row): UserLetter {
    return {
      id: String(row.id),
      bodyPreview: `${this.decrypt(String(row.body_ciphertext)).slice(0, 36)}${Number(row.body_length) > 36 ? '…' : ''}`,
      moodTag: (row.mood_tag as MoodTag | null) ?? null,
      status: row.status as UserLetter['status'],
      createdAt: String(row.created_at),
      driftEndsAt: row.drift_ends_at ? String(row.drift_ends_at) : null,
      parkName: row.park_name ? String(row.park_name) : null,
      landingSequence: Number(row.current_landing_sequence),
      claimedAt: row.claimed_at ? String(row.claimed_at) : null,
    };
  }

  private mapFoundLetter(row: Row): FoundLetter {
    return {
      id: String(row.id),
      body: this.decrypt(String(row.body_ciphertext)),
      moodTag: (row.mood_tag as MoodTag | null) ?? null,
      parkName: String(row.park_name),
      claimedAt: String(row.claimed_at),
    };
  }

  private encrypt(plainText: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  private decrypt(payload: string): string {
    const [ivValue, tagValue, encryptedValue] = payload.split('.');
    if (!ivValue || !tagValue || !encryptedValue) throw new Error('Invalid encrypted letter payload');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private visualSeed(value: string): number {
    return Number.parseInt(createHash('sha256').update(value).digest('hex').slice(0, 8), 16);
  }
}
