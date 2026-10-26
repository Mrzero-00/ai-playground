import { addDays, type Capsule, type CapsuleItem } from '@/domain/capsule';

const now = new Date().toISOString();

function letter(id: string, text: string): CapsuleItem {
  return { id, kind: 'letter', createdAt: addDays(now, -3), text };
}

function media(id: string, kind: 'photo' | 'voice' | 'video', durationMs?: number): CapsuleItem {
  return { id, kind, createdAt: addDays(now, -2), durationMs };
}

/** 로컬 프로토타입용 샘플. 서버가 붙으면 제거한다. 실제 사진·음성 URI는 없고 자리만 있다. */
export const SEED_CAPSULES: Capsule[] = [
  {
    id: 'jeju',
    title: '제주 여행 떠나기 전에',
    createdAt: addDays(now, -1),
    deadlineAt: addDays(now, 6),
    status: 'collecting',
    sealedAt: null,
    openAt: null,
    openedAt: null,
    members: [
      { id: 'me', name: '상길', isMe: true, isHost: true, items: [] },
      { id: 'minji', name: '민지', isMe: false, isHost: false, items: [letter('m1', '…'), media('m2', 'photo')] },
      { id: 'yujin', name: '유진', isMe: false, isHost: false, items: [media('y1', 'voice', 42_000)] },
      { id: 'doyun', name: '도윤', isMe: false, isHost: false, items: [letter('d1', '…'), media('d2', 'photo'), media('d3', 'video', 18_000)] },
    ],
  },
  {
    id: 'busan',
    title: '부산 여행 캡슐',
    createdAt: addDays(now, -40),
    deadlineAt: addDays(now, -33),
    status: 'sealed',
    sealedAt: addDays(now, -33),
    openAt: addDays(now, -0.1),
    openedAt: null,
    location: { latitude: 35.1532, longitude: 129.1186, accuracy: 9, label: '광안리 해변 입구', plantedAt: addDays(now, -40) },
    members: [
      { id: 'me', name: '상길', isMe: true, isHost: true, items: [letter('b-me-1', '제주 가서도 우리 다 같이 새벽 라면은 꼭 먹자. 그때도 도윤이는 분명 먼저 잠들어 있을 거고, 민지는 사진만 백 장 찍고 있을 거야. 32일 뒤의 우리, 아직도 이러고 있니?'), media('b-me-2', 'photo')] },
      { id: 'minji', name: '민지', isMe: false, isHost: false, items: [media('b-m-1', 'photo'), letter('b-m-2', '광안리 불꽃 보면서 했던 말, 기억나? 나는 아직도 그 약속 유효하다고 생각해.')] },
      { id: 'yujin', name: '유진', isMe: false, isHost: false, items: [media('b-y-1', 'voice', 42_000)] },
      { id: 'doyun', name: '도윤', isMe: false, isHost: false, items: [letter('b-d-1', '솔직히 나 그날 먼저 안 잤다. 눈만 감고 있었음.'), media('b-d-2', 'video', 24_000)] },
    ],
  },
  {
    id: 'twenty-five',
    title: '스물다섯의 우리에게',
    createdAt: addDays(now, -10),
    deadlineAt: addDays(now, -3),
    status: 'sealed',
    sealedAt: addDays(now, -2),
    openAt: addDays(now, 32),
    openedAt: null,
    members: [
      { id: 'me', name: '상길', isMe: true, isHost: false, items: [letter('t-me', '…'), media('t-me-2', 'photo'), media('t-me-3', 'voice', 30_000)] },
      { id: 'minji', name: '민지', isMe: false, isHost: true, items: [letter('t-m', '…'), media('t-m-2', 'photo')] },
      { id: 'yujin', name: '유진', isMe: false, isHost: false, items: [letter('t-y', '…')] },
      { id: 'doyun', name: '도윤', isMe: false, isHost: false, items: [letter('t-d', '…'), media('t-d-2', 'photo'), media('t-d-3', 'photo'), media('t-d-4', 'video', 12_000), media('t-d-5', 'voice', 50_000)] },
    ],
  },
  {
    id: 'graduation',
    title: '졸업 전 마지막 밤',
    createdAt: addDays(now, -80),
    deadlineAt: addDays(now, -73),
    status: 'opened',
    sealedAt: addDays(now, -72),
    openAt: addDays(now, -18),
    openedAt: addDays(now, -18),
    members: [
      { id: 'me', name: '상길', isMe: true, isHost: false, items: [letter('g-me', '졸업하고도 우리 매달 한 번은 보자. 안 보면 내가 찾아간다.')] },
      { id: 'minji', name: '민지', isMe: false, isHost: true, items: [letter('g-m', '마지막 밤이라니, 아직 실감이 안 나. 근데 이거 열 때쯤이면 다들 어른인 척하고 있겠지.'), media('g-m-2', 'photo')] },
      { id: 'yujin', name: '유진', isMe: false, isHost: false, items: [media('g-y', 'voice', 38_000)] },
    ],
  },
];
