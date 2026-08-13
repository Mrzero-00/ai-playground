import { createHash } from 'node:crypto';
import type {
  ChoreDto,
  ChoreOccurrenceDto,
  AssignChoreRequest,
  AssignChoreResponse,
  ApiUserDto,
  CompleteChoreRequest,
  CompleteChoreResponse,
  CompletionDto,
  HomeDetailDto,
  HomeMemberDto,
  HomeMembershipSummaryDto,
  HomeSummaryDto,
  MeDto,
} from '../../src/domain/apiContracts.js';
import {
  getProfileInsightsFromCategoryCounts,
  normalizeProfileCategoryCounts,
  profileTendencyKey,
} from '../../src/domain/profileInsights.js';
import type {
  ChoreCategory,
  HomeProfile,
  NotificationSettings,
  RecommendationPreference,
  SupplyItem,
} from '../../src/domain/types.js';
import { getSupabaseAdmin } from './supabase.js';

type Db = ReturnType<typeof getSupabaseAdmin>;
type Row = Record<string, unknown>;

const DEFAULT_NOTIFICATIONS: NotificationSettings = { enabled: false, reminderHour: 9 };
const DEFAULT_TIMEZONE = 'Asia/Seoul';
const PROFILE_ALGORITHM_VERSION = '1';
const CHORE_CATEGORIES: ChoreCategory[] = ['cleaning', 'kitchen', 'laundry', 'pet', 'living', 'etc'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class UserHomeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'USER_HOME_API_ERROR';
  }
}

export interface UpdateMeInput {
  displayName?: string;
  activeHomeId?: string | null;
  notifications?: NotificationSettings;
}

export interface CreateHomeInput {
  name: string;
  emoji?: string;
  timezone?: string;
  profile?: HomeProfile | null;
}

export interface UpdateHomeInput {
  expectedRevision: number;
  name?: string;
  emoji?: string;
  timezone?: string;
  profile?: HomeProfile | null;
}

function isObject(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numericValue(value: unknown, fallback = 0): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function rpcPayload(value: unknown): Row {
  if (isObject(value)) return value;
  if (Array.isArray(value) && isObject(value[0])) return value[0];
  throw new UserHomeApiError(500, 'INVALID_DATABASE_RESPONSE', '서버 응답을 처리하지 못했어요.');
}

export function choreOccurrenceId(homeId: string, choreId: string, scheduledFor: string): string {
  const digest = createHash('sha256')
    .update(`${homeId}\u001f${choreId}\u001f${scheduledFor}`)
    .digest('hex');
  return `occurrence-${digest}`;
}

function requireText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw new UserHomeApiError(400, 'INPUT_VALIDATION', `${label}을(를) 입력해 주세요.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new UserHomeApiError(400, 'INPUT_VALIDATION', `${label}은(는) 1~${maxLength}자로 입력해 주세요.`);
  }
  return normalized;
}

function optionalText(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  return requireText(value, label, maxLength);
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function normalizeTimezone(value: unknown): string {
  const timezone = value === undefined ? DEFAULT_TIMEZONE : requireText(value, '시간대', 80);
  try {
    new Intl.DateTimeFormat('ko-KR', { timeZone: timezone }).format();
  } catch {
    throw new UserHomeApiError(400, 'INPUT_VALIDATION', '시간대가 올바르지 않아요.');
  }
  return timezone;
}

function normalizeEmoji(value: unknown): string {
  const emoji = value === undefined ? '🏠' : requireText(value, '집 아이콘', 16);
  return emoji;
}

function normalizeRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new UserHomeApiError(400, 'INPUT_VALIDATION', '동기화 버전이 올바르지 않아요.');
  }
  return Number(value);
}

function normalizeNotifications(value: unknown): NotificationSettings {
  if (!isObject(value)
    || typeof value.enabled !== 'boolean'
    || !Number.isInteger(value.reminderHour)
    || Number(value.reminderHour) < 0
    || Number(value.reminderHour) > 23) {
    throw new UserHomeApiError(400, 'INPUT_VALIDATION', '알림 설정이 올바르지 않아요.');
  }
  return { enabled: value.enabled, reminderHour: Number(value.reminderHour) };
}

function normalizeProfile(value: unknown): HomeProfile | null {
  if (value === null) return null;
  if (!isObject(value)) throw new UserHomeApiError(400, 'INPUT_VALIDATION', '집 프로필 형식이 올바르지 않아요.');
  const householdTypes = ['single', 'couple', 'family', 'shared'];
  const housingTenures = ['monthly-rent', 'jeonse', 'owned'];
  const petTypes = ['dog', 'cat', 'fish', 'bird', 'small-animal', 'reptile', 'other'];
  if (!householdTypes.includes(stringValue(value.householdType))) throw new UserHomeApiError(400, 'INPUT_VALIDATION', '가구 형태가 올바르지 않아요.');
  if (value.housingTenure !== undefined && !housingTenures.includes(stringValue(value.housingTenure))) throw new UserHomeApiError(400, 'INPUT_VALIDATION', '거주 형태가 올바르지 않아요.');
  for (const field of ['memberCount', 'roomCount', 'bathroomCount'] as const) {
    if (!Number.isInteger(value[field]) || Number(value[field]) < 0 || Number(value[field]) > 30) {
      throw new UserHomeApiError(400, 'INPUT_VALIDATION', '가구원·방·욕실 수가 올바르지 않아요.');
    }
  }
  if (typeof value.hasPets !== 'boolean' || typeof value.completed !== 'boolean') throw new UserHomeApiError(400, 'INPUT_VALIDATION', '집 프로필 상태가 올바르지 않아요.');
  if (!Array.isArray(value.petTypes) || value.petTypes.some((type) => !petTypes.includes(String(type)))) throw new UserHomeApiError(400, 'INPUT_VALIDATION', '반려동물 종류가 올바르지 않아요.');
  if (value.childAges !== undefined && (!Array.isArray(value.childAges) || value.childAges.length > 20 || value.childAges.some((age) => !Number.isInteger(age) || Number(age) < 0 || Number(age) > 25))) {
    throw new UserHomeApiError(400, 'INPUT_VALIDATION', '아이 나이가 올바르지 않아요.');
  }
  if (value.petCounts !== undefined) {
    if (!isObject(value.petCounts) || Object.entries(value.petCounts).some(([type, count]) => !petTypes.includes(type) || !Number.isInteger(count) || Number(count) < 0 || Number(count) > 30)) {
      throw new UserHomeApiError(400, 'INPUT_VALIDATION', '반려동물 마릿수가 올바르지 않아요.');
    }
  }
  return value as unknown as HomeProfile;
}

export function parseUpdateMeInput(value: unknown): UpdateMeInput {
  if (!isObject(value)) throw new UserHomeApiError(400, 'INPUT_VALIDATION', '사용자 정보 형식이 올바르지 않아요.');
  const input: UpdateMeInput = {};
  if (value.displayName !== undefined) input.displayName = requireText(value.displayName, '이름', 40);
  if ('activeHomeId' in value) input.activeHomeId = value.activeHomeId === null ? null : requireText(value.activeHomeId, '집 ID', 120);
  if (value.notifications !== undefined) input.notifications = normalizeNotifications(value.notifications);
  if (Object.keys(input).length === 0) throw new UserHomeApiError(400, 'INPUT_VALIDATION', '변경할 사용자 정보를 입력해 주세요.');
  return input;
}

export function parseCreateHomeInput(value: unknown): CreateHomeInput {
  if (!isObject(value)) throw new UserHomeApiError(400, 'INPUT_VALIDATION', '집 정보 형식이 올바르지 않아요.');
  return {
    name: requireText(value.name, '집 이름', 60),
    emoji: normalizeEmoji(value.emoji),
    timezone: normalizeTimezone(value.timezone),
    profile: value.profile === undefined ? null : normalizeProfile(value.profile),
  };
}

export function parseUpdateHomeInput(value: unknown): UpdateHomeInput {
  if (!isObject(value)) throw new UserHomeApiError(400, 'INPUT_VALIDATION', '집 정보 형식이 올바르지 않아요.');
  const input: UpdateHomeInput = { expectedRevision: normalizeRevision(value.expectedRevision) };
  input.name = optionalText(value.name, '집 이름', 60);
  if (value.emoji !== undefined) input.emoji = normalizeEmoji(value.emoji);
  if (value.timezone !== undefined) input.timezone = normalizeTimezone(value.timezone);
  if ('profile' in value) input.profile = normalizeProfile(value.profile);
  if (Object.keys(input).length === 1) throw new UserHomeApiError(400, 'INPUT_VALIDATION', '변경할 집 정보를 입력해 주세요.');
  return input;
}

export function parseCompleteChoreInput(value: unknown): CompleteChoreRequest {
  if (!isObject(value) || !isDateKey(value.scheduledFor) || typeof value.clientRequestId !== 'string' || !UUID_PATTERN.test(value.clientRequestId)) {
    throw new UserHomeApiError(400, 'INPUT_VALIDATION', '완료할 예정일과 요청 ID를 확인해 주세요.');
  }
  return { scheduledFor: value.scheduledFor, clientRequestId: value.clientRequestId };
}

export function parseAssignChoreInput(value: unknown): AssignChoreRequest {
  if (!isObject(value) || !('assigneeMembershipId' in value)) throw new UserHomeApiError(400, 'INPUT_VALIDATION', '담당자 정보를 입력해 주세요.');
  const assigneeMembershipId = value.assigneeMembershipId === null
    ? null
    : requireText(value.assigneeMembershipId, '담당자 ID', 160);
  return { assigneeMembershipId, expectedRevision: normalizeRevision(value.expectedRevision) };
}

export function routeParam(value: string | string[] | undefined, label: string): string {
  const normalized = Array.isArray(value) ? value[0] : value;
  return requireText(normalized, label, 160);
}

async function ensureUser(db: Db, userId: string): Promise<Row> {
  const { error: insertError } = await db.from('app_users').upsert(
    { id: userId, user_type: 'anonymous' },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (insertError) throw insertError;
  const { data, error } = await db.from('app_users').select('*').eq('id', userId).single();
  if (error) throw error;
  const user = data as Row;
  if (stringValue(user.status, 'active') !== 'active') {
    throw new UserHomeApiError(403, 'ACCOUNT_INACTIVE', '현재 사용할 수 없는 계정이에요.');
  }
  return user;
}

function apiUser(row: Row, fallbackId: string): ApiUserDto {
  return {
    id: stringValue(row.id, fallbackId),
    displayName: stringValue(row.display_name, '나'),
    avatarUrl: nullableString(row.avatar_url),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at, stringValue(row.created_at)),
  };
}

export async function getSessionUser(userId: string): Promise<ApiUserDto> {
  return apiUser(await ensureUser(getSupabaseAdmin(), userId), userId);
}

function membershipStatus(row: Row): 'active' | 'left' | 'removed' {
  const status = stringValue(row.status, 'active');
  return status === 'left' || status === 'removed' ? status : 'active';
}

async function requireMembership(db: Db, userId: string, homeId: string, ownerOnly = false): Promise<Row> {
  const { data, error } = await db.from('home_members').select('*').eq('home_id', homeId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  const membership = isObject(data) ? data : null;
  if (!membership || membershipStatus(membership) !== 'active') {
    throw new UserHomeApiError(403, 'HOME_FORBIDDEN', '이 집에 접근할 권한이 없어요.');
  }
  if (ownerOnly && membership.role !== 'owner') {
    throw new UserHomeApiError(403, 'OWNER_REQUIRED', '집 소유자만 변경할 수 있어요.');
  }
  return membership;
}

async function activeMembershipRows(db: Db, userId: string): Promise<Row[]> {
  const { data, error } = await db.from('home_members').select('*').eq('user_id', userId);
  if (error) throw error;
  return rows(data).filter((membership) => membershipStatus(membership) === 'active');
}

function homeSummary(home: Row, activeMemberCount: number, profile: HomeProfile | null): HomeSummaryDto {
  return {
    id: stringValue(home.id),
    name: stringValue(home.name, '우리 집'),
    emoji: stringValue(home.emoji, '🏠'),
    activeMemberCount,
    profileCompleted: profile?.completed === true,
    revision: numericValue(home.sync_revision),
    createdAt: stringValue(home.created_at),
    updatedAt: stringValue(home.updated_at, stringValue(home.created_at)),
  };
}

async function membershipSummaries(db: Db, userId: string): Promise<HomeMembershipSummaryDto[]> {
  const memberships = await activeMembershipRows(db, userId);
  const homeIds = memberships.map((membership) => stringValue(membership.home_id)).filter(Boolean);
  if (homeIds.length === 0) return [];
  const [homesResult, profilesResult, allMembersResult] = await Promise.all([
    db.from('homes').select('*').in('id', homeIds).eq('status', 'active'),
    db.from('home_profiles').select('*').in('home_id', homeIds),
    db.from('home_members').select('*').in('home_id', homeIds),
  ]);
  for (const result of [homesResult, profilesResult, allMembersResult]) if (result.error) throw result.error;
  const homesById = new Map(rows(homesResult.data).map((home) => [stringValue(home.id), home]));
  const profileByHome = new Map(rows(profilesResult.data).map((item) => [stringValue(item.home_id), (item.profile ?? null) as HomeProfile | null]));
  const memberCounts = new Map<string, number>();
  for (const member of rows(allMembersResult.data)) {
    if (membershipStatus(member) !== 'active') continue;
    const homeId = stringValue(member.home_id);
    memberCounts.set(homeId, (memberCounts.get(homeId) ?? 0) + 1);
  }
  return memberships.flatMap((membership) => {
    const homeId = stringValue(membership.home_id);
    const home = homesById.get(homeId);
    if (!home) return [];
    return [{
      id: stringValue(membership.id),
      role: membership.role === 'owner' ? 'owner' : 'member',
      status: 'active' as const,
      joinedAt: stringValue(membership.joined_at),
      home: homeSummary(home, memberCounts.get(homeId) ?? 1, profileByHome.get(homeId) ?? null),
    }];
  });
}

async function loadProfileInsights(db: Db, userId: string): Promise<MeDto['insights']> {
  const categoryCounts = normalizeProfileCategoryCounts({});
  // Count in PostgreSQL rather than downloading lifetime history into each
  // short-lived Vercel invocation. category_snapshot is mandatory after the
  // v2 migration, so later chore edits/deletes cannot rewrite the tendency.
  const countResults = await Promise.all(CHORE_CATEGORIES.map((category) => db.from('chore_history')
    .select('id', { count: 'exact', head: true })
    .eq('performed_by_user_id', userId)
    .eq('action', 'completed')
    .eq('status', 'completed')
    .eq('category_snapshot', category)));
  for (const [index, result] of countResults.entries()) {
    if (result.error) throw result.error;
    categoryCounts[CHORE_CATEGORIES[index]] = result.count ?? 0;
  }
  const calculated = getProfileInsightsFromCategoryCounts(categoryCounts);
  return {
    completedCount: calculated.completedCount,
    categoryCounts: calculated.categoryCounts,
    level: { ...calculated.level, nextLevelAt: calculated.level.level * 10 },
    tendency: {
      ...calculated.tendency,
      key: profileTendencyKey(calculated.tendency),
      sampleSize: calculated.tendencySampleSize,
    },
    algorithmVersion: PROFILE_ALGORITHM_VERSION,
    computedAt: new Date().toISOString(),
  };
}

export async function getMe(userId: string): Promise<MeDto> {
  const db = getSupabaseAdmin();
  const user = await ensureUser(db, userId);
  const [settingsResult, memberships, insights] = await Promise.all([
    db.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    membershipSummaries(db, userId),
    loadProfileInsights(db, userId),
  ]);
  if (settingsResult.error) throw settingsResult.error;
  const settings = isObject(settingsResult.data) ? settingsResult.data : null;
  const requestedActiveHomeId = nullableString(settings?.active_home_id);
  const activeHomeId = memberships.some((membership) => membership.home.id === requestedActiveHomeId)
    ? requestedActiveHomeId
    : memberships[0]?.home.id ?? null;
  const storedNotifications = isObject(settings?.notifications) ? settings.notifications : DEFAULT_NOTIFICATIONS;
  const notifications = typeof storedNotifications.enabled === 'boolean' && Number.isInteger(storedNotifications.reminderHour)
    ? { enabled: storedNotifications.enabled, reminderHour: Number(storedNotifications.reminderHour) }
    : DEFAULT_NOTIFICATIONS;
  return {
    user: apiUser(user, userId),
    settings: { activeHomeId, notifications },
    insights,
    memberships,
  };
}

export async function updateMe(userId: string, input: UpdateMeInput): Promise<MeDto> {
  const db = getSupabaseAdmin();
  await ensureUser(db, userId);
  if (input.activeHomeId) await requireMembership(db, userId, input.activeHomeId);
  if (input.displayName !== undefined) {
    const { error } = await db.from('app_users').update({ display_name: input.displayName, updated_at: new Date().toISOString() }).eq('id', userId);
    if (error) throw error;
    const { error: membershipError } = await db.from('home_members')
      .update({ display_name_snapshot: input.displayName, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active');
    if (membershipError) throw membershipError;
  }
  if (input.activeHomeId !== undefined || input.notifications !== undefined) {
    const values: Row = { user_id: userId, updated_at: new Date().toISOString() };
    if (input.activeHomeId !== undefined) values.active_home_id = input.activeHomeId;
    if (input.notifications !== undefined) values.notifications = input.notifications;
    const { error } = await db.from('user_settings').upsert(values, { onConflict: 'user_id' });
    if (error) throw error;
  }
  return getMe(userId);
}

function mapChore(row: Row): ChoreDto {
  const recurrence = isObject(row.recurrence) ? row.recurrence : { interval: 1, unit: 'week' };
  const category = stringValue(row.category, 'etc') as ChoreCategory;
  return {
    id: stringValue(row.id),
    title: stringValue(row.title),
    category: CHORE_CATEGORIES.includes(category) ? category : 'etc',
    icon: nullableString(row.icon) ?? undefined,
    recurrence: {
      interval: Math.max(1, Math.floor(numericValue(recurrence.interval, 1))),
      unit: ['day', 'week', 'month', 'year'].includes(stringValue(recurrence.unit))
        ? stringValue(recurrence.unit) as ChoreDto['recurrence']['unit']
        : 'week',
    },
    createdAt: stringValue(row.created_at ?? row.createdAt),
    scheduleAnchorDate: nullableString(row.schedule_anchor_date ?? row.scheduleAnchorDate) ?? undefined,
    nextDueDate: stringValue(row.next_due_date ?? row.nextDueDate),
    isCustom: booleanValue(row.is_custom ?? row.isCustom),
    enabled: booleanValue(row.enabled, true),
    assigneeMembershipId: nullableString(row.assigneeMembershipId ?? row.assignee_membership_id ?? row.assigned_member_id ?? row.executor_member_id),
    notificationEnabled: booleanValue(row.notification_enabled ?? row.notificationEnabled),
    notificationTime: nullableString(row.notification_time ?? row.notificationTime)?.slice(0, 5),
  };
}

function mapSupply(row: Row): SupplyItem {
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    unit: stringValue(row.unit),
    purchaseDate: stringValue(row.purchase_date),
    purchaseQuantity: numericValue(row.purchase_quantity),
    weeklyUsage: numericValue(row.weekly_usage),
    safetyStock: numericValue(row.safety_stock),
    reminderDaysBefore: numericValue(row.reminder_days_before),
    updatedAt: stringValue(row.updated_at),
  };
}

function completionDto(
  raw: Row,
  homeId: string,
  choresById: Map<string, ChoreDto>,
  membershipsByUserId: Map<string, HomeMemberDto>,
  membersById: Map<string, HomeMemberDto>,
): CompletionDto {
  const performedByRaw = isObject(raw.performedBy) ? raw.performedBy : null;
  const performedUserId = nullableString(performedByRaw?.userId ?? raw.performed_by_user_id);
  const storedPerformerMembershipId = nullableString(performedByRaw?.membershipId ?? raw.performed_by_membership_id);
  const performerMembership = (storedPerformerMembershipId ? membersById.get(storedPerformerMembershipId) : undefined)
    ?? (performedUserId ? membershipsByUserId.get(performedUserId) : undefined);
  const choreId = stringValue(raw.choreId ?? raw.chore_id);
  const chore = choresById.get(choreId);
  const scheduledFor = stringValue(raw.scheduledFor ?? raw.scheduled_for);
  const assigneeRaw = isObject(raw.assigneeSnapshot) ? raw.assigneeSnapshot : null;
  const assigneeMembershipId = nullableString(assigneeRaw?.membershipId ?? raw.assignee_membership_id_snapshot ?? raw.assignee_membership_id);
  const assigneeMember = assigneeMembershipId ? membersById.get(assigneeMembershipId) : undefined;
  const assigneeName = nullableString(assigneeRaw?.displayName ?? raw.assignee_name_snapshot ?? raw.assignee_display_name_snapshot)
    ?? assigneeMember?.displayName
    ?? (assigneeMembershipId ? '이전 구성원' : null);
  const assigneeSnapshot = assigneeMembershipId && assigneeName
    ? { membershipId: assigneeMembershipId, displayName: assigneeName }
    : null;
  const completedByAssignee = typeof raw.completedByAssignee === 'boolean'
    ? raw.completedByAssignee
    : assigneeSnapshot
      ? assigneeSnapshot.membershipId === (performerMembership?.id ?? storedPerformerMembershipId)
      : null;
  const category = stringValue(raw.chore_category_snapshot ?? raw.category_snapshot ?? (isObject(raw.choreSnapshot) ? raw.choreSnapshot.category : undefined) ?? chore?.category, 'etc') as ChoreCategory;
  return {
    id: stringValue(raw.id),
    homeId: stringValue(raw.homeId ?? raw.home_id, homeId),
    occurrenceId: stringValue(raw.occurrenceId ?? raw.occurrence_id, choreOccurrenceId(homeId, choreId, scheduledFor)),
    choreId,
    scheduledFor,
    status: stringValue(raw.status) === 'voided' || raw.voided_at != null ? 'voided' : 'completed',
    choreSnapshot: {
      title: stringValue(raw.chore_title_snapshot ?? raw.chore_title ?? (isObject(raw.choreSnapshot) ? raw.choreSnapshot.title : undefined), chore?.title ?? '집안일'),
      category: CHORE_CATEGORIES.includes(category) ? category : 'etc',
    },
    performedAt: stringValue(raw.performedAt ?? raw.performed_at),
    performedBy: {
      membershipId: nullableString(performedByRaw?.membershipId) ?? performerMembership?.id ?? storedPerformerMembershipId,
      userId: nullableString(performedByRaw?.userId) ?? performedUserId,
      displayName: stringValue(performedByRaw?.displayName ?? raw.performed_by_name, performerMembership?.displayName ?? '이전 구성원'),
    },
    assigneeSnapshot,
    completedByAssignee,
    voidedAt: nullableString(raw.voidedAt ?? raw.voided_at),
  };
}

function dateKeyInTimezone(value: string | Date, timezone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}`;
}

export async function listHomes(userId: string): Promise<HomeMembershipSummaryDto[]> {
  const db = getSupabaseAdmin();
  await ensureUser(db, userId);
  return membershipSummaries(db, userId);
}

export async function getHome(userId: string, homeId: string): Promise<HomeDetailDto> {
  const db = getSupabaseAdmin();
  await ensureUser(db, userId);
  const currentMembershipRow = await requireMembership(db, userId, homeId);
  const [homeResult, profileResult, membersResult, choresResult, historyResult, suppliesResult, preferencesResult] = await Promise.all([
    db.from('homes').select('*').eq('id', homeId).maybeSingle(),
    db.from('home_profiles').select('*').eq('home_id', homeId).maybeSingle(),
    db.from('home_members').select('*').eq('home_id', homeId),
    db.from('chores').select('*').eq('home_id', homeId).order('next_due_date', { ascending: true }),
    db.from('chore_history').select('*').eq('home_id', homeId).order('performed_at', { ascending: false }).limit(100),
    db.from('supply_items').select('*').eq('home_id', homeId),
    db.from('recommendation_preferences').select('*').eq('home_id', homeId),
  ]);
  for (const result of [homeResult, profileResult, membersResult, choresResult, historyResult, suppliesResult, preferencesResult]) if (result.error) throw result.error;
  if (!isObject(homeResult.data) || stringValue(homeResult.data.status, 'active') !== 'active') throw new UserHomeApiError(404, 'HOME_NOT_FOUND', '집을 찾지 못했어요.');
  const homeRow = homeResult.data;
  const memberRows = rows(membersResult.data).filter((member) => membershipStatus(member) === 'active');
  const memberUserIds = [...new Set(memberRows.map((member) => stringValue(member.user_id)).filter(Boolean))];
  const userResult = memberUserIds.length
    ? await db.from('app_users').select('*').in('id', memberUserIds)
    : { data: [], error: null };
  if (userResult.error) throw userResult.error;
  const usersById = new Map(rows(userResult.data).map((user) => [stringValue(user.id), user]));
  const members: HomeMemberDto[] = memberRows.map((member) => {
    const memberUserId = stringValue(member.user_id);
    const memberUser = usersById.get(memberUserId);
    return {
      id: stringValue(member.id),
      userId: memberUserId,
      displayName: stringValue(memberUser?.display_name, stringValue(member.display_name_snapshot, '구성원')),
      avatarUrl: nullableString(memberUser?.avatar_url),
      role: member.role === 'owner' ? 'owner' : 'member',
      status: membershipStatus(member),
      joinedAt: stringValue(member.joined_at),
      endedAt: nullableString(member.ended_at),
      isCurrentUser: memberUserId === userId,
    };
  });
  const membershipsByUserId = new Map(members.map((member) => [member.userId, member]));
  const membersById = new Map(members.map((member) => [member.id, member]));
  const chores = rows(choresResult.data).map(mapChore);
  const choresById = new Map(chores.map((chore) => [chore.id, chore]));
  const recentCompletions = rows(historyResult.data)
    .filter((history) => stringValue(history.action) === 'completed')
    .map((history) => completionDto(history, homeId, choresById, membershipsByUserId, membersById))
    .slice(0, 30);
  const profile = isObject(profileResult.data) ? (profileResult.data.profile ?? null) as HomeProfile | null : null;
  const timezone = stringValue(homeRow.timezone, DEFAULT_TIMEZONE);
  const today = dateKeyInTimezone(new Date(), timezone);
  const occurrenceById = new Map<string, ChoreOccurrenceDto>();
  for (const chore of chores.filter((item) => item.enabled && item.nextDueDate <= today)) {
    const pendingOccurrenceId = choreOccurrenceId(homeId, chore.id, chore.nextDueDate);
    occurrenceById.set(pendingOccurrenceId, {
      occurrenceId: pendingOccurrenceId,
      homeId,
      choreId: chore.id,
      scheduledFor: chore.nextDueDate,
      status: 'pending',
      isOverdue: chore.nextDueDate < today,
      chore,
      completion: null,
    });
  }
  for (const completion of recentCompletions) {
    if (completion.status !== 'completed' || dateKeyInTimezone(completion.performedAt, timezone) !== today) continue;
    const chore = choresById.get(completion.choreId);
    if (!chore) continue;
    occurrenceById.set(completion.occurrenceId, {
      occurrenceId: completion.occurrenceId,
      homeId,
      choreId: completion.choreId,
      scheduledFor: completion.scheduledFor,
      status: 'completed',
      isOverdue: completion.scheduledFor < today,
      chore,
      completion,
    });
  }
  const todayItems = [...occurrenceById.values()].sort((left, right) => {
    const byDate = left.scheduledFor.localeCompare(right.scheduledFor);
    if (byDate) return byDate;
    const leftTitle = left.chore?.title ?? left.completion?.choreSnapshot.title ?? '';
    const rightTitle = right.chore?.title ?? right.completion?.choreSnapshot.title ?? '';
    return leftTitle.localeCompare(rightTitle);
  });
  const activeMemberCount = members.filter((member) => member.status === 'active').length;
  const summary = homeSummary(homeRow, activeMemberCount, profile);
  const role = currentMembershipRow.role === 'owner' ? 'owner' : 'member';
  return {
    home: {
      ...summary,
      timezone,
      taskViewMode: homeRow.task_view_mode === 'quest' ? 'quest' : 'todo',
      assignmentMode: homeRow.assignment_mode === 'auto' ? 'auto' : 'shared',
    },
    currentMembership: {
      id: stringValue(currentMembershipRow.id),
      userId,
      role,
      status: 'active',
      joinedAt: stringValue(currentMembershipRow.joined_at),
    },
    permissions: {
      canEditHome: role === 'owner',
      canManageMembers: role === 'owner',
      canManageInvites: role === 'owner',
      canDeleteHome: role === 'owner',
      canManageChores: true,
      canCompleteChores: true,
      canViewHistory: true,
    },
    profile,
    members,
    chores,
    today: {
      date: today,
      dueCount: todayItems.length,
      completedCount: todayItems.filter((item) => item.status === 'completed').length,
      items: todayItems,
    },
    recentCompletions,
    supplies: rows(suppliesResult.data).map(mapSupply),
    preferences: {
      recommendations: rows(preferencesResult.data).map((item): RecommendationPreference => ({
        templateId: stringValue(item.template_id),
        status: ['active', 'dismissed', 'snoozed'].includes(stringValue(item.status))
          ? stringValue(item.status) as RecommendationPreference['status']
          : 'active',
        reason: nullableString(item.reason) as RecommendationPreference['reason'],
        snoozedUntil: nullableString(item.snoozed_until) ?? undefined,
        updatedAt: stringValue(item.updated_at),
      })),
    },
  };
}

export async function createHome(userId: string, input: CreateHomeInput): Promise<HomeDetailDto> {
  const db = getSupabaseAdmin();
  await ensureUser(db, userId);
  const { data, error } = await db.rpc('create_home_v2', {
    p_user_id: userId,
    p_name: input.name,
    p_emoji: input.emoji ?? '🏠',
    p_timezone: input.timezone ?? DEFAULT_TIMEZONE,
    p_profile: input.profile ?? null,
  });
  if (error) throw error;
  const payload = rpcPayload(data);
  const nestedHome = isObject(payload.home) ? payload.home : null;
  const homeId = stringValue(payload.homeId ?? payload.home_id ?? payload.id ?? nestedHome?.id);
  if (!homeId) throw new UserHomeApiError(500, 'INVALID_DATABASE_RESPONSE', '생성된 집 정보를 확인하지 못했어요.');
  return getHome(userId, homeId);
}

export async function updateHome(userId: string, homeId: string, input: UpdateHomeInput): Promise<HomeDetailDto> {
  const db = getSupabaseAdmin();
  await ensureUser(db, userId);
  await requireMembership(db, userId, homeId, true);
  const current = await getHome(userId, homeId);
  const { error } = await db.rpc('update_home_v2', {
    p_user_id: userId,
    p_home_id: homeId,
    p_expected_revision: input.expectedRevision,
    p_name: input.name ?? current.home.name,
    p_emoji: input.emoji ?? current.home.emoji,
    p_timezone: input.timezone ?? current.home.timezone,
    p_profile: input.profile === undefined ? current.profile : input.profile,
  });
  if (error) throw error;
  return getHome(userId, homeId);
}

export async function assignChore(userId: string, homeId: string, choreId: string, input: AssignChoreRequest): Promise<AssignChoreResponse> {
  const db = getSupabaseAdmin();
  await ensureUser(db, userId);
  await requireMembership(db, userId, homeId);
  if (input.assigneeMembershipId) {
    const { data: assignee, error: assigneeError } = await db.from('home_members').select('*').eq('id', input.assigneeMembershipId).eq('home_id', homeId).maybeSingle();
    if (assigneeError) throw assigneeError;
    if (!isObject(assignee) || membershipStatus(assignee) !== 'active') throw new UserHomeApiError(400, 'INVALID_ASSIGNEE', '이 집의 현재 구성원만 담당자로 지정할 수 있어요.');
  }
  const { data, error } = await db.rpc('assign_chore_v2', {
    p_user_id: userId,
    p_home_id: homeId,
    p_chore_id: choreId,
    p_assignee_membership_id: input.assigneeMembershipId,
    p_expected_revision: input.expectedRevision,
  });
  if (error) throw error;
  const payload = rpcPayload(data);
  const detail = await getHome(userId, homeId);
  const chore = detail.chores.find((item) => item.id === choreId);
  if (!chore) throw new UserHomeApiError(404, 'CHORE_NOT_FOUND', '집안일을 찾지 못했어요.');
  return { chore, homeRevision: numericValue(payload.homeRevision, detail.home.revision) };
}

export function completeChoreResponseFromPayload(
  homeId: string,
  choreId: string,
  payloadValue: unknown,
  preCommitChore: ChoreDto | null,
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
): CompleteChoreResponse {
  const payload = rpcPayload(payloadValue);
  const rawCompletion = isObject(payload.completion) ? payload.completion : null;
  if (!rawCompletion) throw new UserHomeApiError(500, 'INVALID_DATABASE_RESPONSE', '완료 기록을 확인하지 못했어요.');
  const rpcChore = isObject(payload.chore) ? mapChore(payload.chore) : null;
  const choreBeforeResponse = rpcChore ?? preCommitChore;
  const completion = completionDto(
    rawCompletion,
    homeId,
    choreBeforeResponse ? new Map([[choreBeforeResponse.id, choreBeforeResponse]]) : new Map(),
    new Map(),
    new Map(),
  );
  if (completion.status === 'voided') {
    throw new UserHomeApiError(409, 'IDEMPOTENT_COMPLETION_VOIDED', '이 요청으로 만든 완료 기록은 이미 취소됐어요. 다시 완료해 주세요.');
  }
  const nextDueDate = stringValue(payload.nextDueDate, choreBeforeResponse?.nextDueDate ?? completion.scheduledFor);
  const chore = choreBeforeResponse
    ? {
      ...choreBeforeResponse,
      title: completion.choreSnapshot.title,
      category: completion.choreSnapshot.category,
      nextDueDate,
    }
    : null;
  const today = dateKeyInTimezone(now, timezone);
  return {
    occurrence: {
      occurrenceId: completion.occurrenceId,
      homeId,
      choreId,
      scheduledFor: completion.scheduledFor,
      status: 'completed',
      isOverdue: completion.scheduledFor < today,
      chore,
      completion,
    },
    completion,
    alreadyCompleted: booleanValue(payload.alreadyCompleted, !booleanValue(payload.created)),
    idempotentReplay: booleanValue(payload.idempotentReplay),
    nextDueDate,
    homeRevision: numericValue(payload.homeRevision),
  };
}

export async function completeChore(userId: string, homeId: string, choreId: string, input: CompleteChoreRequest): Promise<CompleteChoreResponse> {
  const db = getSupabaseAdmin();
  await ensureUser(db, userId);
  await requireMembership(db, userId, homeId);
  // Read only the timezone before committing. The RPC result carries the
  // immutable chore/completion snapshot, so no post-commit detail fetch can
  // turn a successful action into a 404/500 after deletion or membership loss.
  const homeResult = await db.from('homes').select('timezone').eq('id', homeId).eq('status', 'active').maybeSingle();
  if (homeResult.error) throw homeResult.error;
  const { data, error } = await db.rpc('complete_chore_once', {
    p_user_id: userId,
    p_home_id: homeId,
    p_chore_id: choreId,
    p_scheduled_for: input.scheduledFor,
    p_request_id: input.clientRequestId,
  });
  if (error) throw error;
  const timezone = isObject(homeResult.data) ? stringValue(homeResult.data.timezone, DEFAULT_TIMEZONE) : DEFAULT_TIMEZONE;
  return completeChoreResponseFromPayload(homeId, choreId, data, null, timezone);
}

export function normalizeUserHomeError(error: unknown): UserHomeApiError | null {
  if (error instanceof UserHomeApiError) return error;
  if (!isObject(error)) return null;
  const code = stringValue(error.code);
  const message = stringValue(error.message);
  if (code === '40001' || message.includes('REVISION_CONFLICT') || message.includes('SYNC_CONFLICT')) {
    return new UserHomeApiError(409, 'HOME_REVISION_CONFLICT', '다른 구성원이 먼저 변경했어요. 최신 내용을 다시 불러와 주세요.');
  }
  if (code === '42501' || message.includes('HOME_FORBIDDEN')) return new UserHomeApiError(403, 'HOME_FORBIDDEN', '이 집에 접근할 권한이 없어요.');
  if (message.includes('OWNER_REQUIRED')) return new UserHomeApiError(403, 'OWNER_REQUIRED', '집 소유자만 변경할 수 있어요.');
  if (message.includes('HOME_NOT_FOUND')) return new UserHomeApiError(404, 'HOME_NOT_FOUND', '집을 찾지 못했어요.');
  if (message.includes('CHORE_NOT_FOUND')) return new UserHomeApiError(404, 'CHORE_NOT_FOUND', '집안일을 찾지 못했어요.');
  if (message.includes('INVALID_ASSIGNEE') || message.includes('ASSIGNEE_NOT_ACTIVE_HOME_MEMBER')) return new UserHomeApiError(400, 'INVALID_ASSIGNEE', '이 집의 현재 구성원만 담당자로 지정할 수 있어요.');
  if (message.includes('IDEMPOTENCY_KEY_REUSED')) return new UserHomeApiError(409, 'IDEMPOTENCY_KEY_REUSED', '같은 요청 ID를 다른 완료 건에 사용할 수 없어요.');
  if (message.includes('CHORE_OCCURRENCE_MISMATCH')) return new UserHomeApiError(409, 'CHORE_OCCURRENCE_STALE', '이미 일정이 변경됐어요. 최신 할 일을 다시 확인해 주세요.');
  if (message.includes('CHORE_DISABLED')) return new UserHomeApiError(409, 'CHORE_DISABLED', '사용하지 않는 집안일은 완료할 수 없어요.');
  if (message.includes('CHORE_NOT_DUE')) return new UserHomeApiError(409, 'CHORE_NOT_DUE', '아직 완료할 수 없는 일정이에요.');
  if (code === '22023') return new UserHomeApiError(400, 'INPUT_VALIDATION', '입력한 정보를 다시 확인해 주세요.');
  if (code === '23505') return new UserHomeApiError(409, 'CONFLICT', '이미 처리된 요청이에요.');
  return null;
}
