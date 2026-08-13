import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  ChoreDto,
  CompleteChoreRequest,
  CompletionDto,
} from './apiContracts';

describe('API 계약', () => {
  it('집안일 담당자는 멤버십 ID 하나로 명확하게 표현한다', () => {
    const chore: ChoreDto = {
      id: 'chore-1',
      title: '바닥 청소',
      category: 'cleaning',
      recurrence: { interval: 1, unit: 'week' },
      createdAt: '2026-08-11T00:00:00.000Z',
      nextDueDate: '2026-08-11',
      isCustom: false,
      enabled: true,
      assigneeMembershipId: null,
    };

    expect(chore.assigneeMembershipId).toBeNull();
    expectTypeOf<ChoreDto['assigneeMembershipId']>().toEqualTypeOf<string | null>();
  });

  it('완료 기록에는 당시 담당자와 대신 완료 여부를 스냅샷으로 유지한다', () => {
    const completion: CompletionDto = {
      id: 'completion-1',
      homeId: 'home-1',
      occurrenceId: 'chore-1:2026-08-11',
      choreId: 'chore-1',
      scheduledFor: '2026-08-11',
      status: 'completed',
      choreSnapshot: { title: '바닥 청소', category: 'cleaning' },
      performedAt: '2026-08-11T09:00:00.000Z',
      performedBy: { membershipId: 'member-2', userId: 'user-2', displayName: '동거인' },
      assigneeSnapshot: { membershipId: 'member-1', displayName: '나' },
      completedByAssignee: false,
      voidedAt: null,
    };

    expect(completion.assigneeSnapshot?.membershipId).toBe('member-1');
    expect(completion.completedByAssignee).toBe(false);
    expectTypeOf<CompletionDto['completedByAssignee']>().toEqualTypeOf<boolean | null>();
  });

  it('완료 요청 body는 path의 choreId를 중복하지 않는다', () => {
    const request: CompleteChoreRequest = {
      scheduledFor: '2026-08-11',
      clientRequestId: 'a63c8ab3-a944-4f0f-b5dc-bf648cf988db',
    };

    expect(request).toEqual({
      scheduledFor: '2026-08-11',
      clientRequestId: 'a63c8ab3-a944-4f0f-b5dc-bf648cf988db',
    });
    expectTypeOf<'choreId' extends keyof CompleteChoreRequest ? true : false>().toEqualTypeOf<false>();
  });
});
