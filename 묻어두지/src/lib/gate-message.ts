import type { Eligibility } from '@/shared/contracts';

/** What the person sees when the server says no. Mirrors the server wording. */
export function gateMessage(gate: Eligibility): string {
  switch (gate.code) {
    case 'READY': return '시간과 장소를 확인했어요. 바닥을 비추면 캡슐이 나타나요.';
    case 'TOO_EARLY': return `아직 기다리는 중이에요. ${remaining(gate.remainingSeconds)} 뒤에 열 수 있어요.`;
    case 'TOO_FAR': return `구덩이에서 ${distance(gate.distanceMeters)} 떨어져 있어요. 반경 ${gate.radiusMeters}m 안으로 와 주세요.`;
    case 'UNCERTAIN_LOCATION': return 'GPS 오차 때문에 아직 판정하지 않았어요. 하늘이 보이는 곳에서 다시 측정해 주세요.';
    case 'INACCURATE_LOCATION': return '위치 오차가 너무 커요. 정확한 위치를 켜고, 하늘이 보이는 곳에서 다시 확인해 주세요.';
    case 'STALE_LOCATION': return '방금 측정한 위치가 필요해요. 휴대폰의 날짜와 시간을 자동으로 설정하고 다시 확인해 주세요.';
    case 'MOCKED_LOCATION': return '실제 장소에서 측정한 위치로만 열 수 있어요.';
    case 'WAITING_PARTICIPANTS': return `${gate.attendance?.presentCount ?? 0} / ${gate.attendance?.requiredCount ?? 0}명 도착했어요. 전원이 이 장소에서 함께 열기에 참여하면 열 수 있어요.`;
  }
}

function remaining(seconds: number) {
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}분`;
  if (seconds < 86400) return `${Math.ceil(seconds / 3600)}시간`;
  return `${Math.ceil(seconds / 86400)}일`;
}

function distance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}
