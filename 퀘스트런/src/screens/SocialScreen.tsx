import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getRunnerGrowthStage } from '../domain/game';
import {
  MONTHLY_GROUP_TARGET_KM,
  getMonthlyGroupQuestProgress,
  type GameState,
  type GroupQuestMode,
} from '../domain/gameState';
import {
  FRIEND_NOTIFICATIONS,
  GROUP_MEMBERS,
  RUNNER_FRIENDS,
  type RunnerFriend,
} from '../domain/social';
import { Card, Pill, PrimaryButton, ProgressBar, ScreenTitle, SectionHeader } from '../ui/components';
import { colors, radii } from '../ui/theme';
import heroImage from '../../assets/quest-run-lumi-v2.png';

type SocialTab = 'friends' | 'group' | 'notifications';

interface SocialScreenProps {
  gameState: GameState;
  onClaimGroupQuest: () => void;
  onMarkNotificationsSeen: (notificationIds: string[]) => void;
  onSelectGroupMode: (mode: GroupQuestMode) => void;
}

export function SocialScreen({
  gameState,
  onClaimGroupQuest,
  onMarkNotificationsSeen,
  onSelectGroupMode,
}: SocialScreenProps) {
  const [activeTab, setActiveTab] = useState<SocialTab>('friends');
  const [selectedFriend, setSelectedFriend] = useState<RunnerFriend | null>(null);
  const unreadCount = FRIEND_NOTIFICATIONS.filter(
    (notification) => !gameState.seenFriendNotificationIds.includes(notification.id)
  ).length;

  if (selectedFriend != null) {
    return <FriendProfile friend={selectedFriend} onBack={() => setSelectedFriend(null)} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenTitle
        eyebrow="RUN TOGETHER"
        title="러닝 친구"
        right={<Pill tone="brand">{RUNNER_FRIENDS.length}명 연결</Pill>}
      />

      <View style={styles.segment}>
        <SegmentButton active={activeTab === 'friends'} label="친구" onPress={() => setActiveTab('friends')} />
        <SegmentButton active={activeTab === 'group'} label="그룹 퀘스트" onPress={() => setActiveTab('group')} />
        <SegmentButton
          active={activeTab === 'notifications'}
          badge={unreadCount}
          label="알림"
          onPress={() => setActiveTab('notifications')}
        />
      </View>

      {activeTab === 'friends' ? <FriendsPanel onSelectFriend={setSelectedFriend} /> : null}
      {activeTab === 'group' ? (
        <GroupQuestPanel
          gameState={gameState}
          onClaim={onClaimGroupQuest}
          onSelectMode={onSelectGroupMode}
        />
      ) : null}
      {activeTab === 'notifications' ? (
        <NotificationsPanel
          gameState={gameState}
          onMarkAllSeen={() =>
            onMarkNotificationsSeen(FRIEND_NOTIFICATIONS.map((notification) => notification.id))
          }
          onSelectFriend={(friendId) => {
            const friend = RUNNER_FRIENDS.find((candidate) => candidate.id === friendId);
            if (friend != null) {
              setSelectedFriend(friend);
            }
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function FriendsPanel({ onSelectFriend }: { onSelectFriend: (friend: RunnerFriend) => void }) {
  return (
    <>
      <Card style={styles.socialIntro}>
        <View style={styles.introIcon}>
          <Text style={styles.introEmoji}>👟</Text>
        </View>
        <View style={styles.introCopy}>
          <Text style={styles.introTitle}>서로의 한 걸음을 응원해요</Text>
          <Text style={styles.introCaption}>친구의 퀘스트와 업적 진행을 확인하고 함께 월간 목표에 도전하세요.</Text>
        </View>
      </Card>

      <SectionHeader caption="프로필을 누르면 캐릭터와 달성 업적을 볼 수 있어요." title="내 친구" />
      <View style={styles.friendList}>
        {RUNNER_FRIENDS.map((friend) => (
          <Pressable
            accessibilityLabel={`${friend.name} 러너 프로필 보기`}
            accessibilityRole="button"
            key={friend.id}
            onPress={() => onSelectFriend(friend)}
          >
            <Card style={styles.friendCard}>
              <AvatarBubble color={friend.avatarColor} label={friend.name.slice(0, 1)} />
              <View style={styles.friendCopy}>
                <View style={styles.friendNameLine}>
                  <Text style={styles.friendName}>{friend.name}</Text>
                  <Text style={styles.friendLevel}>Lv. {friend.level}</Text>
                </View>
                <Text style={styles.friendStatus}>{friend.status}</Text>
                <View style={styles.friendStats}>
                  <Text style={styles.friendStat}>이번 주 {friend.weeklyDistanceKm.toFixed(1)}km</Text>
                  <Text style={styles.friendDot}>·</Text>
                  <Text style={styles.friendStat}>퀘스트 {friend.dailyQuestDone}/3</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </>
  );
}

function GroupQuestPanel({
  gameState,
  onClaim,
  onSelectMode,
}: {
  gameState: GameState;
  onClaim: () => void;
  onSelectMode: (mode: GroupQuestMode) => void;
}) {
  const current = getMonthlyGroupQuestProgress(gameState);
  const completed = current >= MONTHLY_GROUP_TARGET_KM;
  const claimed = gameState.claimedGroupQuestMonthKeys.includes(gameState.monthlyDateKey);
  const members = useMemo(
    () =>
      GROUP_MEMBERS.map((member) =>
        member.id === 'me' ? { ...member, contributionKm: gameState.monthlyPersonalDistanceKm } : member
      ),
    [gameState.monthlyPersonalDistanceKm]
  );

  return (
    <>
      <View style={styles.monthlyHero}>
        <View style={styles.monthlyBlob} />
        <Pill tone="orange">{gameState.monthlyDateKey.replace('-', '.')} MONTHLY</Pill>
        <Text style={styles.monthlyTitle}>우리의 400km</Text>
        <Text style={styles.monthlyCaption}>
          한 달 동안 함께 달린 거리를 모아{'\n'}월간 한정 아이템을 완성해요.
        </Text>
        <Text style={styles.monthlyReward}>☄️</Text>
        <Text style={styles.monthlyRewardName}>월간 혜성 크라운</Text>
      </View>

      <SectionHeader caption="같이 달리거나, 원한다면 혼자서도 도전할 수 있어요." title="도전 방식" />
      <View style={styles.modeRow}>
        <ModeCard
          active={gameState.groupQuestMode === 'group'}
          caption="친구의 거리와 합산"
          icon="👥"
          label="함께 달리기"
          onPress={() => onSelectMode('group')}
        />
        <ModeCard
          active={gameState.groupQuestMode === 'solo'}
          caption="내 거리만으로 도전"
          icon="🏃"
          label="혼자 달리기"
          onPress={() => onSelectMode('solo')}
        />
      </View>

      <Card style={styles.groupProgressCard}>
        <View style={styles.progressTop}>
          <View>
            <Text style={styles.progressLabel}>
              {gameState.groupQuestMode === 'group' ? '팀 누적 거리' : '나의 단독 거리'}
            </Text>
            <Text style={styles.progressValue}>
              {current.toFixed(1)}
              <Text style={styles.progressUnit}> / {MONTHLY_GROUP_TARGET_KM}km</Text>
            </Text>
          </View>
          <View style={styles.progressPercentPill}>
            <Text style={styles.progressPercent}>
              {Math.min(100, Math.floor((current / MONTHLY_GROUP_TARGET_KM) * 100))}%
            </Text>
          </View>
        </View>
        <ProgressBar color={colors.orange} height={10} value={current / MONTHLY_GROUP_TARGET_KM} />
        <Text style={styles.remainingText}>
          {completed ? '월간 목표를 달성했어요!' : `앞으로 ${(MONTHLY_GROUP_TARGET_KM - current).toFixed(1)}km`}
        </Text>
        <PrimaryButton
          disabled={!completed || claimed}
          icon={claimed ? '✓' : '☄️'}
          label={claimed ? '월간 보상 받음' : completed ? '월간 보상 받기' : '400km 달성 후 받을 수 있어요'}
          onPress={onClaim}
        />
      </Card>

      {gameState.groupQuestMode === 'solo' ? (
        <Card style={styles.hiddenSoloCard}>
          <Text style={styles.hiddenSoloIcon}>?</Text>
          <View style={styles.hiddenSoloCopy}>
            <Text style={styles.hiddenSoloTitle}>숨겨진 도전이 감지됐어요</Text>
            <Text style={styles.hiddenSoloCaption}>
              혼자 400km를 완주하면 누구도 예상하지 못한 업적과 장식이 열려요.
            </Text>
          </View>
        </Card>
      ) : (
        <>
          <SectionHeader caption="이번 달 팀 거리에는 모든 멤버의 러닝이 합산돼요." title="함께 달리는 친구" />
          <Card>
            {members.map((member, index) => (
              <View key={member.id} style={[styles.memberRow, index < members.length - 1 && styles.memberDivider]}>
                <AvatarBubble color={member.color} label={member.name.slice(0, 1)} small />
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberDistance}>{member.contributionKm.toFixed(1)}km</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </>
  );
}

function NotificationsPanel({
  gameState,
  onMarkAllSeen,
  onSelectFriend,
}: {
  gameState: GameState;
  onMarkAllSeen: () => void;
  onSelectFriend: (friendId: string) => void;
}) {
  const unreadCount = FRIEND_NOTIFICATIONS.filter(
    (notification) => !gameState.seenFriendNotificationIds.includes(notification.id)
  ).length;

  return (
    <>
      <SectionHeader
        action={
          <Pressable accessibilityRole="button" onPress={onMarkAllSeen}>
            <Text style={styles.markSeen}>{unreadCount === 0 ? '모두 확인함' : '모두 읽음'}</Text>
          </Pressable>
        }
        caption="친구가 퀘스트와 업적을 달성하면 알려드려요."
        title={`친구 소식 ${unreadCount > 0 ? `· 새 알림 ${unreadCount}` : ''}`}
      />
      <View style={styles.noticeList}>
        {FRIEND_NOTIFICATIONS.map((notification) => {
          const seen = gameState.seenFriendNotificationIds.includes(notification.id);

          return (
            <Pressable
              accessibilityRole="button"
              key={notification.id}
              onPress={() => onSelectFriend(notification.friendId)}
            >
              <Card style={[styles.noticeCard, !seen && styles.noticeCardUnread]}>
                <View style={styles.noticeIcon}>
                  <Text style={styles.noticeEmoji}>{notification.icon}</Text>
                </View>
                <View style={styles.noticeCopy}>
                  <Text style={styles.noticeMessage}>{notification.message}</Text>
                  <Text style={styles.noticeTime}>{notification.createdAtLabel}</Text>
                </View>
                {!seen ? <View style={styles.unreadDot} /> : null}
              </Card>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

function FriendProfile({ friend, onBack }: { friend: RunnerFriend; onBack: () => void }) {
  const growth = getRunnerGrowthStage(friend.level);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>‹ 친구 목록</Text>
      </Pressable>

      <View style={[styles.profileHero, { backgroundColor: friend.avatarColor }]}>
        <View style={styles.profileGlow} />
        <View style={styles.profileCopy}>
          <Pill tone="dark">RUNNER Lv. {friend.level}</Pill>
          <Text style={styles.profileName}>{friend.name}</Text>
          <Text style={styles.profileHandle}>{friend.handle}</Text>
          <Text style={styles.profileTitle}>{growth.title} · {friend.title}</Text>
        </View>
        <Image accessibilityLabel={`${friend.name}님의 러너 캐릭터`} resizeMode="contain" source={heroImage} style={styles.profileAvatar} />
      </View>

      <View style={styles.profileStatRow}>
        <ProfileMetric label="이번 주" value={`${friend.weeklyDistanceKm.toFixed(1)}km`} />
        <ProfileMetric label="연속 완료" value={`${friend.streak}일`} />
        <ProfileMetric label="업적" value={`${friend.achievementCount}/${friend.totalAchievements}`} />
      </View>

      <SectionHeader caption="친구가 공개한 현재 꾸미기 구성이에요." title="착용 중인 스타일" />
      <Card style={styles.equipmentCard}>
        {Object.entries(friend.equipped).map(([slot, item]) => (
          <View key={slot} style={styles.equipmentChip}>
            <Text style={styles.equipmentSlot}>{slot.toUpperCase()}</Text>
            <Text style={styles.equipmentName}>{item}</Text>
          </View>
        ))}
      </Card>

      <SectionHeader caption="최근 공개된 대표 업적이에요." title="업적 상태" />
      <Card>
        <AchievementRow icon="🔥" label={`${friend.streak}일의 약속`} unlocked />
        <AchievementRow icon="🎒" label="100km의 기억" unlocked={friend.level >= 18} />
        <AchievementRow icon="?" label="아직 발견하지 못한 숨은 업적" unlocked={false} />
      </Card>
    </ScrollView>
  );
}

function SegmentButton({
  active,
  badge = 0,
  label,
  onPress,
}: {
  active: boolean;
  badge?: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
      {badge > 0 ? (
        <View style={styles.segmentBadge}>
          <Text style={styles.segmentBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ModeCard({
  active,
  caption,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  caption: string;
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[styles.modeCard, active && styles.modeCardActive]}
    >
      <Text style={styles.modeIcon}>{icon}</Text>
      <Text style={styles.modeLabel}>{label}</Text>
      <Text style={styles.modeCaption}>{caption}</Text>
      <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

function AvatarBubble({
  color,
  label,
  small = false,
}: {
  color: string;
  label: string;
  small?: boolean;
}) {
  return (
    <View style={[styles.avatarBubble, small && styles.avatarBubbleSmall, { backgroundColor: color }]}>
      <Text style={[styles.avatarLetter, small && styles.avatarLetterSmall]}>{label}</Text>
    </View>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileMetric}>
      <Text style={styles.profileMetricValue}>{value}</Text>
      <Text style={styles.profileMetricLabel}>{label}</Text>
    </View>
  );
}

function AchievementRow({ icon, label, unlocked }: { icon: string; label: string; unlocked: boolean }) {
  return (
    <View style={styles.achievementRow}>
      <View style={[styles.achievementIcon, !unlocked && styles.achievementIconLocked]}>
        <Text style={styles.achievementEmoji}>{icon}</Text>
      </View>
      <Text style={[styles.achievementLabel, !unlocked && styles.achievementLabelLocked]}>{label}</Text>
      <Text style={styles.achievementState}>{unlocked ? '달성' : '잠김'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 132,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  segment: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    flexDirection: 'row',
    marginBottom: 18,
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 13,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  segmentButtonActive: { backgroundColor: colors.navy },
  segmentText: { color: colors.inkMuted, fontSize: 11, fontWeight: '900' },
  segmentTextActive: { color: colors.white },
  segmentBadge: {
    alignItems: 'center',
    backgroundColor: colors.orange,
    borderRadius: 10,
    height: 17,
    justifyContent: 'center',
    marginLeft: 5,
    minWidth: 17,
    paddingHorizontal: 4,
  },
  segmentBadgeText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  socialIntro: { alignItems: 'center', flexDirection: 'row' },
  introIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 18,
    height: 58,
    justifyContent: 'center',
    marginRight: 13,
    width: 58,
  },
  introEmoji: { fontSize: 28 },
  introCopy: { flex: 1 },
  introTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  introCaption: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  friendList: { gap: 10 },
  friendCard: { alignItems: 'center', flexDirection: 'row' },
  avatarBubble: {
    alignItems: 'center',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    marginRight: 12,
    width: 50,
  },
  avatarBubbleSmall: { borderRadius: 18, height: 36, marginRight: 10, width: 36 },
  avatarLetter: { color: colors.white, fontSize: 18, fontWeight: '900' },
  avatarLetterSmall: { fontSize: 13 },
  friendCopy: { flex: 1 },
  friendNameLine: { alignItems: 'center', flexDirection: 'row' },
  friendName: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  friendLevel: { color: colors.brandDark, fontSize: 10, fontWeight: '900', marginLeft: 7 },
  friendStatus: { color: colors.ink, fontSize: 11, marginTop: 5 },
  friendStats: { flexDirection: 'row', marginTop: 6 },
  friendStat: { color: colors.inkMuted, fontSize: 10, fontWeight: '700' },
  friendDot: { color: colors.inkMuted, marginHorizontal: 5 },
  chevron: { color: colors.inkMuted, fontSize: 26 },
  monthlyHero: {
    backgroundColor: colors.navy,
    borderRadius: 28,
    height: 235,
    overflow: 'hidden',
    padding: 22,
    position: 'relative',
  },
  monthlyBlob: {
    backgroundColor: '#164D58',
    borderRadius: 140,
    height: 230,
    position: 'absolute',
    right: -45,
    top: -65,
    width: 230,
  },
  monthlyTitle: { color: colors.white, fontSize: 28, fontWeight: '900', marginTop: 16 },
  monthlyCaption: { color: '#CFE5E1', fontSize: 12, lineHeight: 19, marginTop: 7 },
  monthlyReward: { fontSize: 72, position: 'absolute', right: 38, top: 50 },
  monthlyRewardName: {
    bottom: 20,
    color: colors.yellow,
    fontSize: 12,
    fontWeight: '900',
    position: 'absolute',
    right: 24,
  },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeCard: {
    backgroundColor: colors.surface,
    borderColor: 'transparent',
    borderRadius: 20,
    borderWidth: 2,
    flex: 1,
    padding: 15,
    position: 'relative',
  },
  modeCardActive: { backgroundColor: '#EFFBF6', borderColor: colors.brand },
  modeIcon: { fontSize: 24 },
  modeLabel: { color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: 10 },
  modeCaption: { color: colors.inkMuted, fontSize: 10, marginTop: 4 },
  radio: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: 13,
    top: 13,
    width: 18,
  },
  radioActive: { borderColor: colors.brand },
  radioDot: { backgroundColor: colors.brand, borderRadius: 4, height: 8, width: 8 },
  groupProgressCard: { marginTop: 12 },
  progressTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  progressLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: '800' },
  progressValue: { color: colors.ink, fontSize: 25, fontWeight: '900', marginTop: 4 },
  progressUnit: { color: colors.inkMuted, fontSize: 12 },
  progressPercentPill: {
    backgroundColor: colors.orangeSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  progressPercent: { color: colors.orange, fontSize: 13, fontWeight: '900' },
  remainingText: { color: colors.inkMuted, fontSize: 10, marginBottom: 15, marginTop: 8, textAlign: 'right' },
  hiddenSoloCard: {
    alignItems: 'center',
    backgroundColor: '#F6F1FF',
    borderColor: '#DDD0FA',
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 12,
  },
  hiddenSoloIcon: {
    backgroundColor: colors.purple,
    borderRadius: 20,
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
    height: 40,
    lineHeight: 40,
    marginRight: 12,
    textAlign: 'center',
    width: 40,
  },
  hiddenSoloCopy: { flex: 1 },
  hiddenSoloTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  hiddenSoloCaption: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, marginTop: 4 },
  memberRow: { alignItems: 'center', flexDirection: 'row', paddingVertical: 10 },
  memberDivider: { borderBottomColor: colors.line, borderBottomWidth: 1 },
  memberName: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: '800' },
  memberDistance: { color: colors.brandDark, fontSize: 12, fontWeight: '900' },
  markSeen: { color: colors.brandDark, fontSize: 11, fontWeight: '900' },
  noticeList: { gap: 10 },
  noticeCard: { alignItems: 'center', flexDirection: 'row' },
  noticeCardUnread: { backgroundColor: '#EFFBF6', borderColor: '#C7ECDD', borderWidth: 1 },
  noticeIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    height: 45,
    justifyContent: 'center',
    marginRight: 12,
    width: 45,
  },
  noticeEmoji: { fontSize: 21 },
  noticeCopy: { flex: 1 },
  noticeMessage: { color: colors.ink, fontSize: 11, fontWeight: '700', lineHeight: 17 },
  noticeTime: { color: colors.inkMuted, fontSize: 9, marginTop: 5 },
  unreadDot: { backgroundColor: colors.orange, borderRadius: 4, height: 8, marginLeft: 8, width: 8 },
  backButton: { alignSelf: 'flex-start', marginBottom: 14, paddingVertical: 5 },
  backButtonText: { color: colors.brandDark, fontSize: 13, fontWeight: '900' },
  profileHero: {
    borderRadius: 28,
    height: 310,
    overflow: 'hidden',
    padding: 22,
    position: 'relative',
  },
  profileGlow: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 120,
    height: 230,
    position: 'absolute',
    right: -30,
    top: 20,
    width: 230,
  },
  profileCopy: { zIndex: 3 },
  profileName: { color: colors.navy, fontSize: 30, fontWeight: '900', marginTop: 15 },
  profileHandle: { color: colors.navy, fontSize: 11, marginTop: 3, opacity: 0.65 },
  profileTitle: { color: colors.navy, fontSize: 11, fontWeight: '800', marginTop: 11 },
  profileAvatar: { bottom: -6, height: 235, position: 'absolute', right: 0, width: 220 },
  profileStatRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  profileMetric: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 17,
    flex: 1,
    paddingVertical: 14,
  },
  profileMetricValue: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  profileMetricLabel: { color: colors.inkMuted, fontSize: 9, marginTop: 4 },
  equipmentCard: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  equipmentChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 9,
    width: '48%',
  },
  equipmentSlot: { color: colors.brandDark, fontSize: 8, fontWeight: '900' },
  equipmentName: { color: colors.ink, fontSize: 10, fontWeight: '800', marginTop: 4 },
  achievementRow: { alignItems: 'center', flexDirection: 'row', paddingVertical: 9 },
  achievementIcon: {
    alignItems: 'center',
    backgroundColor: colors.orangeSoft,
    borderRadius: 15,
    height: 38,
    justifyContent: 'center',
    marginRight: 11,
    width: 38,
  },
  achievementIconLocked: { backgroundColor: colors.surfaceMuted },
  achievementEmoji: { fontSize: 18 },
  achievementLabel: { color: colors.ink, flex: 1, fontSize: 11, fontWeight: '800' },
  achievementLabelLocked: { color: colors.inkMuted },
  achievementState: { color: colors.inkMuted, fontSize: 9, fontWeight: '800' },
});
