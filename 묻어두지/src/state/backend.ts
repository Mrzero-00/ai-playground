import type { Capsule, CapsuleItem, ItemKind, PlantedLocation } from '@/domain/capsule';
import type { Account, ApiErrorCode, AuthProvider, CreateCapsuleInput, LoginInput } from '@/shared/capsule-api';

export type AccountState = { account: Account | null; displayName: string; providers: AuthProvider[] };

export type BackendErrorCode = ApiErrorCode | 'NETWORK';

/** 백엔드(로컬·원격 공통)가 던지는 오류. 화면은 code 로 분기하고 message 를 그대로 보여 준다. */
export class BackendError extends Error {
  code: BackendErrorCode;
  status: number | undefined;

  constructor(code: BackendErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'BackendError';
    this.code = code;
    this.status = status;
  }
}

export type NewItemInput = { kind: ItemKind; text?: string; uri?: string; durationMs?: number };
export type ItemPatch = { kind: ItemKind; text?: string; uri?: string; durationMs?: number };

/**
 * 스토어가 쓰는 백엔드 인터페이스. 모든 호출은 호출자 기준으로 직렬화된 Capsule 을 돌려준다.
 * - LocalBackend: 서버 없이 메모리에서 같은 규칙을 적용(시드 데이터, 웹 미리보기용)
 * - RemoteBackend: src/shared/capsule-api.ts 계약대로 서버를 부른다
 */
export interface CapsuleBackend {
  readonly source: 'local' | 'remote';
  load(): Promise<Capsule[]>;
  create(input: CreateCapsuleInput): Promise<Capsule>;
  join(code: string): Promise<{ capsule: Capsule; already: boolean }>;
  addItem(capsuleId: string, input: NewItemInput): Promise<{ capsule: Capsule; item: CapsuleItem }>;
  updateItem(capsuleId: string, itemId: string, patch: ItemPatch): Promise<{ capsule: Capsule; item: CapsuleItem }>;
  removeItem(capsuleId: string, itemId: string): Promise<Capsule>;
  seal(capsuleId: string): Promise<Capsule>;
  open(capsuleId: string): Promise<Capsule>;
  plant(capsuleId: string, location: PlantedLocation): Promise<Capsule>;
  /** 캡슐에 보일 내 이름을 바꾼다. 이미 들어 있는 캡슐의 내 멤버 이름도 함께 바뀐다. */
  setDisplayName(name: string): Promise<void>;
  /** 지금 세션에 묶인 계정과 서버가 지원하는 로그인 제공자. */
  account(): Promise<AccountState>;
  /** 소셜 로그인으로 세션을 계정에 묶는다. 같은 계정의 다른 기기 캡슐이 보이기 시작한다. */
  login(input: LoginInput): Promise<AccountState>;
  logout(): Promise<void>;
}
