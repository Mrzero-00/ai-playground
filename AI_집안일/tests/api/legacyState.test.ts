import { describe, expect, it } from 'vitest';
import type { Chore, Home } from '../../src/domain/types';
import {
  LegacyStateError,
  assertActiveLegacyUser,
  legacyCompletionRequestId,
  planLegacyHomeMutation,
} from '../../api/_lib/legacyState';

function chore(overrides: Partial<Chore> = {}): Chore {
  return {
    id: 'chore-1',
    title: '바닥 청소',
    category: 'cleaning',
    recurrence: { interval: 1, unit: 'week' },
    createdAt: '2026-08-01T00:00:00.000Z',
    scheduleAnchorDate: '2026-08-01',
    nextDueDate: '2026-08-11',
    isCustom: false,
    enabled: true,
    ...overrides,
  };
}

function home(overrides: Partial<Home> = {}): Home {
  return {
    id: 'home-1',
    syncRevision: 7,
    name: '우리 집',
    emoji: '🏠',
    inviteCode: 'ABC123',
    members: [],
    profile: null,
    chores: [chore()],
    history: [],
    laborAssessments: [],
    supplies: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('legacy /api/state 쓰기 경계', () => {
  it('비활성 계정은 legacy state 조회·수정 전에 거부한다', () => {
    expect(() => assertActiveLegacyUser({ status: 'suspended' })).toThrow(LegacyStateError);
    expect(() => assertActiveLegacyUser({ status: 'deleted' })).toThrow('현재 사용할 수 없는 계정');
    expect(() => assertActiveLegacyUser({ status: 'active' })).not.toThrow();
  });

  it('완료의 클라이언트 시각·예정일을 무시하고 서버 예정 건 action으로 바꾼다', () => {
    const current = home();
    const incoming = home({
      chores: [chore({ nextDueDate: '2099-12-31' })],
      history: [{
        id: 'history-client',
        choreId: 'chore-1',
        choreTitle: '조작된 제목',
        action: 'completed',
        performedAt: '2099-12-31T23:59:59.000Z',
        scheduledFor: '2099-12-31',
        performedByUserId: 'other-user',
        performedByName: '다른 사람',
      }],
    });

    const plan = planLegacyHomeMutation(current, incoming, 'user-1');
    expect(plan.snapshotRequired).toBe(false);
    expect(plan.snapshotHome.history).toEqual([]);
    expect(plan.snapshotHome.chores[0].nextDueDate).toBe('2026-08-11');
    expect(plan.completions).toEqual([{
      choreId: 'chore-1',
      scheduledFor: '2026-08-11',
      requestId: '43abcc96-2490-5c58-ad11-16aa48b8d7ae',
    }]);
  });

  it('담당자·일정·활성 변경을 snapshot에서 제거하고 각 action으로 분리한다', () => {
    const current = home({ chores: [chore({ assignedMemberId: 'member-a', executorMemberId: 'member-a' })] });
    const incoming = home({
      chores: [chore({
        assignedMemberId: 'member-b',
        executorMemberId: 'member-b',
        recurrence: { interval: 2, unit: 'week' },
        nextDueDate: '2026-08-25',
        enabled: false,
      })],
    });

    const plan = planLegacyHomeMutation(current, incoming, 'user-1');
    expect(plan.snapshotRequired).toBe(false);
    expect(plan.snapshotHome.chores[0]).toMatchObject({
      assignedMemberId: 'member-a',
      executorMemberId: 'member-a',
      recurrence: { interval: 1, unit: 'week' },
      nextDueDate: '2026-08-11',
      enabled: true,
    });
    expect(plan.assignments).toEqual([{ choreId: 'chore-1', assigneeMembershipId: 'member-b' }]);
    expect(plan.schedules).toEqual([{
      choreId: 'chore-1',
      recurrence: { interval: 2, unit: 'week' },
      scheduleAnchorDate: '2026-08-01',
      nextDueDate: '2026-08-25',
    }]);
    expect(plan.enabledChanges).toEqual([{ choreId: 'chore-1', enabled: false }]);
  });

  it('다른 구성원의 기록 omission은 삭제하지 않고 서버 canonical history를 유지한다', () => {
    const sharedEntry = {
      id: 'history-shared',
      choreId: 'chore-1',
      choreTitle: '바닥 청소',
      action: 'completed' as const,
      performedAt: '2026-08-11T01:00:00.000Z',
      scheduledFor: '2026-08-11',
      performedByUserId: 'other-user',
      performedByName: '동거인',
    };
    const plan = planLegacyHomeMutation(home({ history: [sharedEntry] }), home({ history: [] }), 'user-1');
    expect(plan.snapshotRequired).toBe(false);
    expect(plan.snapshotHome.history).toEqual([sharedEntry]);
  });

  it('검토되지 않은 로컬 완료 이력의 자동 업로드를 차단한다', () => {
    const incoming = home({
      history: [{
        id: 'legacy-history',
        choreId: 'chore-1',
        choreTitle: '바닥 청소',
        action: 'completed',
        performedAt: '2026-08-01T00:00:00.000Z',
        performedByUserId: 'local-user',
        performedByName: '나',
      }],
    });
    expect(() => planLegacyHomeMutation(null, incoming, 'user-1')).toThrow(LegacyStateError);
  });

  it('새 집안일의 초기 제외 상태는 snapshot에 보존한다', () => {
    const current = home({ chores: [] });
    const incoming = home({ chores: [chore({ id: 'chore-new', enabled: false })] });

    const plan = planLegacyHomeMutation(current, incoming, 'user-1');
    expect(plan.snapshotRequired).toBe(true);
    expect(plan.snapshotHome.chores[0]).toMatchObject({ id: 'chore-new', enabled: false });
    expect(plan.enabledChanges).toEqual([]);
  });

  it('응답 경합으로 local history ID가 남아도 requestId로 canonical 완료를 찾아 undo하지 않는다', () => {
    const requestId = legacyCompletionRequestId('user-1', 'home-1', 'history-client');
    const canonical = {
      id: 'history-server',
      requestId,
      choreId: 'chore-1',
      choreTitle: '바닥 청소',
      action: 'completed' as const,
      performedAt: '2026-08-11T01:00:00.000Z',
      scheduledFor: '2026-08-11',
      performedByUserId: 'user-1',
      performedByName: '나',
    };
    const localAlias = { ...canonical, id: 'history-client', requestId: undefined };
    const current = home({
      syncRevision: 8,
      chores: [chore({ nextDueDate: '2026-08-18' })],
      history: [canonical],
    });
    const incoming = home({
      syncRevision: 8,
      chores: [chore({ nextDueDate: '2026-08-18' })],
      history: [localAlias],
    });

    const plan = planLegacyHomeMutation(current, incoming, 'user-1');
    expect(plan.snapshotRequired).toBe(false);
    expect(plan.snapshotHome.history).toEqual([canonical]);
    expect(plan.completions).toEqual([{ choreId: 'chore-1', scheduledFor: '2026-08-11', requestId }]);
  });

  it('다른 구성원의 requestId는 legacy correlation에 사용하지 않는다', () => {
    const requestId = legacyCompletionRequestId('user-1', 'home-1', 'history-client');
    const otherCompletion = {
      id: 'history-server',
      requestId,
      choreId: 'chore-1',
      choreTitle: '바닥 청소',
      action: 'completed' as const,
      performedAt: '2026-08-11T01:00:00.000Z',
      scheduledFor: '2026-08-11',
      performedByUserId: 'user-2',
      performedByName: '동거인',
    };
    const localEntry = { ...otherCompletion, id: 'history-client', requestId: undefined, performedByUserId: 'user-1' };
    const plan = planLegacyHomeMutation(
      home({ chores: [chore({ nextDueDate: '2026-08-18' })], history: [otherCompletion] }),
      home({ chores: [chore({ nextDueDate: '2026-08-18' })], history: [localEntry] }),
      'user-1',
    );

    expect(plan.snapshotHome.history).toEqual([otherCompletion]);
    expect(plan.completions[0]).toMatchObject({ scheduledFor: '2026-08-18', requestId });
  });

  it('같은 legacy 기록은 재시도해도 같은 UUID 멱등키를 만든다', () => {
    expect(legacyCompletionRequestId('user-1', 'home-1', 'history-client')).toBe(
      legacyCompletionRequestId('user-1', 'home-1', 'history-client'),
    );
  });
});
