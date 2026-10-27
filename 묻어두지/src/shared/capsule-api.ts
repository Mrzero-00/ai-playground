/**
 * 1차(시간 잠금 타임캡슐) 앱 ↔ 서버 계약. 도메인 타입(src/domain/capsule.ts)을 그대로 전송한다.
 *
 * 규칙
 * - 모든 라우트는 `Authorization: Bearer <세션 토큰>` 필요(POST /sessions 제외).
 * - 응답의 Capsule 은 호출자 기준으로 직렬화한다: 내 멤버는 isMe=true, 멤버 id 는 공개용 랜덤 id(세션 id 노출 금지).
 * - 내용물 노출: 채우는 중(collecting)에는 내 물건만 text/uri 를 받는다. 다른 멤버의 물건은 id/kind/createdAt/durationMs 만.
 *   닫힌 뒤(sealed)에는 아무도 text/uri 를 받지 못한다. 열린 뒤(opened)에는 모두 받는다.
 * - item.uri 는 서버 상대 경로 `/capsules/:id/items/:itemId/media?exp=<ms>&sig=<hex>` 이며 10분간 유효하다. 앱이 API_URL 을 앞에 붙인다.
 * - 저절로 닫힘(마감 경과, 전원 5개)은 서버가 읽기·쓰기 때마다 판정한다(autoSealReason). 열 수 있음(unlockable)은 저장 상태가 아니라 openAt 경과로 계산한다.
 * - 서버는 serverNow 를 항상 돌려준다. 클라이언트 시계는 안내용이다.
 */
import type { Capsule, CapsuleItem, CapsuleMode, ItemKind, PlantedLocation } from '@/domain/capsule';

export type { Capsule, CapsuleItem, CapsuleMode, ItemKind, PlantedLocation };

/** POST /sessions  body: { displayName } → 201 */
export type SessionInput = { displayName: string };
export type SessionResponse = { token: string; displayName: string };
/** PATCH /sessions/me  body: { displayName } → 200 { displayName } */

/** GET /capsules → 내가 멤버인 캡슐 전부 */
export type CapsuleListResponse = { capsules: Capsule[]; serverNow: string };
/** GET /capsules/:id, POST /capsules, POST /capsules/:id/seal, /open, /plant → */
export type CapsuleResponse = { capsule: Capsule; serverNow: string };

/** POST /capsules → 201. 서버가 createdAt/deadlineAt/inviteCode 를 정하고 isValidOpenAtForCreate 로 openAt 을 검증한다. */
export type CreateCapsuleInput = {
  title: string;
  mode: CapsuleMode;
  deadlineDays: number;
  openAt: string;
  location?: PlantedLocation | null;
};

/** POST /capsules/join  body: { code } → 200. 이미 멤버면 already=true 로 그대로 돌려준다. */
export type JoinInput = { code: string };
export type JoinResponse = CapsuleResponse & { already: boolean };

export type PhotoMimeType = 'image/jpeg' | 'image/png' | 'image/webp';
export type VoiceMimeType = 'audio/mp4' | 'audio/mpeg' | 'audio/wav' | 'audio/webm';
export type VideoMimeType = 'video/mp4' | 'video/quicktime' | 'video/webm';
export type MediaUpload = { mimeType: PhotoMimeType | VoiceMimeType | VideoMimeType; base64: string; fileName?: string };

/** POST /capsules/:id/items → 201. 한 사람 5개까지, collecting 에서만. letter 는 text 필수, 나머지는 media 필수. */
export type AddItemInput = { kind: ItemKind; text?: string; durationMs?: number; media?: MediaUpload };
/** PATCH /capsules/:id/items/:itemId → 200. 내 물건만, collecting 에서만. */
export type UpdateItemInput = { text?: string; durationMs?: number; media?: MediaUpload };
/** DELETE /capsules/:id/items/:itemId → 200 ItemResponse(item 은 지운 것) */
export type ItemResponse = { item: CapsuleItem; capsule: Capsule; serverNow: string };

/** POST /capsules/:id/plant  body: { location } → 200 CapsuleResponse (방장만) */
export type PlantInput = { location: PlantedLocation };

/** GET /capsules/:id/items/:itemId/media?exp&sig → 바이너리 스트림(Content-Type 은 올린 mimeType). 서명 무효/만료 403, 내용물 비노출 상태 403. */

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVITE_NOT_FOUND'
  | 'CAPSULE_CLOSED'
  | 'CAPSULE_FULL'
  | 'SLOTS_FULL'
  | 'NOT_HOST'
  | 'CANNOT_SEAL'
  | 'NOT_SEALED'
  | 'TOO_EARLY'
  | 'MEDIA_INVALID'
  | 'ORIGIN_NOT_ALLOWED'
  | 'INTERNAL_ERROR';

export type ApiErrorBody = { error: { code: ApiErrorCode; message: string } };

export const MEDIA_LIMITS_BYTES = { photo: 8 * 1024 * 1024, voice: 4 * 1024 * 1024, video: 40 * 1024 * 1024 } as const;
export const MEDIA_URL_TTL_MS = 10 * 60 * 1000;
