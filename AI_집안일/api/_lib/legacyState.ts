import { createHash } from 'node:crypto';
import type { Chore, ChoreHistory, Home, Recurrence } from '../../src/domain/types.js';

export class LegacyStateError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = code;
  }
}

export function assertActiveLegacyUser(user: { status?: unknown }): void {
  if ((user.status ?? 'active') !== 'active') {
    throw new LegacyStateError('ACCOUNT_INACTIVE', '현재 사용할 수 없는 계정이에요.');
  }
}

export interface LegacyCompletionAction {
  choreId: string;
  scheduledFor: string;
  requestId: string;
}

export interface LegacyAssignmentAction {
  choreId: string;
  assigneeMembershipId: string | null;
}

export interface LegacyScheduleAction {
  choreId: string;
  recurrence: Recurrence;
  scheduleAnchorDate: string | null;
  nextDueDate: string;
}

export interface LegacyEnabledAction {
  choreId: string;
  enabled: boolean;
}

export interface LegacyHomeMutationPlan {
  snapshotHome: Home;
  snapshotRequired: boolean;
  completions: LegacyCompletionAction[];
  assignments: LegacyAssignmentAction[];
  schedules: LegacyScheduleAction[];
  enabledChanges: LegacyEnabledAction[];
}

function stableUuid(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function legacyCompletionRequestId(userId: string, homeId: string, historyId: string): string {
  return stableUuid(`jiptori:legacy-completion:${userId}\u001f${homeId}\u001f${historyId}`);
}

function sameRecurrence(left: Recurrence, right: Recurrence): boolean {
  return left.interval === right.interval && left.unit === right.unit;
}

function assigneeId(chore: Chore): string | null {
  return chore.executorMemberId ?? chore.assignedMemberId ?? null;
}

function assertUniqueIds(values: Array<{ id: string }>, label: string) {
  if (new Set(values.map((value) => value.id)).size !== values.length) {
    throw new LegacyStateError('LEGACY_STATE_INVALID', `${label} ID가 중복됐어요.`);
  }
}

function safeProjection(home: Home) {
  return {
    id: home.id,
    name: home.name,
    emoji: home.emoji,
    taskViewMode: home.taskViewMode,
    assignmentMode: home.assignmentMode,
    profile: home.profile,
    chores: home.chores.map((chore) => ({
      id: chore.id,
      title: chore.title,
      category: chore.category,
      icon: chore.icon,
      createdAt: chore.createdAt,
      isCustom: chore.isCustom,
      notificationEnabled: chore.notificationEnabled,
      notificationTime: chore.notificationTime,
    })),
    recommendationPreferences: home.recommendationPreferences ?? [],
    laborAssessments: home.laborAssessments,
    supplies: home.supplies,
  };
}

function changed(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function canonicalHistoryForSnapshot(
  current: Home,
  incoming: Home,
  userId: string,
): { history: ChoreHistory[]; hasUndo: boolean } {
  const incomingIds = new Set(incoming.history.map((entry) => entry.id));
  const incomingLegacyRequestIds = new Set(incoming.history
    .filter((entry) => entry.action === 'completed')
    .map((entry) => legacyCompletionRequestId(userId, incoming.id, entry.id)));
  let hasUndo = false;
  const history = current.history.filter((entry) => {
    if (incomingIds.has(entry.id)) return true;
    // A save response can race a newer local edit. The legacy hook then keeps
    // its local history ID but adopts the server revision. Match that local ID
    // to the immutable request key so the next PUT is a replay, not an undo.
    if (entry.performedByUserId === userId && entry.requestId && incomingLegacyRequestIds.has(entry.requestId)) return true;
    if (entry.action === 'completed' && entry.performedByUserId === userId) {
      hasUndo = true;
      return false;
    }
    return true;
  });
  return { history, hasUndo };
}

/**
 * Converts the broad AppData v2 snapshot into a narrow compatibility plan.
 * Existing completion, assignee, schedule and enabled fields are restored to
 * their server values in `snapshotHome`; the caller must execute the returned
 * action list through the atomic RPCs.
 */
export function planLegacyHomeMutation(current: Home | null, incoming: Home, userId: string): LegacyHomeMutationPlan {
  assertUniqueIds(incoming.chores, '집안일');
  assertUniqueIds(incoming.history, '완료 기록');

  if (!current && incoming.history.length > 0) {
    throw new LegacyStateError(
      'LEGACY_HISTORY_IMPORT_REQUIRED',
      '기존 완료 기록은 확인 후 가져와야 해요. 먼저 집만 동기화해 주세요.',
    );
  }

  const currentChores = new Map((current?.chores ?? []).map((chore) => [chore.id, chore]));
  const incomingChores = new Map(incoming.chores.map((chore) => [chore.id, chore]));
  const currentHistoryIds = new Set((current?.history ?? []).map((entry) => entry.id));
  const currentHistoryByRequestId = new Map((current?.history ?? [])
    .filter((entry): entry is ChoreHistory & { requestId: string } => (
      entry.performedByUserId === userId && typeof entry.requestId === 'string'
    ))
    .map((entry) => [entry.requestId, entry]));
  const addedHistory = incoming.history.filter((entry) => !currentHistoryIds.has(entry.id));
  const completionChoreIds = new Set<string>();
  const completions: LegacyCompletionAction[] = [];

  for (const entry of addedHistory) {
    if (entry.action !== 'completed') {
      throw new LegacyStateError('LEGACY_ACTION_REQUIRED', '건너뛰기 기록은 전용 API로 저장해 주세요.');
    }
    if (completionChoreIds.has(entry.choreId)) {
      throw new LegacyStateError('LEGACY_STATE_INVALID', '한 번의 동기화에서 같은 집안일을 여러 번 완료할 수 없어요.');
    }
    const chore = currentChores.get(entry.choreId) ?? incomingChores.get(entry.choreId);
    if (!chore) throw new LegacyStateError('CHORE_NOT_FOUND', '완료할 집안일을 찾지 못했어요.');
    completionChoreIds.add(entry.choreId);
    const requestId = legacyCompletionRequestId(userId, incoming.id, entry.id);
    const replayedCompletion = currentHistoryByRequestId.get(requestId);
    completions.push({
      choreId: entry.choreId,
      // Client performedAt/scheduledFor are deliberately ignored. The server's
      // current due date is the only canonical occurrence the legacy UI can complete.
      scheduledFor: replayedCompletion?.scheduledFor ?? chore.nextDueDate,
      requestId,
    });
  }

  const assignments: LegacyAssignmentAction[] = [];
  const schedules: LegacyScheduleAction[] = [];
  const enabledChanges: LegacyEnabledAction[] = [];
  const sanitizedChores = incoming.chores.map((chore): Chore => {
    const stored = currentChores.get(chore.id);
    if (!stored) {
      const newAssignee = assigneeId(chore);
      if (newAssignee) assignments.push({ choreId: chore.id, assigneeMembershipId: newAssignee });
      return { ...chore, assignedMemberId: undefined, executorMemberId: undefined };
    }

    const incomingAssignee = assigneeId(chore);
    const storedAssignee = assigneeId(stored);
    if (incomingAssignee !== storedAssignee) assignments.push({ choreId: chore.id, assigneeMembershipId: incomingAssignee });

    const recurrenceChanged = !sameRecurrence(chore.recurrence, stored.recurrence);
    const anchorChanged = (chore.scheduleAnchorDate ?? null) !== (stored.scheduleAnchorDate ?? null);
    const dueChanged = chore.nextDueDate !== stored.nextDueDate;
    const dueOwnedByCompletion = completionChoreIds.has(chore.id) && !recurrenceChanged && !anchorChanged;
    if ((recurrenceChanged || anchorChanged || dueChanged) && !dueOwnedByCompletion) {
      schedules.push({
        choreId: chore.id,
        recurrence: chore.recurrence,
        scheduleAnchorDate: chore.scheduleAnchorDate ?? null,
        nextDueDate: chore.nextDueDate,
      });
    }
    if (chore.enabled !== stored.enabled) enabledChanges.push({ choreId: chore.id, enabled: chore.enabled });

    return {
      ...chore,
      recurrence: stored.recurrence,
      scheduleAnchorDate: stored.scheduleAnchorDate,
      nextDueDate: stored.nextDueDate,
      enabled: stored.enabled,
      assignedMemberId: stored.assignedMemberId,
      executorMemberId: stored.executorMemberId,
    };
  });

  const canonicalHistory = current
    ? canonicalHistoryForSnapshot(current, incoming, userId)
    : { history: [] as ChoreHistory[], hasUndo: false };
  const snapshotHome: Home = {
    ...incoming,
    syncRevision: current?.syncRevision ?? incoming.syncRevision ?? 0,
    inviteCode: current?.inviteCode ?? incoming.inviteCode,
    createdAt: current?.createdAt ?? incoming.createdAt,
    members: current?.members ?? incoming.members,
    chores: sanitizedChores,
    history: canonicalHistory.history,
  };
  const snapshotRequired = !current
    || canonicalHistory.hasUndo
    || changed(safeProjection(current), safeProjection(snapshotHome));

  return { snapshotHome, snapshotRequired, completions, assignments, schedules, enabledChanges };
}
