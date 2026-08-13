import type {
  Chore,
  ChoreCategory,
  HomeMember,
  HomeProfile,
  NotificationSettings,
  RecommendationPreference,
  SupplyItem,
} from './types.js';
import type {
  ProfileCategoryCounts,
  ProfileLevel,
  ProfileTendency,
  ProfileTendencyKey,
} from './profileInsights.js';

export interface ApiUserDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettingsDto {
  activeHomeId: string | null;
  notifications: NotificationSettings;
}

export interface HousekeepingLevelDto extends ProfileLevel {
  nextLevelAt: number;
}

export interface HousekeepingTendencyDto extends ProfileTendency {
  key: ProfileTendencyKey;
  sampleSize: number;
}

export interface ProfileInsightsDto {
  completedCount: number;
  categoryCounts: ProfileCategoryCounts;
  level: HousekeepingLevelDto;
  tendency: HousekeepingTendencyDto;
  algorithmVersion: string;
  computedAt: string;
}

export interface HomeSummaryDto {
  id: string;
  name: string;
  emoji: string;
  activeMemberCount: number;
  profileCompleted: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface HomeMembershipSummaryDto {
  id: string;
  role: HomeMember['role'];
  status: 'active';
  joinedAt: string;
  home: HomeSummaryDto;
}

export interface MeDto {
  user: ApiUserDto;
  settings: UserSettingsDto;
  insights: ProfileInsightsDto;
  memberships: HomeMembershipSummaryDto[];
}

export interface HomeBasicDto extends HomeSummaryDto {
  timezone: string;
  taskViewMode: 'todo' | 'quest';
  assignmentMode: 'shared' | 'auto';
}

export interface CurrentHomeMembershipDto {
  id: string;
  userId: string;
  role: HomeMember['role'];
  status: 'active';
  joinedAt: string;
}

export interface HomePermissionsDto {
  canEditHome: boolean;
  canManageMembers: boolean;
  canManageInvites: boolean;
  canDeleteHome: boolean;
  canManageChores: boolean;
  canCompleteChores: boolean;
  canViewHistory: boolean;
}

export interface HomeMemberDto extends HomeMember {
  avatarUrl: string | null;
  status: 'active' | 'left' | 'removed';
  endedAt: string | null;
  isCurrentUser: boolean;
}

export interface ChoreDto extends Omit<Chore, 'assignedMemberId' | 'executorMemberId'> {
  assigneeMembershipId: string | null;
}

export interface CompletionActorDto {
  /** 초기 migration 이전 고아 이력에는 멤버십 스냅샷이 없을 수 있어요. */
  membershipId: string | null;
  /** 탈퇴 후 공동 집 감사 기록에는 계정 연결 없이 null로 남을 수 있어요. */
  userId: string | null;
  displayName: string;
}

export interface CompletionAssigneeSnapshotDto {
  membershipId: string;
  displayName: string;
}

export interface CompletionDto {
  id: string;
  homeId: string;
  occurrenceId: string;
  choreId: string;
  scheduledFor: string;
  status: 'completed' | 'voided';
  choreSnapshot: {
    title: string;
    category: ChoreCategory;
  };
  performedAt: string;
  performedBy: CompletionActorDto;
  assigneeSnapshot: CompletionAssigneeSnapshotDto | null;
  /** 담당자가 없었다면 null, 담당자가 완료했으면 true */
  completedByAssignee: boolean | null;
  voidedAt: string | null;
}

export interface ChoreOccurrenceDto {
  occurrenceId: string;
  homeId: string;
  choreId: string;
  scheduledFor: string;
  status: 'pending' | 'completed' | 'skipped';
  isOverdue: boolean;
  /** 완료 뒤 집안일이 삭제된 멱등 재생에서는 완료 snapshot만 남으므로 null일 수 있어요. */
  chore: ChoreDto | null;
  completion: CompletionDto | null;
}

export interface HomeTodayDto {
  date: string;
  dueCount: number;
  completedCount: number;
  items: ChoreOccurrenceDto[];
}

export interface HomePreferencesDto {
  recommendations: RecommendationPreference[];
}

export interface HomeDetailDto {
  home: HomeBasicDto;
  currentMembership: CurrentHomeMembershipDto;
  permissions: HomePermissionsDto;
  profile: HomeProfile | null;
  members: HomeMemberDto[];
  chores: ChoreDto[];
  today: HomeTodayDto;
  recentCompletions: CompletionDto[];
  supplies: SupplyItem[];
  preferences: HomePreferencesDto;
}

export interface CompleteChoreRequest {
  scheduledFor: string;
  clientRequestId: string;
}

export interface CompleteChoreResponse {
  occurrence: ChoreOccurrenceDto;
  completion: CompletionDto;
  alreadyCompleted: boolean;
  idempotentReplay: boolean;
  nextDueDate: string;
  homeRevision: number;
}

export interface AssignChoreRequest {
  assigneeMembershipId: string | null;
  expectedRevision: number;
}

export interface AssignChoreResponse {
  chore: ChoreDto;
  homeRevision: number;
}
