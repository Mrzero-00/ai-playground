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
  FoundFlyer,
  MoodTag,
  RegionSummary,
  RuntimeSettings,
  UserFlyer,
  WalletSummary,
} from './types.js';

export const SINGLE_FLYER_SKU = 'ppira_single_300';

interface RegionSeed {
  id: string;
  city: string;
  district: string;
  latitude: number;
  longitude: number;
  accent: string;
  points: Array<[number, number]>;
}

const REGIONS: RegionSeed[] = [
  {
    id: 'seoul-mapo', city: '서울특별시', district: '마포구', latitude: 37.5663, longitude: 126.9015, accent: '#FF7043',
    points: [[37.5684, 126.8855], [37.5551, 126.9237], [37.5559, 126.8994]],
  },
  {
    id: 'seoul-seongdong', city: '서울특별시', district: '성동구', latitude: 37.5634, longitude: 127.0369, accent: '#4667E8',
    points: [[37.5445, 127.0374], [37.5473, 127.0438], [37.5577, 127.0348]],
  },
  {
    id: 'seoul-songpa', city: '서울특별시', district: '송파구', latitude: 37.5145, longitude: 127.1059, accent: '#00A878',
    points: [[37.5208, 127.1210], [37.5099, 127.1040], [37.5110, 127.0982]],
  },
  {
    id: 'seoul-yeongdeungpo', city: '서울특별시', district: '영등포구', latitude: 37.5264, longitude: 126.8962, accent: '#9B5DE5',
    points: [[37.5268, 126.9224], [37.5284, 126.9327], [37.5171, 126.9078]],
  },
  {
    id: 'busan-haeundae', city: '부산광역시', district: '해운대구', latitude: 35.1631, longitude: 129.1635, accent: '#0096C7',
    points: [[35.1568, 129.1526], [35.1587, 129.1604], [35.1694, 129.1824]],
  },
  {
    id: 'busan-suyeong', city: '부산광역시', district: '수영구', latitude: 35.1457, longitude: 129.1131, accent: '#F4A261',
    points: [[35.1532, 129.1188], [35.1490, 129.1150], [35.1426, 129.1074]],
  },
  {
    id: 'incheon-yeonsu', city: '인천광역시', district: '연수구', latitude: 37.4102, longitude: 126.6780, accent: '#2A9D8F',
    points: [[37.3925, 126.6380], [37.4012, 126.6540], [37.4094, 126.6724]],
  },
  {
    id: 'daejeon-yuseong', city: '대전광역시', district: '유성구', latitude: 36.3622, longitude: 127.3561, accent: '#E76F91',
    points: [[36.3762, 127.3880], [36.3694, 127.3547], [36.3607, 127.3570]],
  },
];

const SEED_FLYERS: Array<{ body: string; mood: MoodTag; regionId: string }> = [
  { body: '마포의 어딘가를 걷고 있는 당신에게, 오늘은 조금 천천히 가도 괜찮다고 말해주고 싶어요.', mood: '위로', regionId: 'seoul-mapo' },
  { body: '성동구에 내려앉은 작은 응원이에요. 망설이던 일이 있다면 오늘 한 번 시작해 봐요.', mood: '응원', regionId: 'seoul-seongdong' },
  { body: '석촌호수에 비친 하늘이 좋았어요. 이 삐라를 본 누군가와 작은 장면을 나누고 싶어요.', mood: '일상', regionId: 'seoul-songpa' },
  { body: '해운대의 바람을 타고 갔을 마음이에요. 낯선 하루 속에서도 자신을 잘 챙겨주세요.', mood: '감사', regionId: 'busan-haeundae' },
  { body: '송도에서 우연히 이 종이를 발견했다면, 오늘 하나쯤은 웃을 일이 생기길 바랄게요.', mood: '응원', regionId: 'incheon-yeonsu' },
];

type Row = Record<string, unknown>;

export class PpiraDatabase {
  private readonly db: DatabaseSync;
  private readonly encryptionKey: Buffer;

  constructor(
    databasePath: string,
    private readonly settings: RuntimeSettings,
    encryptionSecret = process.env.FLYER_ENCRYPTION_KEY ?? 'ppira-local-development-key',
  ) {
    if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
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
        purchased_credits INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS regions (
        id TEXT PRIMARY KEY,
        city TEXT NOT NULL,
        district TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accent TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        operating_note TEXT NOT NULL DEFAULT '밝고 안전한 공공장소에서만 탐색해 주세요.',
        inventory_cap INTEGER NOT NULL DEFAULT 30,
        search_points_json TEXT NOT NULL,
        UNIQUE(city, district)
      );

      CREATE TABLE IF NOT EXISTS daily_free_usage (
        user_id TEXT NOT NULL REFERENCES users(id),
        local_date TEXT NOT NULL,
        flyer_id TEXT,
        used_at TEXT NOT NULL,
        PRIMARY KEY(user_id, local_date)
      );

      CREATE TABLE IF NOT EXISTS purchases (
        order_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        sku TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        amount_krw INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS flyers (
        id TEXT PRIMARY KEY,
        sender_user_id TEXT NOT NULL REFERENCES users(id),
        target_region_id TEXT NOT NULL REFERENCES regions(id),
        body_ciphertext TEXT NOT NULL,
        body_length INTEGER NOT NULL,
        mood_tag TEXT,
        credit_source TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        flight_ends_at TEXT,
        first_landed_at TEXT,
        current_landing_sequence INTEGER NOT NULL DEFAULT 0,
        claimed_by_user_id TEXT REFERENCES users(id),
        claimed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS flyer_landings (
        id TEXT PRIMARY KEY,
        flyer_id TEXT NOT NULL REFERENCES flyers(id),
        sequence INTEGER NOT NULL,
        region_id TEXT NOT NULL REFERENCES regions(id),
        target_latitude REAL NOT NULL,
        target_longitude REAL NOT NULL,
        claim_radius_m INTEGER NOT NULL DEFAULT 40,
        landed_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        status TEXT NOT NULL,
        UNIQUE(flyer_id, sequence)
      );

      CREATE TABLE IF NOT EXISTS hunts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        region_id TEXT NOT NULL REFERENCES regions(id),
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        detected_landing_id TEXT REFERENCES flyer_landings(id),
        claim_token_hash TEXT,
        claim_token_expires_at TEXT
      );

      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        flyer_id TEXT NOT NULL UNIQUE REFERENCES flyers(id),
        landing_id TEXT NOT NULL REFERENCES flyer_landings(id),
        claimant_user_id TEXT NOT NULL REFERENCES users(id),
        claimed_at TEXT NOT NULL,
        accuracy_bucket TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        flyer_id TEXT NOT NULL REFERENCES flyers(id),
        reporter_user_id TEXT NOT NULL REFERENCES users(id),
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(flyer_id, reporter_user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_flyers_status_flight ON flyers(status, flight_ends_at);
      CREATE INDEX IF NOT EXISTS idx_landings_region_status ON flyer_landings(region_id, status, expires_at);
      CREATE INDEX IF NOT EXISTS idx_hunts_user_status ON hunts(user_id, status, expires_at);
    `);

    const insertRegion = this.db.prepare(`
      INSERT OR IGNORE INTO regions
      (id, city, district, latitude, longitude, accent, search_points_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const region of REGIONS) {
      insertRegion.run(region.id, region.city, region.district, region.latitude, region.longitude, region.accent, JSON.stringify(region.points));
    }
    this.seedFlyers();
  }

  private seedFlyers(): void {
    const count = this.db.prepare('SELECT COUNT(*) AS count FROM flyers').get() as Row;
    if (Number(count.count) > 0) return;
    const now = new Date();
    const seedUserId = this.normalizeUserKey('seed-flyer-writer');
    this.ensureUser(seedUserId, now.toISOString());
    for (const [index, seed] of SEED_FLYERS.entries()) {
      const id = randomUUID();
      const createdAt = new Date(now.getTime() - (index + 1) * 60_000).toISOString();
      this.db.prepare(`
        INSERT INTO flyers
        (id, sender_user_id, target_region_id, body_ciphertext, body_length, mood_tag,
         credit_source, status, created_at, flight_ends_at, current_landing_sequence)
        VALUES (?, ?, ?, ?, ?, ?, 'SEED', 'FLYING', ?, ?, 0)
      `).run(id, seedUserId, seed.regionId, this.encrypt(seed.body), seed.body.length, seed.mood, createdAt, createdAt);
      this.landFlyer(id, seed.regionId, 1, now);
    }
  }

  normalizeUserKey(rawKey: string): string {
    if (!rawKey || rawKey.length > 512) throw new AppError('INVALID_USER_KEY', '사용자 식별키가 올바르지 않아요.', 401);
    return createHash('sha256').update(`ppira:${rawKey}`).digest('hex');
  }

  ensureUser(userId: string, now = new Date().toISOString()): void {
    this.db.prepare('INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)').run(userId, now);
  }

  getWallet(userId: string, now = new Date()): WalletSummary {
    this.ensureUser(userId, now.toISOString());
    const user = this.db.prepare('SELECT purchased_credits FROM users WHERE id = ?').get(userId) as Row;
    const used = this.db.prepare('SELECT 1 FROM daily_free_usage WHERE user_id = ? AND local_date = ?').get(userId, kstDate(now));
    const dailyFreeRemaining = used ? 0 : 1;
    const purchasedCredits = Number(user.purchased_credits);
    return {
      dailyFreeRemaining,
      purchasedCredits,
      availableTotal: dailyFreeRemaining + purchasedCredits,
      nextFreeAt: nextKstMidnight(now).toISOString(),
      product: { sku: SINGLE_FLYER_SKU, displayName: '삐라 1장', price: 300, displayPrice: '300원' },
    };
  }

  grantPurchase(userId: string, orderId: string, sku: string, status: 'VERIFIED' | 'SIMULATED', now = new Date()): WalletSummary {
    if (sku !== SINGLE_FLYER_SKU) throw new AppError('INVALID_PRODUCT', '구매 상품이 올바르지 않아요.');
    if (!orderId || orderId.length > 120) throw new AppError('INVALID_ORDER', '주문 정보가 올바르지 않아요.');
    this.ensureUser(userId, now.toISOString());
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.db.prepare('SELECT user_id, sku FROM purchases WHERE order_id = ?').get(orderId) as Row | undefined;
      if (existing) {
        if (existing.user_id !== userId || existing.sku !== sku) throw new AppError('ORDER_ALREADY_USED', '이미 다른 계정에 지급된 주문이에요.', 409);
        this.db.exec('COMMIT');
        return this.getWallet(userId, now);
      }
      this.db.prepare(`
        INSERT INTO purchases (order_id, user_id, sku, quantity, amount_krw, status, created_at)
        VALUES (?, ?, ?, 1, 300, ?, ?)
      `).run(orderId, userId, sku, status, now.toISOString());
      this.db.prepare('UPDATE users SET purchased_credits = purchased_credits + 1 WHERE id = ?').run(userId);
      this.db.exec('COMMIT');
      return this.getWallet(userId, now);
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  createFlyer(userId: string, regionId: string, body: string, moodTag: MoodTag | null, now = new Date()): UserFlyer {
    this.ensureUser(userId, now.toISOString());
    const region = this.db.prepare("SELECT id FROM regions WHERE id = ? AND status = 'ACTIVE'").get(regionId);
    if (!region) throw new AppError('INVALID_REGION', '현재 삐라를 날릴 수 없는 지역이에요.');
    const id = randomUUID();
    const flightSeconds = randomInt(this.settings.flightMinSeconds, Math.max(this.settings.flightMinSeconds + 1, this.settings.flightMaxSeconds + 1));
    const flightEndsAt = new Date(now.getTime() + flightSeconds * 1000).toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const daily = this.db.prepare(`
        INSERT OR IGNORE INTO daily_free_usage (user_id, local_date, flyer_id, used_at)
        VALUES (?, ?, ?, ?)
      `).run(userId, kstDate(now), id, now.toISOString());
      let creditSource = 'DAILY_FREE';
      if (Number(daily.changes) === 0) {
        const paid = this.db.prepare(`
          UPDATE users SET purchased_credits = purchased_credits - 1
          WHERE id = ? AND purchased_credits > 0
        `).run(userId);
        if (Number(paid.changes) === 0) throw new AppError('NO_FLYER_CREDIT', '오늘의 무료 삐라를 이미 사용했어요.', 402);
        creditSource = 'PURCHASED';
      }
      this.db.prepare(`
        INSERT INTO flyers
        (id, sender_user_id, target_region_id, body_ciphertext, body_length, mood_tag,
         credit_source, status, created_at, flight_ends_at, current_landing_sequence)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'FLYING', ?, ?, 0)
      `).run(id, userId, regionId, this.encrypt(body), body.length, moodTag, creditSource, now.toISOString(), flightEndsAt);
      this.db.exec('COMMIT');
      return this.getUserFlyer(userId, id);
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  listRegions(now = new Date()): RegionSummary[] {
    this.runMaintenance(now);
    const rows = this.db.prepare(`
      SELECT r.id, r.city, r.district, r.latitude, r.longitude, r.accent, r.status, r.operating_note,
             COUNT(CASE WHEN fl.status = 'LANDED' AND f.status = 'LANDED' THEN 1 END) AS inventory_count
      FROM regions r
      LEFT JOIN flyer_landings fl ON fl.region_id = r.id
      LEFT JOIN flyers f ON f.id = fl.flyer_id
      GROUP BY r.id
      ORDER BY r.city, r.district
    `).all() as Row[];
    return rows.map((row) => ({
      id: String(row.id), city: String(row.city), district: String(row.district),
      displayName: `${String(row.city)} ${String(row.district)}`,
      latitude: Number(row.latitude), longitude: Number(row.longitude), accent: String(row.accent),
      status: row.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE', inventoryCount: Number(row.inventory_count),
      operatingNote: String(row.operating_note),
    }));
  }

  listUserFlyers(userId: string, now = new Date()): UserFlyer[] {
    this.runMaintenance(now);
    const rows = this.db.prepare(`
      SELECT f.*, r.city || ' ' || r.district AS region_name
      FROM flyers f JOIN regions r ON r.id = f.target_region_id
      WHERE f.sender_user_id = ? ORDER BY f.created_at DESC
    `).all(userId) as Row[];
    return rows.map((row) => this.mapUserFlyer(row));
  }

  listFoundFlyers(userId: string): FoundFlyer[] {
    const rows = this.db.prepare(`
      SELECT f.id, f.body_ciphertext, f.mood_tag, c.claimed_at, r.city || ' ' || r.district AS region_name
      FROM claims c JOIN flyers f ON f.id = c.flyer_id
      JOIN flyer_landings fl ON fl.id = c.landing_id JOIN regions r ON r.id = fl.region_id
      WHERE c.claimant_user_id = ? AND f.status IN ('CLAIMED', 'HIDDEN') ORDER BY c.claimed_at DESC
    `).all(userId) as Row[];
    return rows.map((row) => this.mapFoundFlyer(row));
  }

  startHunt(userId: string, regionId: string, now = new Date()): { huntId: string; expiresAt: string } {
    this.ensureUser(userId, now.toISOString());
    const region = this.db.prepare("SELECT id FROM regions WHERE id = ? AND status = 'ACTIVE'").get(regionId);
    if (!region) throw new AppError('REGION_PAUSED', '현재 이 지역에서는 탐색할 수 없어요.');
    this.db.prepare("UPDATE hunts SET status = 'ENDED' WHERE user_id = ? AND status = 'ACTIVE'").run(userId);
    const huntId = randomUUID();
    const expiresAt = new Date(now.getTime() + 30 * 60_000).toISOString();
    this.db.prepare(`INSERT INTO hunts (id, user_id, region_id, status, created_at, expires_at) VALUES (?, ?, ?, 'ACTIVE', ?, ?)`)
      .run(huntId, userId, regionId, now.toISOString(), expiresAt);
    return { huntId, expiresAt };
  }

  scanHunt(userId: string, huntId: string, coordinates: Coordinates, simulate: boolean, now = new Date()): { detected: boolean; claimToken?: string; tokenExpiresAt?: string; visualSeed?: number; reason?: 'NO_FLYER_DETECTED' | 'LOCATION_ACCURACY_LOW' } {
    this.runMaintenance(now);
    const hunt = this.db.prepare(`
      SELECT h.*, r.latitude AS region_latitude, r.longitude AS region_longitude
      FROM hunts h JOIN regions r ON r.id = h.region_id
      WHERE h.id = ? AND h.user_id = ? AND h.status = 'ACTIVE'
    `).get(huntId, userId) as Row | undefined;
    if (!hunt || String(hunt.expires_at) <= now.toISOString()) throw new AppError('HUNT_EXPIRED', '탐색 시간이 끝났어요. 다시 시작해 주세요.');
    if (simulate && !this.settings.allowSimulatedLocation) throw new AppError('SIMULATION_DISABLED', '운영 환경에서는 체험 위치를 사용할 수 없어요.', 403);
    if (!simulate && coordinates.accuracy > 50) return { detected: false, reason: 'LOCATION_ACCURACY_LOW' };
    if (!simulate) {
      const regionDistance = distanceMeters(coordinates, { latitude: Number(hunt.region_latitude), longitude: Number(hunt.region_longitude) });
      if (regionDistance > 12_000) throw new AppError('OUTSIDE_REGION', '선택한 구 안에서 탐색을 시작해 주세요.');
    }

    const candidates = this.db.prepare(`
      SELECT fl.*, f.sender_user_id FROM flyer_landings fl JOIN flyers f ON f.id = fl.flyer_id
      WHERE fl.region_id = ? AND fl.status = 'LANDED' AND f.status = 'LANDED' AND f.sender_user_id <> ?
      ORDER BY fl.landed_at ASC
    `).all(String(hunt.region_id), userId) as Row[];
    const detected = candidates.find((candidate) => simulate || distanceMeters(coordinates, {
      latitude: Number(candidate.target_latitude), longitude: Number(candidate.target_longitude),
    }) <= Number(candidate.claim_radius_m));
    if (!detected) return { detected: false, reason: 'NO_FLYER_DETECTED' };

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const tokenExpiresAt = new Date(now.getTime() + 2 * 60_000).toISOString();
    this.db.prepare(`UPDATE hunts SET detected_landing_id = ?, claim_token_hash = ?, claim_token_expires_at = ? WHERE id = ?`)
      .run(String(detected.id), tokenHash, tokenExpiresAt, huntId);
    return { detected: true, claimToken: rawToken, tokenExpiresAt, visualSeed: this.visualSeed(String(detected.id)) };
  }

  claimFlyer(userId: string, huntId: string, rawToken: string, accuracy: number, now = new Date()): ClaimResult {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const hunt = this.db.prepare(`
        SELECT h.*, fl.flyer_id, fl.status AS landing_status, f.status AS flyer_status, f.sender_user_id
        FROM hunts h JOIN flyer_landings fl ON fl.id = h.detected_landing_id JOIN flyers f ON f.id = fl.flyer_id
        WHERE h.id = ? AND h.user_id = ? AND h.status = 'ACTIVE'
      `).get(huntId, userId) as Row | undefined;
      if (!hunt || hunt.claim_token_hash !== tokenHash) throw new AppError('CLAIM_TOKEN_INVALID', '발견 인증이 만료됐어요. 다시 확인해 주세요.');
      if (String(hunt.claim_token_expires_at) <= now.toISOString()) throw new AppError('CLAIM_TOKEN_EXPIRED', '삐라를 줍는 시간이 지났어요.');
      if (hunt.sender_user_id === userId) throw new AppError('SELF_CLAIM_NOT_ALLOWED', '내가 날린 삐라는 직접 줍을 수 없어요.');
      if (hunt.landing_status !== 'LANDED' || hunt.flyer_status !== 'LANDED') throw new AppError('FLYER_ALREADY_CLAIMED', '다른 사람이 먼저 발견했어요.', 409);
      const claimedAt = now.toISOString();
      this.db.prepare(`INSERT INTO claims (id, flyer_id, landing_id, claimant_user_id, claimed_at, accuracy_bucket) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(randomUUID(), String(hunt.flyer_id), String(hunt.detected_landing_id), userId, claimedAt, accuracy <= 20 ? 'LTE_20M' : accuracy <= 50 ? 'LTE_50M' : 'SIMULATED');
      this.db.prepare("UPDATE flyers SET status = 'CLAIMED', claimed_by_user_id = ?, claimed_at = ? WHERE id = ?").run(userId, claimedAt, String(hunt.flyer_id));
      this.db.prepare("UPDATE flyer_landings SET status = 'CLAIMED' WHERE id = ?").run(String(hunt.detected_landing_id));
      this.db.prepare("UPDATE hunts SET status = 'CLAIMED' WHERE id = ?").run(huntId);
      this.db.exec('COMMIT');
      return { flyer: this.getFoundFlyer(userId, String(hunt.flyer_id)) };
    } catch (error) {
      this.db.exec('ROLLBACK');
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : '';
      if (message.includes('UNIQUE constraint failed')) throw new AppError('FLYER_ALREADY_CLAIMED', '다른 사람이 먼저 발견했어요.', 409);
      throw error;
    }
  }

  reportFlyer(userId: string, flyerId: string, reason: string, now = new Date()): void {
    const claim = this.db.prepare('SELECT 1 FROM claims WHERE flyer_id = ? AND claimant_user_id = ?').get(flyerId, userId);
    if (!claim) throw new AppError('FLYER_NOT_FOUND', '획득한 삐라만 신고할 수 있어요.', 404);
    this.db.prepare(`INSERT OR IGNORE INTO reports (id, flyer_id, reporter_user_id, reason, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(randomUUID(), flyerId, userId, reason.slice(0, 80), now.toISOString());
    this.db.prepare("UPDATE flyers SET status = 'HIDDEN' WHERE id = ?").run(flyerId);
  }

  runMaintenance(now = new Date()): void {
    const nowIso = now.toISOString();
    const flying = this.db.prepare("SELECT id, target_region_id FROM flyers WHERE status = 'FLYING' AND flight_ends_at <= ?").all(nowIso) as Row[];
    for (const row of flying) this.landFlyer(String(row.id), String(row.target_region_id), 1, now);
    const expired = this.db.prepare(`
      SELECT fl.id, fl.flyer_id, fl.region_id, fl.sequence FROM flyer_landings fl JOIN flyers f ON f.id = fl.flyer_id
      WHERE fl.status = 'LANDED' AND f.status = 'LANDED' AND fl.expires_at <= ?
    `).all(nowIso) as Row[];
    for (const landing of expired) {
      const sequence = Number(landing.sequence);
      if (sequence >= this.settings.maxLandingSequence) {
        this.db.prepare("UPDATE flyer_landings SET status = 'EXPIRED' WHERE id = ?").run(String(landing.id));
        this.db.prepare("UPDATE flyers SET status = 'EXPIRED' WHERE id = ?").run(String(landing.flyer_id));
      } else {
        this.db.prepare("UPDATE flyer_landings SET status = 'RELOCATED' WHERE id = ?").run(String(landing.id));
        this.db.prepare("UPDATE flyers SET status = 'RELOCATING' WHERE id = ?").run(String(landing.flyer_id));
        this.landFlyer(String(landing.flyer_id), String(landing.region_id), sequence + 1, now);
      }
    }
  }

  private landFlyer(flyerId: string, regionId: string, sequence: number, now: Date): void {
    const region = this.db.prepare(`
      SELECT r.*, COUNT(CASE WHEN fl.status = 'LANDED' THEN 1 END) AS inventory_count
      FROM regions r LEFT JOIN flyer_landings fl ON fl.region_id = r.id
      WHERE r.id = ? AND r.status = 'ACTIVE' GROUP BY r.id
    `).get(regionId) as Row | undefined;
    if (!region || Number(region.inventory_count) >= Number(region.inventory_cap)) {
      this.db.prepare("UPDATE flyers SET status = 'FLYING' WHERE id = ?").run(flyerId);
      return;
    }
    const points = JSON.parse(String(region.search_points_json)) as Array<[number, number]>;
    const previous = sequence > 1
      ? this.db.prepare(`SELECT target_latitude, target_longitude FROM flyer_landings WHERE flyer_id = ? ORDER BY sequence DESC LIMIT 1`).get(flyerId) as Row | undefined
      : undefined;
    const availablePoints = previous
      ? points.filter(([latitude, longitude]) => latitude !== Number(previous.target_latitude) || longitude !== Number(previous.target_longitude))
      : points;
    const candidatePoints = availablePoints.length ? availablePoints : points;
    const point = candidatePoints[randomInt(candidatePoints.length)];
    if (!point) throw new AppError('NO_SAFE_SEARCH_POINT', '안전한 탐색 지점을 찾지 못했어요.', 503);
    const landedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + this.settings.landingTtlSeconds * 1000).toISOString();
    this.db.prepare(`
      INSERT INTO flyer_landings (id, flyer_id, sequence, region_id, target_latitude, target_longitude, claim_radius_m, landed_at, expires_at, status)
      VALUES (?, ?, ?, ?, ?, ?, 40, ?, ?, 'LANDED')
    `).run(randomUUID(), flyerId, sequence, regionId, point[0], point[1], landedAt, expiresAt);
    this.db.prepare(`UPDATE flyers SET status = 'LANDED', first_landed_at = COALESCE(first_landed_at, ?), current_landing_sequence = ? WHERE id = ?`)
      .run(landedAt, sequence, flyerId);
  }

  private getUserFlyer(userId: string, flyerId: string): UserFlyer {
    const row = this.db.prepare(`
      SELECT f.*, r.city || ' ' || r.district AS region_name FROM flyers f JOIN regions r ON r.id = f.target_region_id
      WHERE f.id = ? AND f.sender_user_id = ?
    `).get(flyerId, userId) as Row | undefined;
    if (!row) throw new AppError('FLYER_NOT_FOUND', '삐라를 찾을 수 없어요.', 404);
    return this.mapUserFlyer(row);
  }

  private getFoundFlyer(userId: string, flyerId: string): FoundFlyer {
    const row = this.db.prepare(`
      SELECT f.id, f.body_ciphertext, f.mood_tag, c.claimed_at, r.city || ' ' || r.district AS region_name
      FROM claims c JOIN flyers f ON f.id = c.flyer_id JOIN flyer_landings fl ON fl.id = c.landing_id JOIN regions r ON r.id = fl.region_id
      WHERE c.claimant_user_id = ? AND f.id = ?
    `).get(userId, flyerId) as Row | undefined;
    if (!row) throw new AppError('FLYER_NOT_FOUND', '획득한 삐라를 찾을 수 없어요.', 404);
    return this.mapFoundFlyer(row);
  }

  private mapUserFlyer(row: Row): UserFlyer {
    const body = this.decrypt(String(row.body_ciphertext));
    return {
      id: String(row.id), bodyPreview: `${body.slice(0, 36)}${body.length > 36 ? '…' : ''}`,
      moodTag: (row.mood_tag as MoodTag | null) ?? null, status: row.status as UserFlyer['status'],
      createdAt: String(row.created_at), flightEndsAt: row.flight_ends_at ? String(row.flight_ends_at) : null,
      targetRegionName: String(row.region_name), landingSequence: Number(row.current_landing_sequence),
      claimedAt: row.claimed_at ? String(row.claimed_at) : null,
    };
  }

  private mapFoundFlyer(row: Row): FoundFlyer {
    return {
      id: String(row.id), body: this.decrypt(String(row.body_ciphertext)), moodTag: (row.mood_tag as MoodTag | null) ?? null,
      regionName: String(row.region_name), claimedAt: String(row.claimed_at),
    };
  }

  private encrypt(plainText: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  private decrypt(payload: string): string {
    const [ivText, tagText, encryptedText] = payload.split('.');
    if (!ivText || !tagText || !encryptedText) throw new Error('Invalid encrypted payload');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8');
  }

  private visualSeed(value: string): number {
    return createHash('sha256').update(value).digest().readUInt32BE(0);
  }
}

function kstDate(now: Date): string {
  return new Date(now.getTime() + 9 * 60 * 60_000).toISOString().slice(0, 10);
}

function nextKstMidnight(now: Date): Date {
  const [year, month, day] = kstDate(now).split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + 1) - 9 * 60 * 60_000);
}
