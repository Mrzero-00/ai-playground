import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getItemById } from '../domain/game';
import { getDailyQuests, type GameState } from '../domain/gameState';
import {
  Card,
  IconButton,
  Metric,
  Pill,
  PrimaryButton,
  ProgressBar,
  ScreenTitle,
  SectionHeader,
} from '../ui/components';
import { colors, radii } from '../ui/theme';
import heroImage from '../../assets/quest-run-hero.png';

interface HomeScreenProps {
  gameState: GameState;
  isHydrated: boolean;
  onStartRun: () => void;
  onOpenQuest: () => void;
  onOpenStyle: () => void;
  onOpenTestLab?: () => void;
}

export function HomeScreen({
  gameState,
  isHydrated,
  onStartRun,
  onOpenQuest,
  onOpenStyle,
  onOpenTestLab,
}: HomeScreenProps) {
  const dailyDistanceQuest = getDailyQuests(gameState).find((quest) => quest.id === 'daily-distance');
  const dailyDistanceProgress = (dailyDistanceQuest?.current ?? 0) / (dailyDistanceQuest?.target ?? 1);
  const remainingExperience = Math.max(0, gameState.experienceToNextLevel - gameState.experience);
  const equippedHeadItem =
    gameState.equippedItemIds.head == null ? undefined : getItemById(gameState.equippedItemIds.head);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenTitle
        eyebrow="QUESTRUN"
        title="오늘도 한 걸음!"
        right={
          isHydrated ? (
            <IconButton
              icon={onOpenTestLab == null ? '⋯' : '⚙'}
              label={onOpenTestLab == null ? '더보기' : '개발 테스트 열기'}
              onPress={onOpenTestLab ?? (() => undefined)}
            />
          ) : (
            <Pill tone="neutral">불러오는 중</Pill>
          )
        }
      />

      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.heroCopy}>
          <Pill tone="dark">Lv. {gameState.level} · 새싹 러너</Pill>
          <Text style={styles.heroName}>루미</Text>
          <Text style={styles.heroMessage}>
            오늘 {remainingExperience} XP만 더 모으면{'\n'}레벨이 올라요.
          </Text>
        </View>

        <Image
          accessibilityLabel="민트색 러닝복을 입은 픽셀 여우 캐릭터"
          resizeMode="contain"
          source={heroImage}
          style={styles.heroImage}
        />

        <View style={styles.heroBottom}>
          <View style={styles.expLabels}>
            <Text style={styles.expLabel}>LEVEL {gameState.level}</Text>
            <Text style={styles.expValue}>
              {gameState.experience.toLocaleString()} / {gameState.experienceToNextLevel.toLocaleString()} XP
            </Text>
          </View>
          <ProgressBar
            color={colors.yellow}
            height={7}
            trackColor="rgba(255,255,255,0.16)"
            value={gameState.experience / gameState.experienceToNextLevel}
          />
        </View>
      </View>

      <Card style={styles.runCard}>
        <View style={styles.runCardTop}>
          <View>
            <Text style={styles.runEyebrow}>오늘의 추천</Text>
            <Text style={styles.runTitle}>편안하게 2km 달리기</Text>
            <Text style={styles.runCaption}>예상 보상 · 200 XP + 러닝 코인 80</Text>
          </View>
          <View style={styles.routeIcon}>
            <Text style={styles.routeIconText}>⌁</Text>
          </View>
        </View>
        <PrimaryButton icon="▶" label="러닝 시작" onPress={onStartRun} tone="brand" />
        <View style={styles.safetyRow}>
          <Text style={styles.safetyIcon}>◉</Text>
          <Text style={styles.safetyText}>달리는 동안에는 기록 화면만 보여드려요.</Text>
        </View>
      </Card>

      <SectionHeader
        action={
          <Pressable accessibilityRole="button" onPress={onOpenQuest}>
            <Text style={styles.sectionAction}>전체보기</Text>
          </Pressable>
        }
        caption={`모두 완료하면 연속 달성 ${gameState.dailyStreak + 1}일째!`}
        title="오늘의 퀘스트"
      />

      <Card style={styles.questCard}>
        <View style={styles.questIconWrap}>
          <Text style={styles.questIcon}>🏃</Text>
        </View>
        <View style={styles.questCopy}>
          <View style={styles.questTitleRow}>
            <Text style={styles.questTitle}>가볍게 몸풀기</Text>
            <Text style={styles.questProgress}>{(dailyDistanceQuest?.current ?? 0).toFixed(2)} / 1km</Text>
          </View>
          <ProgressBar value={dailyDistanceProgress} />
          <Text style={styles.questReward}>완료 보상 · ✦ 120 XP</Text>
        </View>
      </Card>

      <SectionHeader action={<Pill tone="orange">2일 남음</Pill>} title="이번 주 기록" />

      <Card>
        <View style={styles.weekMetrics}>
          <Metric accent={colors.brandDark} label="거리" value={`${gameState.weeklyDistanceKm.toFixed(1)}km`} />
          <View style={styles.metricDivider} />
          <Metric label="러닝" value={`${gameState.weeklyRuns}회`} />
          <View style={styles.metricDivider} />
          <Metric accent={colors.orange} label="연속 달성" value={`${gameState.dailyStreak}일`} />
        </View>
        <View style={styles.weekGoal}>
          <View style={styles.weekGoalLabels}>
            <Text style={styles.weekGoalTitle}>주간 목표 10km</Text>
            <Text style={styles.weekGoalValue}>{Math.min(100, Math.round(gameState.weeklyDistanceKm * 10))}%</Text>
          </View>
          <ProgressBar height={10} value={gameState.weeklyDistanceKm / 10} />
        </View>
      </Card>

      <SectionHeader
        action={
          <Pressable accessibilityRole="button" onPress={onOpenStyle}>
            <Text style={styles.sectionAction}>구경하기</Text>
          </Pressable>
        }
        caption="러닝 코인으로 루미의 오늘 스타일을 바꿔보세요."
        title="오늘의 스타일"
      />

      <Pressable
        accessibilityLabel="스타일 상점 열기"
        accessibilityRole="button"
        onPress={onOpenStyle}
        style={({ pressed }) => [styles.stylePreview, pressed && styles.pressed]}
      >
        <View style={styles.styleArt}>
          <Text style={styles.styleEmoji}>{equippedHeadItem?.icon ?? '🧢'}</Text>
          <View style={styles.styleBadge}>
            <Text style={styles.styleBadgeText}>착용 중</Text>
          </View>
        </View>
        <View style={styles.styleCopy}>
          <Text style={styles.styleLabel}>현재 헤드 아이템</Text>
          <Text style={styles.styleName}>{equippedHeadItem?.name ?? '기본 러닝 스타일'}</Text>
          <Text style={styles.styleCurrency}>보유 코인 · ● {gameState.styleCoins.toLocaleString()}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 128,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  heroCard: {
    backgroundColor: colors.navy,
    borderRadius: 30,
    height: 356,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlow: {
    backgroundColor: '#0D8C7C',
    borderRadius: 180,
    height: 300,
    opacity: 0.35,
    position: 'absolute',
    right: -60,
    top: -54,
    width: 300,
  },
  heroCopy: {
    left: 22,
    position: 'absolute',
    top: 24,
    zIndex: 3,
  },
  heroName: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 14,
  },
  heroMessage: {
    color: '#CFE5E1',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 8,
  },
  heroImage: {
    bottom: 34,
    height: 328,
    position: 'absolute',
    right: -32,
    width: 286,
  },
  heroBottom: {
    backgroundColor: 'rgba(5,18,27,0.7)',
    bottom: 0,
    left: 0,
    paddingBottom: 20,
    paddingHorizontal: 22,
    paddingTop: 15,
    position: 'absolute',
    right: 0,
    zIndex: 5,
  },
  expLabels: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  expLabel: {
    color: colors.yellow,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  expValue: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  runCard: {
    marginTop: 16,
  },
  runCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  runEyebrow: {
    color: colors.brandDark,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 5,
  },
  runTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  runCaption: {
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 6,
  },
  routeIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 20,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  routeIconText: {
    color: colors.brandDark,
    fontSize: 28,
    fontWeight: '900',
    transform: [{ rotate: '-25deg' }],
  },
  safetyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  safetyIcon: {
    color: colors.brand,
    fontSize: 10,
    marginRight: 6,
  },
  safetyText: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  sectionAction: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '800',
    paddingVertical: 4,
  },
  questCard: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  questIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    marginRight: 14,
    width: 52,
  },
  questIcon: {
    fontSize: 24,
  },
  questCopy: {
    flex: 1,
  },
  questTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  questTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  questProgress: {
    color: colors.brandDark,
    fontSize: 11,
    fontWeight: '800',
  },
  questReward: {
    color: colors.inkMuted,
    fontSize: 11,
    marginTop: 8,
  },
  weekMetrics: {
    flexDirection: 'row',
  },
  metricDivider: {
    backgroundColor: colors.line,
    height: 36,
    width: 1,
  },
  weekGoal: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginTop: 18,
    paddingTop: 16,
  },
  weekGoalLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  weekGoalTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  weekGoalValue: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '900',
  },
  stylePreview: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: radii.large,
    flexDirection: 'row',
    minHeight: 116,
    overflow: 'hidden',
    padding: 14,
  },
  styleArt: {
    alignItems: 'center',
    backgroundColor: '#284F47',
    borderRadius: 20,
    height: 88,
    justifyContent: 'center',
    marginRight: 15,
    width: 88,
  },
  styleEmoji: {
    fontSize: 46,
  },
  styleBadge: {
    backgroundColor: colors.orange,
    borderRadius: radii.pill,
    bottom: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    position: 'absolute',
  },
  styleBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
  },
  styleCopy: {
    flex: 1,
  },
  styleLabel: {
    color: '#91B8B0',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 5,
  },
  styleName: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
  },
  styleCurrency: {
    color: '#BED4D0',
    fontSize: 11,
    marginTop: 7,
  },
  chevron: {
    color: colors.white,
    fontSize: 30,
    marginLeft: 5,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});
