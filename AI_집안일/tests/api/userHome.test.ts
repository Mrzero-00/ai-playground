import { describe, expect, it } from 'vitest';
import {
  choreOccurrenceId,
  completeChoreResponseFromPayload,
  parseAssignChoreInput,
  parseCompleteChoreInput,
  parseUpdateMeInput,
  normalizeUserHomeError,
  UserHomeApiError,
} from '../../api/_lib/userHome';
import { completeChoreHttpStatus } from '../../api/homes/[homeId]/chores/[choreId]/complete';

describe('사용자·집 API 입력 검증', () => {
  it('DB와 같은 occurrence 식별자를 완료 전후에 사용한다', () => {
    expect(choreOccurrenceId('home-1', 'chore-1', '2026-08-11')).toBe(
      'occurrence-996cbef4f69de9dada292f405d4807b6ce990de029bfb6e227a9375c77d8a658',
    );
  });

  it('완료 요청은 유효한 예정일과 UUID 멱등키만 허용한다', () => {
    expect(parseCompleteChoreInput({
      scheduledFor: '2026-08-11',
      clientRequestId: '550e8400-e29b-41d4-a716-446655440000',
    })).toEqual({
      scheduledFor: '2026-08-11',
      clientRequestId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(() => parseCompleteChoreInput({
      scheduledFor: '2026-02-30',
      clientRequestId: 'not-a-uuid',
    })).toThrow(UserHomeApiError);
  });

  it('담당자 해제와 동기화 버전을 함께 검증한다', () => {
    expect(parseAssignChoreInput({ assigneeMembershipId: null, expectedRevision: 4 })).toEqual({
      assigneeMembershipId: null,
      expectedRevision: 4,
    });
    expect(() => parseAssignChoreInput({ assigneeMembershipId: 'member-a', expectedRevision: -1 })).toThrow('동기화 버전');
  });

  it('내 정보 PATCH에서 빈 변경과 잘못된 알림 시각을 거부한다', () => {
    expect(() => parseUpdateMeInput({})).toThrow('변경할 사용자 정보');
    expect(() => parseUpdateMeInput({ notifications: { enabled: true, reminderHour: 24 } })).toThrow('알림 설정');
  });

  it('완료 생성만 201이고 기존 결과 또는 멱등 재생은 200이다', () => {
    expect(completeChoreHttpStatus({ alreadyCompleted: false, idempotentReplay: false })).toBe(201);
    expect(completeChoreHttpStatus({ alreadyCompleted: true, idempotentReplay: false })).toBe(200);
    expect(completeChoreHttpStatus({ alreadyCompleted: false, idempotentReplay: true })).toBe(200);
  });

  it('DB occurrence mismatch를 공개 STALE 오류 계약으로 변환한다', () => {
    const error = normalizeUserHomeError({ code: '22023', message: 'CHORE_OCCURRENCE_MISMATCH' });
    expect(error).toMatchObject({ status: 409, code: 'CHORE_OCCURRENCE_STALE' });
  });

  it('완료 후 chore가 삭제된 멱등 재생도 canonical 완료를 200 응답용으로 조립한다', () => {
    const response = completeChoreResponseFromPayload('home-1', 'chore-1', {
      created: true,
      alreadyCompleted: false,
      idempotentReplay: true,
      nextDueDate: '2026-08-18',
      homeRevision: 9,
      completion: {
        id: 'history-1',
        homeId: 'home-1',
        occurrenceId: choreOccurrenceId('home-1', 'chore-1', '2026-08-11'),
        choreId: 'chore-1',
        scheduledFor: '2026-08-11',
        status: 'completed',
        choreSnapshot: { title: '삭제된 집안일', category: 'cleaning' },
        performedAt: '2026-08-11T01:00:00.000Z',
        performedBy: { membershipId: 'member-1', userId: 'user-1', displayName: '나' },
        assigneeSnapshot: null,
        completedByAssignee: null,
        voidedAt: null,
      },
    }, null, 'Asia/Seoul', new Date('2026-08-11T03:00:00.000Z'));

    expect(response.occurrence.chore).toBeNull();
    expect(response.completion.choreSnapshot.title).toBe('삭제된 집안일');
    expect(response.idempotentReplay).toBe(true);
    expect(completeChoreHttpStatus(response)).toBe(200);
  });

  it('취소된 completion ledger 재생은 새 완료로 오인하지 않는다', () => {
    let thrown: unknown;
    try {
      completeChoreResponseFromPayload('home-1', 'chore-1', {
        idempotentReplay: true,
        completion: {
          id: 'history-1',
          homeId: 'home-1',
          occurrenceId: choreOccurrenceId('home-1', 'chore-1', '2026-08-11'),
          choreId: 'chore-1',
          scheduledFor: '2026-08-11',
          status: 'voided',
          choreSnapshot: { title: '바닥 청소', category: 'cleaning' },
          performedAt: '2026-08-11T01:00:00.000Z',
          performedBy: { membershipId: 'member-1', userId: 'user-1', displayName: '나' },
          assigneeSnapshot: null,
          completedByAssignee: null,
          voidedAt: '2026-08-11T02:00:00.000Z',
        },
      }, null);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ status: 409, code: 'IDEMPOTENT_COMPLETION_VOIDED' });
  });
});
