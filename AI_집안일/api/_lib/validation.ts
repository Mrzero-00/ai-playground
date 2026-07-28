import type { AppData, Chore, Home, SupplyItem } from '../../src/domain/types.js';

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'INPUT_VALIDATION';
  }
}

function invalid(message: string): never {
  throw new InputValidationError(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

function validateChore(chore: Chore) {
  if (!isObject(chore)) invalid('집안일 형식이 올바르지 않아요.');
  if (typeof chore.id !== 'string' || chore.id.length < 1 || chore.id.length > 160) invalid('집안일 ID가 올바르지 않아요.');
  if (typeof chore.title !== 'string' || chore.title.trim().length < 1 || chore.title.length > 100) invalid('집안일 이름은 1~100자로 입력해 주세요.');
  if (!['cleaning', 'kitchen', 'laundry', 'pet', 'living', 'etc'].includes(chore.category)) invalid('집안일 분류가 올바르지 않아요.');
  if (!isObject(chore.recurrence) || !Number.isInteger(chore.recurrence.interval) || chore.recurrence.interval < 1 || chore.recurrence.interval > 365) invalid('반복 주기가 올바르지 않아요.');
  if (!['day', 'week', 'month', 'year'].includes(chore.recurrence.unit)) invalid('반복 단위가 올바르지 않아요.');
  if (!isIsoDate(chore.createdAt) || !isDateKey(chore.nextDueDate)) invalid('집안일 날짜가 올바르지 않아요.');
  if (chore.scheduleAnchorDate && !isDateKey(chore.scheduleAnchorDate)) invalid('집안일 시작 날짜가 올바르지 않아요.');
  if (typeof chore.enabled !== 'boolean' || typeof chore.isCustom !== 'boolean') invalid('집안일 상태가 올바르지 않아요.');
  if (chore.icon && chore.icon.length > 12) invalid('집안일 아이콘이 너무 길어요.');
  if (chore.notificationTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(chore.notificationTime)) invalid('알림 시간이 올바르지 않아요.');
}

function validateSupply(item: SupplyItem) {
  if (!isObject(item)) invalid('생활용품 형식이 올바르지 않아요.');
  if (typeof item.id !== 'string' || item.id.length < 1 || item.id.length > 160) invalid('생활용품 ID가 올바르지 않아요.');
  if (typeof item.name !== 'string' || item.name.trim().length < 1 || item.name.length > 60) invalid('생활용품 이름은 1~60자로 입력해 주세요.');
  if (typeof item.unit !== 'string' || item.unit.trim().length < 1 || item.unit.length > 12) invalid('생활용품 단위는 1~12자로 입력해 주세요.');
  if (!isDateKey(item.purchaseDate) || !isIsoDate(item.updatedAt)) invalid('생활용품 날짜가 올바르지 않아요.');
  if (!Number.isFinite(item.purchaseQuantity) || item.purchaseQuantity <= 0 || item.purchaseQuantity > 100000) invalid('구매 수량이 올바르지 않아요.');
  if (!Number.isFinite(item.weeklyUsage) || item.weeklyUsage <= 0 || item.weeklyUsage > 100000) invalid('주간 사용량이 올바르지 않아요.');
  if (!Number.isFinite(item.safetyStock) || item.safetyStock < 0 || item.safetyStock > 100000) invalid('안전 재고가 올바르지 않아요.');
  if (!Number.isInteger(item.reminderDaysBefore) || item.reminderDaysBefore < 0 || item.reminderDaysBefore > 90) invalid('미리 확인할 날짜가 올바르지 않아요.');
}

function validateHome(home: Home) {
  if (!isObject(home)) invalid('집 정보 형식이 올바르지 않아요.');
  if (typeof home.id !== 'string' || home.id.length < 3 || home.id.length > 120) invalid('집 ID가 올바르지 않아요.');
  if (typeof home.name !== 'string' || home.name.trim().length < 1 || home.name.length > 60) invalid('집 이름은 1~60자로 입력해 주세요.');
  if (typeof home.emoji !== 'string' || home.emoji.length > 16) invalid('집 아이콘이 올바르지 않아요.');
  if (!/^[A-Z0-9]{6}$/.test(home.inviteCode)) invalid('초대 코드가 올바르지 않아요.');
  if (!isIsoDate(home.createdAt)) invalid('집 생성 날짜가 올바르지 않아요.');
  if (home.syncRevision !== undefined && (!Number.isInteger(home.syncRevision) || home.syncRevision < 0)) invalid('동기화 버전이 올바르지 않아요.');
  if (!Array.isArray(home.chores) || home.chores.length > 500) invalid('집안일은 집마다 최대 500개까지 저장할 수 있어요.');
  if (!Array.isArray(home.history) || home.history.length > 5000) invalid('집안일 기록이 너무 많아요.');
  if (!Array.isArray(home.supplies) || home.supplies.length > 200) invalid('생활용품은 집마다 최대 200개까지 저장할 수 있어요.');
  home.chores.forEach(validateChore);
  home.supplies.forEach(validateSupply);
  for (const entry of home.history) {
    if (!isObject(entry) || typeof entry.id !== 'string' || entry.id.length > 160) invalid('집안일 기록이 올바르지 않아요.');
    if (!['completed', 'skipped'].includes(entry.action) || !isIsoDate(entry.performedAt)) invalid('집안일 수행 기록이 올바르지 않아요.');
    if (entry.scheduledFor && !isDateKey(entry.scheduledFor)) invalid('집안일 예정 날짜가 올바르지 않아요.');
  }
  if (home.profile) {
    const { memberCount, roomCount, bathroomCount, childAges = [] } = home.profile;
    if (![memberCount, roomCount, bathroomCount].every((value) => Number.isInteger(value) && value >= 0 && value <= 30)) invalid('가구원·방·욕실 수가 올바르지 않아요.');
    if (!Array.isArray(childAges) || childAges.length > 20 || childAges.some((age) => !Number.isInteger(age) || age < 0 || age > 25)) invalid('아이 나이가 올바르지 않아요.');
  }
}

export function assertValidAppData(value: unknown): asserts value is AppData {
  if (!isObject(value) || value.version !== 2) invalid('지원하지 않는 데이터 형식이에요.');
  if (!isObject(value.user) || typeof value.user.id !== 'string' || value.user.id.length > 160) invalid('사용자 정보가 올바르지 않아요.');
  if (typeof value.user.displayName !== 'string' || value.user.displayName.trim().length < 1 || value.user.displayName.length > 40) invalid('이름은 1~40자로 입력해 주세요.');
  if (!Array.isArray(value.homes) || value.homes.length > 20) invalid('집은 최대 20개까지 관리할 수 있어요.');
  value.homes.forEach((home) => validateHome(home as Home));
  if (value.activeHomeId !== null && typeof value.activeHomeId !== 'string') invalid('현재 집 정보가 올바르지 않아요.');
  if (!isObject(value.notifications) || typeof value.notifications.enabled !== 'boolean' || typeof value.notifications.reminderHour !== 'number' || !Number.isInteger(value.notifications.reminderHour) || value.notifications.reminderHour < 0 || value.notifications.reminderHour > 23) invalid('알림 설정이 올바르지 않아요.');
}

export function normalizeInviteCode(value: unknown): string {
  if (typeof value !== 'string') invalid('초대 코드를 입력해 주세요.');
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalized)) invalid('초대 코드는 영문과 숫자 6자리예요.');
  return normalized;
}
