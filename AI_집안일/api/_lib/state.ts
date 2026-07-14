import { randomUUID } from 'node:crypto';
import type { AppData, Chore, ChoreHistory, Home, HomeMember, HomeProfile, LaborAssessment, LocalUser, NotificationSettings, SupplyItem } from '../../src/domain/types';
import { getSupabaseAdmin } from './supabase';

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

async function ensureUser(db: SupabaseAdmin, userId: string, displayName = '나'): Promise<LocalUser> {
  const { data, error } = await db.from('app_users').upsert({ id: userId, display_name: displayName, user_type: 'anonymous', updated_at: new Date().toISOString() }, { onConflict: 'id' }).select().single();
  if (error) throw error;
  return { id: data.id, displayName: data.display_name, createdAt: data.created_at };
}

export async function loadState(userId: string): Promise<AppData> {
  const db = getSupabaseAdmin();
  const user = await ensureUser(db, userId);
  const { data: ownMemberships, error: membershipError } = await db.from('home_members').select('*').eq('user_id', userId);
  if (membershipError) throw membershipError;
  const homeIds = ownMemberships.map((membership) => membership.home_id);
  const { data: settings, error: settingsError } = await db.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  if (settingsError) throw settingsError;
  const notifications: NotificationSettings = settings?.notifications ?? { enabled: false, reminderHour: 9 };

  if (!homeIds.length) return { version: 2, user, homes: [], activeHomeId: null, notifications };

  const [homesResult, membersResult, profilesResult, choresResult, historyResult, assessmentsResult, suppliesResult] = await Promise.all([
    db.from('homes').select('*').in('id', homeIds),
    db.from('home_members').select('*').in('home_id', homeIds),
    db.from('home_profiles').select('*').in('home_id', homeIds),
    db.from('chores').select('*').in('home_id', homeIds),
    db.from('chore_history').select('*').in('home_id', homeIds).order('performed_at', { ascending: false }),
    db.from('labor_assessments').select('*').in('home_id', homeIds),
    db.from('supply_items').select('*').in('home_id', homeIds),
  ]);
  for (const result of [homesResult, membersResult, profilesResult, choresResult, historyResult, assessmentsResult, suppliesResult]) if (result.error) throw result.error;

  const storedHomes = homesResult.data ?? [];
  const storedMembers = membersResult.data ?? [];
  const storedProfiles = profilesResult.data ?? [];
  const storedChores = choresResult.data ?? [];
  const storedHistory = historyResult.data ?? [];
  const storedAssessments = assessmentsResult.data ?? [];
  const storedSupplies = suppliesResult.data ?? [];

  const memberUserIds = [...new Set(storedMembers.map((member) => member.user_id))];
  const { data: memberUsers, error: memberUsersError } = await db.from('app_users').select('id,display_name').in('id', memberUserIds);
  if (memberUsersError) throw memberUsersError;
  const userNames = new Map(memberUsers.map((member) => [member.id, member.display_name]));
  const profiles = new Map(storedProfiles.map((profile) => [profile.home_id, profile.profile as HomeProfile]));

  const homes: Home[] = storedHomes.map((home) => ({
    id: home.id,
    name: home.name,
    emoji: home.emoji,
    taskViewMode: home.task_view_mode,
    assignmentMode: home.assignment_mode ?? 'shared',
    inviteCode: home.invite_code,
    createdAt: home.created_at,
    profile: profiles.get(home.id) ?? null,
    members: storedMembers.filter((member) => member.home_id === home.id).map((member): HomeMember => ({ id: member.id, userId: member.user_id, displayName: userNames.get(member.user_id) ?? '구성원', role: member.role, joinedAt: member.joined_at })),
    chores: storedChores.filter((chore) => chore.home_id === home.id).map((chore): Chore => ({ id: chore.id, title: chore.title, category: chore.category, recurrence: chore.recurrence, createdAt: chore.created_at, scheduleAnchorDate: chore.schedule_anchor_date ?? undefined, nextDueDate: chore.next_due_date, isCustom: chore.is_custom, enabled: chore.enabled, assignedMemberId: chore.assigned_member_id ?? undefined, executorMemberId: chore.executor_member_id ?? undefined })),
    history: storedHistory.filter((entry) => entry.home_id === home.id).map((entry): ChoreHistory => ({ id: entry.id, choreId: entry.chore_id, choreTitle: entry.chore_title, action: entry.action, performedAt: entry.performed_at, scheduledFor: entry.scheduled_for ?? undefined, performedByUserId: entry.performed_by_user_id, performedByName: entry.performed_by_name })),
    laborAssessments: storedAssessments.filter((item) => item.home_id === home.id).map((item): LaborAssessment => ({ userId: item.user_id, planningScore: item.planning_score, executionScore: item.execution_score, answers: item.answers, updatedAt: item.updated_at })),
    supplies: storedSupplies.filter((item) => item.home_id === home.id).map((item): SupplyItem => ({ id: item.id, name: item.name, unit: item.unit, purchaseDate: item.purchase_date, purchaseQuantity: Number(item.purchase_quantity), weeklyUsage: Number(item.weekly_usage), safetyStock: Number(item.safety_stock), reminderDaysBefore: item.reminder_days_before, updatedAt: item.updated_at })),
  }));
  const activeHomeId = homes.some((home) => home.id === settings?.active_home_id) ? settings.active_home_id : homes[0]?.id ?? null;
  return { version: 2, user, homes, activeHomeId, notifications };
}

async function assertOrCreateMembership(db: SupabaseAdmin, userId: string, home: Home): Promise<void> {
  const { data: storedHome, error: homeLookupError } = await db.from('homes').select('id').eq('id', home.id).maybeSingle();
  if (homeLookupError) throw homeLookupError;
  if (storedHome) {
    const { data: membership, error } = await db.from('home_members').select('id').eq('home_id', home.id).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    if (!membership) throw new Error('You are not a member of this home.');
    return;
  }
  const { error: createError } = await db.from('homes').insert({ id: home.id, name: home.name, emoji: home.emoji, task_view_mode: home.taskViewMode ?? 'todo', invite_code: home.inviteCode, created_at: home.createdAt });
  if (createError) throw createError;
  const { error: memberError } = await db.from('home_members').insert({ id: `member-${randomUUID()}`, home_id: home.id, user_id: userId, role: 'owner' });
  if (memberError) throw memberError;
}

export async function saveState(userId: string, incoming: AppData): Promise<AppData> {
  const db = getSupabaseAdmin();
  await ensureUser(db, userId, incoming.user?.displayName || '나');

  for (const home of incoming.homes ?? []) {
    await assertOrCreateMembership(db, userId, home);
    const { error: homeError } = await db.from('homes').update({ name: home.name, emoji: home.emoji, task_view_mode: home.taskViewMode ?? 'todo', assignment_mode: home.assignmentMode ?? 'shared', updated_at: new Date().toISOString() }).eq('id', home.id);
    if (homeError) throw homeError;
    if (home.profile) {
      const { error } = await db.from('home_profiles').upsert({ home_id: home.id, profile: home.profile, updated_at: new Date().toISOString() });
      if (error) throw error;
    }

    const choreRows = home.chores.map((chore) => ({ home_id: home.id, id: chore.id, title: chore.title, category: chore.category, recurrence: chore.recurrence, created_at: chore.createdAt, schedule_anchor_date: chore.scheduleAnchorDate ?? null, next_due_date: chore.nextDueDate, is_custom: chore.isCustom, enabled: chore.enabled, assigned_member_id: chore.assignedMemberId ?? null, executor_member_id: chore.executorMemberId ?? null, updated_at: new Date().toISOString() }));
    if (choreRows.length) {
      const { error } = await db.from('chores').upsert(choreRows, { onConflict: 'home_id,id' });
      if (error) throw error;
    }
    const { data: storedChores, error: storedChoresError } = await db.from('chores').select('id').eq('home_id', home.id);
    if (storedChoresError) throw storedChoresError;
    const incomingChoreIds = new Set(home.chores.map((chore) => chore.id));
    const deleteIds = storedChores.filter((chore) => !incomingChoreIds.has(chore.id)).map((chore) => chore.id);
    if (deleteIds.length) {
      const { error } = await db.from('chores').delete().eq('home_id', home.id).in('id', deleteIds);
      if (error) throw error;
    }

    const historyRows = home.history.map((entry) => ({ home_id: home.id, id: entry.id, chore_id: entry.choreId, chore_title: entry.choreTitle, action: entry.action, performed_at: entry.performedAt, scheduled_for: entry.scheduledFor ?? null, performed_by_user_id: entry.performedByUserId === incoming.user.id ? userId : entry.performedByUserId, performed_by_name: entry.performedByName }));
    if (historyRows.length) {
      const { error } = await db.from('chore_history').upsert(historyRows, { onConflict: 'home_id,id' });
      if (error) throw error;
    }

    const ownAssessment = (home.laborAssessments ?? []).find((item) => item.userId === incoming.user.id || item.userId === userId);
    if (ownAssessment) {
      const { error } = await db.from('labor_assessments').upsert({ home_id: home.id, user_id: userId, planning_score: ownAssessment.planningScore, execution_score: ownAssessment.executionScore, answers: ownAssessment.answers, updated_at: ownAssessment.updatedAt }, { onConflict: 'home_id,user_id' });
      if (error) throw error;
    }

    const supplyRows = (home.supplies ?? []).map((item) => ({ home_id: home.id, id: item.id, name: item.name, unit: item.unit, purchase_date: item.purchaseDate, purchase_quantity: item.purchaseQuantity, weekly_usage: item.weeklyUsage, safety_stock: item.safetyStock, reminder_days_before: item.reminderDaysBefore, updated_at: item.updatedAt }));
    if (supplyRows.length) {
      const { error } = await db.from('supply_items').upsert(supplyRows, { onConflict: 'home_id,id' });
      if (error) throw error;
    }
    const { data: storedSupplyRows, error: storedSupplyError } = await db.from('supply_items').select('id').eq('home_id', home.id);
    if (storedSupplyError) throw storedSupplyError;
    const incomingSupplyIds = new Set((home.supplies ?? []).map((item) => item.id));
    const removedSupplyIds = storedSupplyRows.filter((item) => !incomingSupplyIds.has(item.id)).map((item) => item.id);
    if (removedSupplyIds.length) {
      const { error } = await db.from('supply_items').delete().eq('home_id', home.id).in('id', removedSupplyIds);
      if (error) throw error;
    }
  }

  const activeHomeId = incoming.homes.some((home) => home.id === incoming.activeHomeId) ? incoming.activeHomeId : incoming.homes[0]?.id ?? null;
  const { error: settingsError } = await db.from('user_settings').upsert({ user_id: userId, notifications: incoming.notifications, active_home_id: activeHomeId, updated_at: new Date().toISOString() });
  if (settingsError) throw settingsError;
  return loadState(userId);
}

export async function joinHome(userId: string, inviteCode: string): Promise<AppData> {
  const db = getSupabaseAdmin();
  const user = await ensureUser(db, userId);
  const { data: home, error: homeError } = await db.from('homes').select('id').eq('invite_code', inviteCode.trim().toUpperCase()).maybeSingle();
  if (homeError) throw homeError;
  if (!home) throw new Error('초대 코드에 해당하는 집을 찾을 수 없어요.');
  const { error: memberError } = await db.from('home_members').upsert({ id: `member-${randomUUID()}`, home_id: home.id, user_id: user.id, role: 'member', joined_at: new Date().toISOString() }, { onConflict: 'home_id,user_id', ignoreDuplicates: true });
  if (memberError) throw memberError;
  const { data: currentSettings, error: settingsLookupError } = await db.from('user_settings').select('notifications').eq('user_id', userId).maybeSingle();
  if (settingsLookupError) throw settingsLookupError;
  const { error: settingsError } = await db.from('user_settings').upsert({ user_id: userId, active_home_id: home.id, notifications: currentSettings?.notifications ?? { enabled: false, reminderHour: 9 }, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (settingsError) throw settingsError;
  return loadState(userId);
}
