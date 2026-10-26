import type { Capsule } from '@/domain/capsule';
import type { CapsuleSummary } from '@/shared/contracts';

/**
 * 지도는 서버 계약(CapsuleSummary)을 그린다. 로컬 1차 캡슐 중 심은 자리가 있는 것만 변환한다.
 * 서버가 붙으면 이 어댑터 대신 api.list() 결과를 그대로 넘긴다.
 */
export function plantedSummaries(capsules: Capsule[]): CapsuleSummary[] {
  return capsules.flatMap((capsule) => {
    if (!capsule.location) return [];
    const kinds = capsule.members.flatMap((member) => member.items.map((item) => item.kind));
    return [
      {
        id: capsule.id,
        title: capsule.title,
        placeName: capsule.location.label,
        createdAt: capsule.createdAt,
        opensAt: capsule.openAt ?? capsule.deadlineAt,
        openedAt: capsule.openedAt,
        latitude: capsule.location.latitude,
        longitude: capsule.location.longitude,
        radiusMeters: 150,
        hasPhoto: kinds.includes('photo'),
        hasAudio: kinds.includes('voice'),
        hasVideo: kinds.includes('video'),
        groupId: null,
        participantCount: capsule.members.length,
      },
    ];
  });
}
