import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ENDURANCE_MILESTONES, ITEMS, getItemById, type GameItem, type ItemSlot } from '../domain/game';
import type { GameState } from '../domain/gameState';
import { formatPace, type CompletedRun } from '../domain/runTracking';
import { Card, Metric, Pill, PrimaryButton, ProgressBar, ScreenTitle, SectionHeader } from '../ui/components';
import { RunRouteMap } from '../ui/RunRouteMap';
import { colors, radii } from '../ui/theme';
import heroImage from '../../assets/quest-run-hero.png';

const SLOT_LABELS: Record<ItemSlot, string> = {
  head: '모자',
  top: '상의',
  shoes: '신발',
  accessory: '장식',
};

interface CharacterScreenProps {
  gameState: GameState;
  onEquipItem: (itemId: string) => void;
  onOpenStyle: () => void;
}

export function CharacterScreen({ gameState, onEquipItem, onOpenStyle }: CharacterScreenProps) {
  const [selectedSlot, setSelectedSlot] = useState<ItemSlot>('head');
  const equippedItems = Object.values(gameState.equippedItemIds)
    .map((itemId) => (itemId == null ? undefined : getItemById(itemId)))
    .filter((item): item is GameItem => item != null);
  const ownedItems = ITEMS.filter((item) => item.slot === selectedSlot && gameState.unlockedItemIds.includes(item.id));
  const nextEnduranceMilestone = ENDURANCE_MILESTONES.find((milestone) => milestone.days > gameState.dailyStreak);
  const enduranceProgress = nextEnduranceMilestone == null ? 1 : gameState.dailyStreak / nextEnduranceMilestone.days;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenTitle
        eyebrow="MY RUNNER"
        title="내 아바타"
        right={
          <View style={styles.coinPill}>
            <Text style={styles.coinIcon}>●</Text>
            <Text style={styles.coinText}>{gameState.styleCoins.toLocaleString()}</Text>
          </View>
        }
      />

      <View style={styles.characterCard}>
        <View style={styles.characterGlowOne} />
        <View style={styles.characterGlowTwo} />
        <View style={styles.characterHeader}>
          <Pill tone="dark">RUNNER Lv. {gameState.level}</Pill>
          <Text style={styles.characterTitle}>나만의 러너, 루미</Text>
          <Text style={styles.characterSubtitle}>달릴수록 더 많은 스타일이 열려요.</Text>
        </View>
        <View style={styles.avatarStage}>
          <View style={styles.avatarGround} />
          <Image
            accessibilityLabel="꾸미기 아이템을 착용한 픽셀 여우 캐릭터"
            resizeMode="contain"
            source={heroImage}
            style={styles.characterImage}
          />
          {equippedItems.map((item) => (
            <Text
              key={item.id}
              style={[
                styles.avatarDecoration,
                item.slot === 'head' && styles.avatarHead,
                item.slot === 'top' && styles.avatarTop,
                item.slot === 'shoes' && styles.avatarShoes,
                item.slot === 'accessory' && styles.avatarAccessory,
              ]}
            >
              {item.icon}
            </Text>
          ))}
        </View>
        <View style={styles.characterBottom}>
          <Text style={styles.characterName}>루미</Text>
          <Text style={styles.characterLook}>
            {equippedItems.map((item) => item.name).join(' · ') || '기본 러닝 스타일'}
          </Text>
        </View>
      </View>

      <Card style={styles.runnerCard}>
        <View style={styles.runnerMetrics}>
          <Metric accent={colors.brandDark} label="러너 레벨" value={`Lv. ${gameState.level}`} />
          <View style={styles.metricDivider} />
          <Metric accent={colors.orange} label="누적 거리" value={`${gameState.totalDistanceKm.toFixed(1)}km`} />
          <View style={styles.metricDivider} />
          <Metric accent={colors.purple} label="지구력" value={String(gameState.endurance)} />
        </View>
        <View style={styles.levelLabels}>
          <Text style={styles.levelTitle}>다음 러너 레벨까지</Text>
          <Text style={styles.levelValue}>
            {gameState.experience.toLocaleString()} / {gameState.experienceToNextLevel.toLocaleString()} XP
          </Text>
        </View>
        <ProgressBar color={colors.yellow} value={gameState.experience / gameState.experienceToNextLevel} />
      </Card>

      <SectionHeader
        action={
          <Pressable accessibilityRole="button" onPress={onOpenStyle}>
            <Text style={styles.shopLink}>스타일 상점</Text>
          </Pressable>
        }
        caption="보유한 아이템을 골라 바로 착용할 수 있어요."
        title="내 옷장"
      />

      <View style={styles.slotTabs}>
        {(Object.keys(SLOT_LABELS) as ItemSlot[]).map((slot) => (
          <Pressable
            accessibilityRole="button"
            key={slot}
            onPress={() => setSelectedSlot(slot)}
            style={[styles.slotTab, selectedSlot === slot && styles.slotTabActive]}
          >
            <Text style={[styles.slotTabText, selectedSlot === slot && styles.slotTabTextActive]}>
              {SLOT_LABELS[slot]}
            </Text>
          </Pressable>
        ))}
      </View>

      {ownedItems.length === 0 ? (
        <Card style={styles.emptyWardrobe}>
          <Text style={styles.emptyIcon}>✨</Text>
          <Text style={styles.emptyTitle}>이 칸은 아직 비어 있어요</Text>
          <Text style={styles.emptyCaption}>달리고 코인을 모아 새로운 꾸미기 아이템을 만나보세요.</Text>
          <PrimaryButton icon="●" label="스타일 상점 구경하기" onPress={onOpenStyle} />
        </Card>
      ) : (
        <View style={styles.wardrobeGrid}>
          {ownedItems.map((item) => {
            const equipped = gameState.equippedItemIds[item.slot] === item.id;

            return (
              <Pressable
                accessibilityRole="button"
                key={item.id}
                onPress={() => onEquipItem(item.id)}
                style={[styles.wardrobeItem, equipped && styles.wardrobeItemEquipped]}
              >
                <View style={styles.wardrobeIconWrap}>
                  <Text style={styles.wardrobeIcon}>{item.icon}</Text>
                  {equipped ? (
                    <View style={styles.checkBadge}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={styles.wardrobeName}>
                  {item.name}
                </Text>
                <Text style={[styles.wardrobeState, equipped && styles.wardrobeStateActive]}>
                  {equipped ? '착용 중' : '착용하기'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <SectionHeader caption="일일 퀘스트 연속 완료로 오르는 러너 기록이에요." title="꾸준함 기록" />
      <Card>
        <View style={styles.enduranceInfo}>
          <View style={styles.enduranceCopy}>
            <Text style={styles.enduranceTitle}>다음 지구력 상승까지</Text>
            <Text style={styles.enduranceCaption}>
              {nextEnduranceMilestone == null
                ? '모든 지구력 마일스톤 달성'
                : `일일 퀘스트 ${nextEnduranceMilestone.days - gameState.dailyStreak}일 더 연속 완료`}
            </Text>
          </View>
          <Text style={styles.enduranceDays}>
            {nextEnduranceMilestone == null ? '완료' : `${gameState.dailyStreak} / ${nextEnduranceMilestone.days}일`}
          </Text>
        </View>
        <ProgressBar color={colors.purple} height={8} value={enduranceProgress} />
      </Card>

      <SectionHeader title="성장 기록" />
      <Card>
        <RecordRow label="누적 러닝 거리" value={`${gameState.totalDistanceKm.toFixed(1)}km`} />
        <View style={styles.recordDivider} />
        <RecordRow label="완료한 러닝" value={`${gameState.totalRuns}회`} />
        <View style={styles.recordDivider} />
        <RecordRow label="모은 꾸미기 아이템" value={`${gameState.unlockedItemIds.length}개`} />
      </Card>

      <SectionHeader caption="최근 완료한 러닝은 기기에 최대 30개까지 저장돼요." title="최근 러닝" />
      {gameState.runHistory[0]?.routePath == null ? null : (
        <RunRouteMap
          caption="가장 최근에 완료한 운동 경로"
          height={170}
          path={gameState.runHistory[0].routePath}
          style={styles.latestRouteMap}
        />
      )}
      <Card>
        {gameState.runHistory.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyIcon}>🏃</Text>
            <Text style={styles.emptyTitle}>아직 저장된 러닝이 없어요</Text>
            <Text style={styles.emptyCaption}>첫 러닝을 완료하면 여기에 기록이 나타나요.</Text>
          </View>
        ) : (
          gameState.runHistory
            .slice(0, 3)
            .map((run, index) => (
              <RunHistoryRow isLast={index === Math.min(3, gameState.runHistory.length) - 1} key={run.id} run={run} />
            ))
        )}
      </Card>
    </ScrollView>
  );
}

function RecordRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recordRow}>
      <Text style={styles.recordLabel}>{label}</Text>
      <Text style={styles.recordValue}>{value}</Text>
    </View>
  );
}

function RunHistoryRow({ isLast, run }: { isLast: boolean; run: CompletedRun }) {
  const finishedDate = new Date(run.finishedAt);
  const dateLabel = `${finishedDate.getMonth() + 1}월 ${finishedDate.getDate()}일`;
  const regionLabel = Object.keys(run.regionDistancesKm)[0] ?? '일반 러닝';

  return (
    <View style={[styles.historyRow, !isLast && styles.historyRowDivider]}>
      <View>
        <Text style={styles.historyDateText}>{dateLabel}</Text>
        <Text style={styles.historyRegion}>{regionLabel}</Text>
      </View>
      <View style={styles.historyMetric}>
        <Text style={styles.historyValue}>{run.distanceKm.toFixed(2)}km</Text>
        <Text style={styles.historyPace}>{formatPace(run.averagePaceSecondsPerKm)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 132,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  coinPill: {
    alignItems: 'center',
    backgroundColor: colors.orangeSoft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  coinIcon: {
    color: '#B45E0A',
    fontSize: 12,
    marginRight: 6,
  },
  coinText: {
    color: '#9A4C06',
    fontSize: 13,
    fontWeight: '900',
  },
  characterCard: {
    backgroundColor: colors.navy,
    borderRadius: 30,
    height: 440,
    overflow: 'hidden',
    position: 'relative',
  },
  characterGlowOne: {
    backgroundColor: '#0D8C7C',
    borderRadius: 160,
    height: 300,
    opacity: 0.48,
    position: 'absolute',
    right: -70,
    top: -40,
    width: 300,
  },
  characterGlowTwo: {
    backgroundColor: '#FFC857',
    borderRadius: 90,
    bottom: 20,
    height: 170,
    opacity: 0.12,
    position: 'absolute',
    right: 90,
    width: 170,
  },
  characterHeader: {
    left: 22,
    position: 'absolute',
    top: 22,
    zIndex: 4,
  },
  characterTitle: {
    color: colors.white,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginTop: 13,
  },
  characterSubtitle: {
    color: '#CFE5E1',
    fontSize: 12,
    marginTop: 7,
  },
  avatarStage: {
    bottom: 58,
    height: 320,
    position: 'absolute',
    right: 8,
    width: 290,
  },
  avatarGround: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 100,
    bottom: 10,
    height: 54,
    position: 'absolute',
    right: 18,
    transform: [{ scaleY: 0.45 }],
    width: 210,
  },
  characterImage: {
    bottom: 0,
    height: 300,
    position: 'absolute',
    right: 10,
    width: 250,
  },
  avatarDecoration: {
    fontSize: 39,
    position: 'absolute',
    zIndex: 3,
  },
  avatarHead: {
    right: 96,
    top: 15,
  },
  avatarTop: {
    right: 97,
    top: 142,
  },
  avatarShoes: {
    bottom: 20,
    right: 83,
  },
  avatarAccessory: {
    right: 31,
    top: 142,
  },
  characterBottom: {
    backgroundColor: 'rgba(6,25,35,0.9)',
    bottom: 0,
    left: 0,
    paddingHorizontal: 22,
    paddingVertical: 15,
    position: 'absolute',
    right: 0,
    zIndex: 5,
  },
  characterName: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '900',
  },
  characterLook: {
    color: '#BCD3D0',
    fontSize: 10,
    marginTop: 4,
  },
  runnerCard: {
    marginTop: 14,
  },
  runnerMetrics: {
    flexDirection: 'row',
  },
  metricDivider: {
    backgroundColor: colors.line,
    width: 1,
  },
  levelLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 18,
  },
  levelTitle: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  levelValue: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  shopLink: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '900',
  },
  slotTabs: {
    backgroundColor: colors.surface,
    borderRadius: 15,
    flexDirection: 'row',
    padding: 4,
  },
  slotTab: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 10,
  },
  slotTabActive: {
    backgroundColor: colors.navy,
  },
  slotTabText: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  slotTabTextActive: {
    color: colors.white,
  },
  wardrobeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  wardrobeItem: {
    backgroundColor: colors.surface,
    borderColor: 'transparent',
    borderRadius: 18,
    borderWidth: 2,
    padding: 10,
    width: '48.5%',
  },
  wardrobeItemEquipped: {
    backgroundColor: '#EFFBF6',
    borderColor: colors.brand,
  },
  wardrobeIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    height: 80,
    justifyContent: 'center',
    position: 'relative',
  },
  wardrobeIcon: {
    fontSize: 36,
  },
  checkBadge: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 10,
    height: 21,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    top: 7,
    width: 21,
  },
  checkText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  wardrobeName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 9,
  },
  wardrobeState: {
    color: colors.inkMuted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 5,
  },
  wardrobeStateActive: {
    color: colors.brandDark,
  },
  emptyWardrobe: {
    alignItems: 'center',
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 34,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8,
  },
  emptyCaption: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 15,
    marginTop: 5,
    textAlign: 'center',
  },
  enduranceInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  enduranceCopy: {
    flex: 1,
  },
  enduranceTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  enduranceCaption: {
    color: colors.inkMuted,
    fontSize: 11,
    marginTop: 4,
  },
  enduranceDays: {
    color: colors.purple,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 10,
  },
  recordRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  recordLabel: {
    color: colors.inkMuted,
    fontSize: 12,
  },
  recordValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  recordDivider: {
    backgroundColor: colors.line,
    height: 1,
    marginVertical: 12,
  },
  latestRouteMap: {
    marginBottom: 12,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  historyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  historyRowDivider: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingBottom: 14,
  },
  historyDateText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  historyRegion: {
    color: colors.inkMuted,
    fontSize: 10,
    marginTop: 3,
  },
  historyMetric: {
    alignItems: 'flex-end',
  },
  historyValue: {
    color: colors.brandDark,
    fontSize: 13,
    fontWeight: '900',
  },
  historyPace: {
    color: colors.inkMuted,
    fontSize: 10,
    marginTop: 3,
  },
});
