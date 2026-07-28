import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ENDURANCE_MILESTONES, HIDDEN_ACHIEVEMENTS, ITEMS, type Quest } from '../domain/game';
import { getDailyQuests, getWeeklyQuests, type GameState } from '../domain/gameState';
import { Card, Pill, ProgressBar, ScreenTitle, SectionHeader } from '../ui/components';
import { colors, radii } from '../ui/theme';

type QuestTab = 'daily' | 'weekly' | 'achievement';

interface QuestScreenProps {
  gameState: GameState;
  onClaimQuest: (questId: string) => Promise<void>;
}

export function QuestScreen({ gameState, onClaimQuest }: QuestScreenProps) {
  const [activeTab, setActiveTab] = useState<QuestTab>('daily');

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenTitle
        eyebrow="QUEST BOARD"
        title="퀘스트"
        right={<Pill tone="orange">🔥 {gameState.dailyStreak}일 연속</Pill>}
      />

      <View style={styles.segment}>
        <SegmentButton active={activeTab === 'daily'} label="일일" onPress={() => setActiveTab('daily')} />
        <SegmentButton active={activeTab === 'weekly'} label="주간" onPress={() => setActiveTab('weekly')} />
        <SegmentButton active={activeTab === 'achievement'} label="업적" onPress={() => setActiveTab('achievement')} />
      </View>

      {activeTab === 'daily' ? <DailyPanel gameState={gameState} onClaimQuest={onClaimQuest} /> : null}
      {activeTab === 'weekly' ? <WeeklyPanel gameState={gameState} onClaimQuest={onClaimQuest} /> : null}
      {activeTab === 'achievement' ? <AchievementPanel gameState={gameState} /> : null}
    </ScrollView>
  );
}

function DailyPanel({ gameState, onClaimQuest }: QuestScreenProps) {
  const nextMilestone = ENDURANCE_MILESTONES.find((milestone) => milestone.days > gameState.dailyStreak);
  const calendarCompletedDays = Math.min(7, gameState.dailyStreak);

  return (
    <>
      <Card style={styles.streakCard}>
        <View style={styles.streakHeader}>
          <View>
            <Text style={styles.streakEyebrow}>연속 달성 보너스</Text>
            <Text style={styles.streakTitle}>
              {nextMilestone == null
                ? '최고의 꾸준함을 이어가고 있어요'
                : `${nextMilestone.days - gameState.dailyStreak}일 뒤 지구력 +${nextMilestone.bonus}`}
            </Text>
          </View>
          <View style={styles.enduranceBadge}>
            <Text style={styles.enduranceIcon}>♥</Text>
            <Text style={styles.enduranceValue}>지구력 {gameState.endurance}</Text>
          </View>
        </View>
        <View style={styles.calendarRow}>
          {['월', '화', '수', '목', '금', '토', '일'].map((day, index) => (
            <View key={day} style={styles.calendarDay}>
              <View
                style={[
                  styles.calendarDot,
                  index < calendarCompletedDays ? styles.calendarDotDone : styles.calendarDotNext,
                ]}
              >
                <Text
                  style={[
                    styles.calendarCheck,
                    index < calendarCompletedDays ? styles.calendarCheckDone : styles.calendarCheckNext,
                  ]}
                >
                  {index < calendarCompletedDays ? '✓' : index + 1}
                </Text>
              </View>
              <Text style={styles.calendarLabel}>{day}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.streakNote}>일일 퀘스트를 모두 완료한 날만 연속 기록에 포함돼요.</Text>
      </Card>

      <SectionHeader caption="오늘 자정까지 완료하고 보상을 받아보세요." title="오늘의 퀘스트" />

      <View style={styles.questList}>
        {getDailyQuests(gameState).map((quest) => (
          <QuestRow
            claimed={gameState.claimedQuestIds.includes(quest.id)}
            key={quest.id}
            onClaim={() => onClaimQuest(quest.id)}
            quest={quest}
          />
        ))}
      </View>

      <SectionHeader title="다음 지구력 마일스톤" />
      <Card>
        {ENDURANCE_MILESTONES.map((milestone, index) => (
          <View
            key={milestone.days}
            style={[styles.milestoneRow, index !== ENDURANCE_MILESTONES.length - 1 && styles.milestoneDivider]}
          >
            <View
              style={[styles.milestoneNumber, milestone.days === nextMilestone?.days && styles.milestoneNumberActive]}
            >
              <Text
                style={[
                  styles.milestoneNumberText,
                  milestone.days === nextMilestone?.days && styles.milestoneNumberTextActive,
                ]}
              >
                {milestone.days}
              </Text>
            </View>
            <View style={styles.milestoneCopy}>
              <Text style={styles.milestoneTitle}>{milestone.title}</Text>
              <Text style={styles.milestoneCaption}>{milestone.days}일 연속 완주</Text>
            </View>
            <Pill tone={gameState.awardedEnduranceMilestones.includes(milestone.days) ? 'brand' : 'neutral'}>
              {gameState.awardedEnduranceMilestones.includes(milestone.days) ? '달성' : `지구력 +${milestone.bonus}`}
            </Pill>
          </View>
        ))}
      </Card>
    </>
  );
}

function WeeklyPanel({ gameState, onClaimQuest }: QuestScreenProps) {
  const weeklyProgress = gameState.weeklyDistanceKm / 10;

  return (
    <>
      <Card style={styles.weekSummary}>
        <Text style={styles.weekSummaryLabel}>이번 주 모험 진행도</Text>
        <Text style={styles.weekSummaryValue}>{Math.min(100, Math.round(weeklyProgress * 100))}%</Text>
        <ProgressBar color={colors.orange} height={12} value={weeklyProgress} />
        <View style={styles.weekSummaryMeta}>
          <Text style={styles.weekSummaryText}>{gameState.weeklyDistanceKm.toFixed(1)}km 달성</Text>
          <Text style={styles.weekSummaryText}>목표 10km</Text>
        </View>
      </Card>

      <SectionHeader caption="매주 월요일 오전 0시에 새로 시작해요." title="주간 퀘스트" />
      <View style={styles.questList}>
        {getWeeklyQuests(gameState).map((quest) => (
          <QuestRow
            claimed={gameState.claimedQuestIds.includes(quest.id)}
            key={quest.id}
            onClaim={() => onClaimQuest(quest.id)}
            quest={quest}
          />
        ))}
      </View>

      <SectionHeader title="주간 보스" />
      <Card style={styles.bossCard}>
        <View style={styles.bossIcon}>
          <Text style={styles.bossEmoji}>🐗</Text>
        </View>
        <View style={styles.bossCopy}>
          <Text style={styles.bossLabel}>누적 8km에서 해금</Text>
          <Text style={styles.bossName}>붉은갈기 멧돼지</Text>
          <ProgressBar color={colors.orange} value={gameState.weeklyDistanceKm / 8} />
          <Text style={styles.bossDistance}>앞으로 {Math.max(0, 8 - gameState.weeklyDistanceKm).toFixed(1)}km</Text>
        </View>
      </Card>
    </>
  );
}

function AchievementPanel({ gameState }: { gameState: GameState }) {
  return (
    <>
      <Card style={styles.collectionCard}>
        <View style={styles.collectionIcon}>
          <Text style={styles.collectionIconText}>✦</Text>
        </View>
        <View style={styles.collectionCopy}>
          <Text style={styles.collectionTitle}>숨은 업적 도감</Text>
          <Text style={styles.collectionText}>
            여행지에서 달리면 그 지역만의 특별한 꾸미기 아이템을 발견할 수 있어요.
          </Text>
        </View>
        <Text style={styles.collectionCount}>
          {gameState.unlockedAchievementIds.length} / {HIDDEN_ACHIEVEMENTS.length}
        </Text>
      </Card>

      <SectionHeader caption="달성하기 전에는 정확한 조건이 공개되지 않아요." title="발견하지 못한 이야기" />

      {HIDDEN_ACHIEVEMENTS.map((achievement) => {
        const reward = ITEMS.find((item) => item.id === achievement.rewardItemId);
        const unlocked = gameState.unlockedAchievementIds.includes(achievement.id);

        return (
          <Card key={achievement.id} style={styles.hiddenCard}>
            <View style={styles.hiddenIcon}>
              <Text style={styles.hiddenLock}>{unlocked ? reward?.icon : '?'}</Text>
            </View>
            <View style={styles.hiddenCopy}>
              <View style={styles.hiddenTitleRow}>
                <Text style={styles.hiddenTitle}>{unlocked ? achievement.title : achievement.hiddenTitle}</Text>
                <Pill tone={unlocked ? 'brand' : 'purple'}>{unlocked ? '발견 완료' : '숨은 업적'}</Pill>
              </View>
              <Text style={styles.hiddenHint}>
                {unlocked
                  ? `${achievement.region} 누적 ${achievement.requiredDistanceKm}km 달성`
                  : achievement.hiddenHint}
              </Text>
              <View style={styles.hiddenReward}>
                <Text style={styles.hiddenRewardLabel}>발견 보상</Text>
                <Text style={styles.hiddenRewardValue}>{reward?.icon ?? '✦'} 지역 한정 꾸미기</Text>
              </View>
            </View>
          </Card>
        );
      })}

      <Card style={styles.cosmeticNotice}>
        <Text style={styles.cosmeticNoticeIcon}>♢</Text>
        <View style={styles.cosmeticNoticeCopy}>
          <Text style={styles.cosmeticNoticeTitle}>꾸미기 보상은 공정해요</Text>
          <Text style={styles.cosmeticNoticeText}>
            지역 한정 아이템은 캐릭터의 외형만 바꾸며 공격력과 방어력에는 영향을 주지 않아요.
          </Text>
        </View>
      </Card>
    </>
  );
}

function QuestRow({ quest, claimed, onClaim }: { quest: Quest; claimed: boolean; onClaim: () => void }) {
  const complete = quest.current >= quest.target;
  const progress = quest.current / quest.target;
  const progressText =
    quest.metric === 'distance' ? `${quest.current} / ${quest.target}km` : `${quest.current} / ${quest.target}`;

  return (
    <Card style={styles.questRow}>
      <View style={[styles.questRewardIcon, complete && styles.questRewardIconComplete]}>
        <Text style={styles.questRewardIconText}>{quest.rewardIcon}</Text>
      </View>
      <View style={styles.questRowCopy}>
        <View style={styles.questRowTitleLine}>
          <Text style={styles.questRowTitle}>{quest.title}</Text>
          <Text style={styles.questRowProgress}>{progressText}</Text>
        </View>
        <Text style={styles.questRowDescription}>{quest.description}</Text>
        <ProgressBar color={complete ? colors.orange : colors.brand} height={7} value={progress} />
        <View style={styles.questRowBottom}>
          <Text style={styles.questRowReward}>보상 · {quest.rewardLabel}</Text>
          {complete ? (
            <Pressable
              accessibilityRole="button"
              disabled={claimed}
              onPress={onClaim}
              style={[styles.claimButton, claimed && styles.claimButtonClaimed]}
            >
              <Text style={[styles.claimButtonText, claimed && styles.claimButtonTextClaimed]}>
                {claimed ? '받음' : '받기'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 128,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  segment: {
    backgroundColor: '#E7EEEA',
    borderRadius: radii.medium,
    flexDirection: 'row',
    marginBottom: 18,
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 11,
  },
  segmentButtonActive: {
    backgroundColor: colors.surface,
    shadowColor: '#17382B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  segmentButtonText: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  segmentButtonTextActive: {
    color: colors.ink,
  },
  streakCard: {
    backgroundColor: colors.navy,
  },
  streakHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakEyebrow: {
    color: '#8DBDB3',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 5,
  },
  streakTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
  },
  enduranceBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  enduranceIcon: {
    color: colors.orange,
    fontSize: 15,
  },
  enduranceValue: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  calendarDay: {
    alignItems: 'center',
  },
  calendarDot: {
    alignItems: 'center',
    borderRadius: 18,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  calendarDotDone: {
    backgroundColor: colors.brand,
  },
  calendarDotNext: {
    borderColor: colors.yellow,
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  calendarCheck: {
    fontSize: 12,
    fontWeight: '900',
  },
  calendarCheckDone: {
    color: colors.white,
  },
  calendarCheckNext: {
    color: colors.yellow,
  },
  calendarLabel: {
    color: '#96AEA9',
    fontSize: 10,
    marginTop: 7,
  },
  streakNote: {
    color: '#9BB5AF',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 17,
    textAlign: 'center',
  },
  questList: {
    gap: 12,
  },
  questRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  questRewardIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 17,
    height: 48,
    justifyContent: 'center',
    marginRight: 13,
    width: 48,
  },
  questRewardIconComplete: {
    backgroundColor: colors.orangeSoft,
  },
  questRewardIconText: {
    color: colors.orange,
    fontSize: 21,
    fontWeight: '900',
  },
  questRowCopy: {
    flex: 1,
  },
  questRowTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  questRowTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  questRowProgress: {
    color: colors.brandDark,
    fontSize: 11,
    fontWeight: '800',
  },
  questRowDescription: {
    color: colors.inkMuted,
    fontSize: 11,
    marginBottom: 11,
    marginTop: 4,
  },
  questRowBottom: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 9,
  },
  questRowReward: {
    color: colors.inkMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  claimButton: {
    backgroundColor: colors.orange,
    borderRadius: radii.pill,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  claimButtonClaimed: {
    backgroundColor: colors.surfaceMuted,
  },
  claimButtonText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  claimButtonTextClaimed: {
    color: colors.inkMuted,
  },
  milestoneRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 67,
  },
  milestoneDivider: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
  },
  milestoneNumber: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    marginRight: 12,
    width: 40,
  },
  milestoneNumberActive: {
    backgroundColor: colors.brandSoft,
  },
  milestoneNumberText: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  milestoneNumberTextActive: {
    color: colors.brandDark,
  },
  milestoneCopy: {
    flex: 1,
  },
  milestoneTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  milestoneCaption: {
    color: colors.inkMuted,
    fontSize: 10,
    marginTop: 3,
  },
  weekSummary: {
    backgroundColor: colors.navy,
  },
  weekSummaryLabel: {
    color: '#A5C4BD',
    fontSize: 12,
    fontWeight: '700',
  },
  weekSummaryValue: {
    color: colors.white,
    fontSize: 40,
    fontWeight: '900',
    marginBottom: 16,
    marginTop: 6,
  },
  weekSummaryMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  weekSummaryText: {
    color: '#9EBDB6',
    fontSize: 10,
  },
  bossCard: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  bossIcon: {
    alignItems: 'center',
    backgroundColor: colors.orangeSoft,
    borderRadius: 19,
    height: 72,
    justifyContent: 'center',
    marginRight: 15,
    width: 72,
  },
  bossEmoji: {
    fontSize: 36,
  },
  bossCopy: {
    flex: 1,
  },
  bossLabel: {
    color: colors.orange,
    fontSize: 10,
    fontWeight: '800',
  },
  bossName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
    marginTop: 4,
  },
  bossDistance: {
    color: colors.inkMuted,
    fontSize: 10,
    marginTop: 7,
    textAlign: 'right',
  },
  collectionCard: {
    alignItems: 'center',
    backgroundColor: '#EEEAFE',
    flexDirection: 'row',
  },
  collectionIcon: {
    alignItems: 'center',
    backgroundColor: colors.purple,
    borderRadius: 20,
    height: 58,
    justifyContent: 'center',
    marginRight: 14,
    width: 58,
  },
  collectionIconText: {
    color: colors.white,
    fontSize: 25,
  },
  collectionCopy: {
    flex: 1,
  },
  collectionTitle: {
    color: '#302873',
    fontSize: 16,
    fontWeight: '900',
  },
  collectionText: {
    color: '#6B64A2',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
  },
  collectionCount: {
    color: colors.purple,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 9,
  },
  hiddenCard: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  hiddenIcon: {
    alignItems: 'center',
    backgroundColor: '#E9EEEB',
    borderRadius: 20,
    height: 72,
    justifyContent: 'center',
    marginRight: 14,
    width: 72,
  },
  hiddenLock: {
    color: colors.inkFaint,
    fontSize: 25,
    fontWeight: '900',
  },
  hiddenCopy: {
    flex: 1,
  },
  hiddenTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hiddenTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 2,
  },
  hiddenHint: {
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
  },
  hiddenReward: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 10,
  },
  hiddenRewardLabel: {
    color: colors.inkFaint,
    fontSize: 9,
    fontWeight: '800',
    marginRight: 8,
  },
  hiddenRewardValue: {
    color: colors.purple,
    fontSize: 10,
    fontWeight: '800',
  },
  cosmeticNotice: {
    backgroundColor: colors.orangeSoft,
    flexDirection: 'row',
    marginTop: 6,
  },
  cosmeticNoticeIcon: {
    color: colors.orange,
    fontSize: 25,
    marginRight: 13,
  },
  cosmeticNoticeCopy: {
    flex: 1,
  },
  cosmeticNoticeTitle: {
    color: '#7D350A',
    fontSize: 13,
    fontWeight: '900',
  },
  cosmeticNoticeText: {
    color: '#9F5D33',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
  },
});
