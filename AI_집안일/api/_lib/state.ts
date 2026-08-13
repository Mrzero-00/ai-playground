import type { AppData, Chore, ChoreHistory, Home, HomeMember, HomeProfile, LaborAssessment, LocalUser, NotificationSettings, RecommendationPreference, SupplyItem } from '../../src/domain/types.js';
import { assertActiveLegacyUser, LegacyStateError, planLegacyHomeMutation } from './legacyState.js';
import { getSupabaseAdmin } from './supabase.js';

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

function stateConflict(): Error {
  const conflict = new Error('다른 구성원이 먼저 변경했어요. 최신 내용을 다시 불러와 주세요.');
  conflict.name = 'SYNC_CONFLICT';
  return conflict;
}

function throwRpcError(error: { code?: string; message?: string }): never {
  if (error.code === '40001' || error.message?.includes('SYNC_CONFLICT')) throw stateConflict();
  if (error.code === '42501' || error.message?.includes('HOME_FORBIDDEN')) throw new Error('You are not a member of this home.');
  throw error;
}

async function ensureUser(db: SupabaseAdmin, userId: string, displayName?: string): Promise<LocalUser> {
  const { error: insertError } = await db.from('app_users').upsert(
    { id: userId, display_name: displayName ?? '나', user_type: 'anonymous' },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (insertError) throw insertError;
  const { data, error } = await db.from('app_users').select('*').eq('id', userId).single();
  if (error) throw error;
  assertActiveLegacyUser(data);
  if (displayName !== undefined) {
    const { data: updatedUser, error: updateError } = await db.from('app_users')
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .eq('status', 'active')
      .select('id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updatedUser) throw new LegacyStateError('ACCOUNT_INACTIVE', '현재 사용할 수 없는 계정이에요.');
    const { error: membershipError } = await db.from('home_members')
      .update({ display_name_snapshot: displayName, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active');
    if (membershipError) throw membershipError;
  }
  return { id: data.id, displayName: displayName ?? data.display_name, createdAt: data.created_at };
}

export async function loadState(userId: string): Promise<AppData> {
  const db = getSupabaseAdmin();
  const user = await ensureUser(db, userId);
  const { data: ownMemberships, error: membershipError } = await db.from('home_members').select('*').eq('user_id', userId).eq('status', 'active');
  if (membershipError) throw membershipError;
  const homeIds = ownMemberships.map((membership) => membership.home_id);
  const { data: settings, error: settingsError } = await db.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  if (settingsError) throw settingsError;
  const notifications: NotificationSettings = settings?.notifications ?? { enabled: false, reminderHour: 9 };

  if (!homeIds.length) return { version: 2, user, homes: [], activeHomeId: null, notifications };

  const [homesResult, membersResult, profilesResult, choresResult, historyResult, assessmentsResult, suppliesResult, preferencesResult] = await Promise.all([
    db.from('homes').select('*').in('id', homeIds).eq('status', 'active'),
    db.from('home_members').select('*').in('home_id', homeIds).eq('status', 'active'),
    db.from('home_profiles').select('*').in('home_id', homeIds),
    db.from('chores').select('*').in('home_id', homeIds),
    db.from('chore_history').select('*').in('home_id', homeIds).eq('status', 'completed').order('performed_at', { ascending: false }),
    db.from('labor_assessments').select('*').in('home_id', homeIds),
    db.from('supply_items').select('*').in('home_id', homeIds),
    db.from('recommendation_preferences').select('*').in('home_id', homeIds),
  ]);
  for (const result of [homesResult, membersResult, profilesResult, choresResult, historyResult, assessmentsResult, suppliesResult, preferencesResult]) if (result.error) throw result.error;

  const storedHomes = homesResult.data ?? [];
  const storedMembers = membersResult.data ?? [];
  const storedProfiles = profilesResult.data ?? [];
  const storedChores = choresResult.data ?? [];
  const storedHistory = historyResult.data ?? [];
  const storedAssessments = assessmentsResult.data ?? [];
  const storedSupplies = suppliesResult.data ?? [];
  const storedPreferences = preferencesResult.data ?? [];

  const memberUserIds = [...new Set(storedMembers.map((member) => member.user_id))];
  const { data: memberUsers, error: memberUsersError } = await db.from('app_users').select('id,display_name').in('id', memberUserIds);
  if (memberUsersError) throw memberUsersError;
  const userNames = new Map(memberUsers.map((member) => [member.id, member.display_name]));
  const profiles = new Map(storedProfiles.map((profile) => [profile.home_id, profile.profile as HomeProfile]));

  const homes: Home[] = storedHomes.map((home) => ({
    id: home.id,
    syncRevision: Number(home.sync_revision ?? 0),
    name: home.name,
    emoji: home.emoji,
    taskViewMode: home.task_view_mode,
    assignmentMode: home.assignment_mode ?? 'shared',
    inviteCode: home.invite_code,
    createdAt: home.created_at,
    profile: profiles.get(home.id) ?? null,
    members: storedMembers.filter((member) => member.home_id === home.id).map((member): HomeMember => ({ id: member.id, userId: member.user_id, displayName: String(userNames.get(member.user_id) ?? '구성원'), role: member.role, joinedAt: member.joined_at })),
    chores: storedChores.filter((chore) => chore.home_id === home.id).map((chore): Chore => ({ id: chore.id, title: chore.title, category: chore.category, recurrence: chore.recurrence, createdAt: chore.created_at, scheduleAnchorDate: chore.schedule_anchor_date ?? undefined, nextDueDate: chore.next_due_date, isCustom: chore.is_custom, enabled: chore.enabled, assignedMemberId: chore.assigned_member_id ?? undefined, executorMemberId: chore.executor_member_id ?? undefined, icon: chore.icon ?? undefined, notificationEnabled: chore.notification_enabled ?? false, notificationTime: chore.notification_time?.slice(0, 5) ?? undefined })),
    recommendationPreferences: storedPreferences.filter((item) => item.home_id === home.id).map((item): RecommendationPreference => ({ templateId: item.template_id, status: item.status, reason: item.reason ?? undefined, snoozedUntil: item.snoozed_until ?? undefined, updatedAt: item.updated_at })),
    history: storedHistory.filter((entry) => entry.home_id === home.id).map((entry): ChoreHistory => ({
      id: entry.id,
      requestId: entry.performed_by_user_id === userId ? entry.request_id ?? undefined : undefined,
      choreId: entry.chore_id,
      choreTitle: entry.chore_title,
      categorySnapshot: entry.category_snapshot ?? undefined,
      action: entry.action,
      performedAt: entry.performed_at,
      scheduledFor: entry.scheduled_for ?? undefined,
      performedByUserId: entry.performed_by_user_id ?? `former:${entry.performed_by_membership_id ?? entry.id}`,
      performedByMembershipId: entry.performed_by_membership_id ?? undefined,
      performedByName: entry.performed_by_name,
      assigneeMembershipIdSnapshot: entry.assignee_membership_id_snapshot ?? undefined,
      assigneeNameSnapshot: entry.assignee_name_snapshot ?? undefined,
      completedByAssignee: entry.assignee_membership_id_snapshot == null
        ? null
        : entry.assignee_membership_id_snapshot === entry.performed_by_membership_id,
    })),
    laborAssessments: storedAssessments.filter((item) => item.home_id === home.id).map((item): LaborAssessment => ({ userId: item.user_id, planningScore: item.planning_score, executionScore: item.execution_score, answers: item.answers, updatedAt: item.updated_at })),
    supplies: storedSupplies.filter((item) => item.home_id === home.id).map((item): SupplyItem => ({ id: item.id, name: item.name, unit: item.unit, purchaseDate: item.purchase_date, purchaseQuantity: Number(item.purchase_quantity), weeklyUsage: Number(item.weekly_usage), safetyStock: Number(item.safety_stock), reminderDaysBefore: item.reminder_days_before, updatedAt: item.updated_at })),
  }));
  const activeHomeId = homes.some((home) => home.id === settings?.active_home_id) ? settings.active_home_id : homes[0]?.id ?? null;
  return { version: 2, user, homes, activeHomeId, notifications };
}

export async function saveState(userId: string, incoming: AppData): Promise<AppData> {
  const db = getSupabaseAdmin();
  await ensureUser(db, userId, incoming.user?.displayName || '나');

  const activeHome = incoming.homes.find((home) => home.id === incoming.activeHomeId);
  if (activeHome) {
    const current = await loadState(userId);
    const currentHome = current.homes.find((home) => home.id === activeHome.id) ?? null;
    const expectedRevision = activeHome.syncRevision ?? 0;
    const serverRevision = currentHome?.syncRevision ?? 0;
    if (currentHome && expectedRevision !== serverRevision) throw stateConflict();

    const plan = planLegacyHomeMutation(currentHome, activeHome, userId);
    // A legacy PUT can represent several logical actions. Keep them inside one
    // database transaction so a late validation/CAS failure cannot leave a
    // partially-applied snapshot that the old client is unable to retry.
    const { error } = await db.rpc('apply_legacy_home_mutation_v2', {
      p_user_id: userId,
      p_client_user_id: incoming.user.id,
      p_home: plan.snapshotHome,
      p_expected_revision: serverRevision,
      p_snapshot_required: plan.snapshotRequired,
      p_assignments: plan.assignments,
      p_completions: plan.completions,
      p_schedules: plan.schedules,
      p_enabled_changes: plan.enabledChanges,
    });
    if (error) throwRpcError(error);
  }

  const activeHomeId = incoming.homes.some((home) => home.id === incoming.activeHomeId) ? incoming.activeHomeId : incoming.homes[0]?.id ?? null;
  const { error: settingsError } = await db.from('user_settings').upsert({ user_id: userId, notifications: incoming.notifications, active_home_id: activeHomeId, updated_at: new Date().toISOString() });
  if (settingsError) throw settingsError;
  return loadState(userId);
}

export async function joinHome(userId: string, inviteCode: string): Promise<AppData> {
  const db = getSupabaseAdmin();
  await ensureUser(db, userId);
  const { error } = await db.rpc('join_home_by_invite_code', {
    p_user_id: userId,
    p_invite_code: inviteCode.trim().toUpperCase(),
  });
  if (error) {
    if (error.code === 'P0002' || error.message.includes('HOME_NOT_FOUND')) {
      throw new Error('초대 코드에 해당하는 집을 찾을 수 없어요.');
    }
    throw error;
  }
  return loadState(userId);
}
