import type { ItemSlot } from './game';

export interface RunnerFriend {
  id: string;
  name: string;
  handle: string;
  level: number;
  title: string;
  weeklyDistanceKm: number;
  dailyQuestDone: number;
  achievementCount: number;
  totalAchievements: number;
  streak: number;
  status: string;
  avatarColor: string;
  equipped: Partial<Record<ItemSlot, string>>;
}

export interface FriendNotification {
  id: string;
  friendId: string;
  icon: string;
  message: string;
  createdAtLabel: string;
}

export interface GroupMember {
  id: string;
  name: string;
  contributionKm: number;
  color: string;
}

export const RUNNER_FRIENDS: RunnerFriend[] = [
  {
    id: 'friend-harin',
    name: '하린',
    handle: '@harin_runs',
    level: 18,
    title: '새벽을 여는 러너',
    weeklyDistanceKm: 14.2,
    dailyQuestDone: 3,
    achievementCount: 8,
    totalAchievements: 12,
    streak: 21,
    status: '오늘 5km 템포런 완료!',
    avatarColor: '#F5A7B8',
    equipped: {
      head: '체리 헤드폰',
      top: '노을 바람막이',
      bottom: '네이비 쇼츠',
      shoes: '별빛 스니커즈',
      watch: '페이스 워치',
    },
  },
  {
    id: 'friend-minjun',
    name: '민준',
    handle: '@minjun_10k',
    level: 12,
    title: '꾸준한 러너',
    weeklyDistanceKm: 9.6,
    dailyQuestDone: 2,
    achievementCount: 5,
    totalAchievements: 12,
    streak: 8,
    status: '주간 10km까지 0.4km 남았어요',
    avatarColor: '#77C9B5',
    equipped: {
      head: '민트 러닝 캡',
      top: '구름 후디',
      bottom: '베리 러닝 팬츠',
      shoes: '오렌지 러닝화',
    },
  },
  {
    id: 'friend-seoyeon',
    name: '서연',
    handle: '@seoyeon_trail',
    level: 27,
    title: '길을 여는 러너',
    weeklyDistanceKm: 22.8,
    dailyQuestDone: 3,
    achievementCount: 10,
    totalAchievements: 12,
    streak: 37,
    status: '한강 달빛 시계를 해금했어요',
    avatarColor: '#8B88D8',
    equipped: {
      head: '주간 완주 반다나',
      top: '민트 후디',
      bottom: '네이비 쇼츠',
      shoes: '별빛 스니커즈',
      watch: '한강 달빛 시계',
      bag: '100km 기록 가방',
    },
  },
];

export const FRIEND_NOTIFICATIONS: FriendNotification[] = [
  {
    id: 'notice-harin-daily',
    friendId: 'friend-harin',
    icon: '🔥',
    message: '하린님이 일일 퀘스트를 모두 완료했어요.',
    createdAtLabel: '12분 전',
  },
  {
    id: 'notice-seoyeon-achievement',
    friendId: 'friend-seoyeon',
    icon: '🏅',
    message: '서연님이 ‘강을 따라 걷는 달빛’ 업적을 달성했어요.',
    createdAtLabel: '1시간 전',
  },
  {
    id: 'notice-minjun-weekly',
    friendId: 'friend-minjun',
    icon: '🏃',
    message: '민준님이 이번 주 세 번째 러닝을 시작했어요.',
    createdAtLabel: '어제',
  },
];

export const GROUP_MEMBERS: GroupMember[] = [
  { id: 'me', name: '나', contributionKm: 42.8, color: '#FC7043' },
  { id: 'friend-seoyeon', name: '서연', contributionKm: 96.3, color: '#8B88D8' },
  { id: 'friend-harin', name: '하린', contributionKm: 82.7, color: '#F5A7B8' },
  { id: 'friend-minjun', name: '민준', contributionKm: 64.6, color: '#77C9B5' },
];
