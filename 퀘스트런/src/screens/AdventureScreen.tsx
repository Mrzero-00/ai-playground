import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { ADVENTURE_STAGES, getAdventureStageState, getItemById, type AdventureStage } from '../domain/game';
import { getCurrentAdventureStage, type GameState } from '../domain/gameState';
import { Card, Metric, Pill, PrimaryButton, ProgressBar, ScreenTitle, SectionHeader } from '../ui/components';
import { colors, radii } from '../ui/theme';

const MAP_HEIGHT = 680;
const NODE_SIZE = 68;
const PATH_POSITIONS = [
  { x: 0.22, y: 0.91 },
  { x: 0.54, y: 0.8 },
  { x: 0.78, y: 0.68 },
  { x: 0.48, y: 0.57 },
  { x: 0.2, y: 0.46 },
  { x: 0.43, y: 0.35 },
  { x: 0.76, y: 0.25 },
  { x: 0.57, y: 0.14 },
  { x: 0.27, y: 0.1 },
] as const;

interface AdventureScreenProps {
  gameState: GameState;
  onCompleteStage: (stageId: string) => void;
}

export function AdventureScreen({ gameState, onCompleteStage }: AdventureScreenProps) {
  const currentStage = getCurrentAdventureStage(gameState);
  const [selectedStageId, setSelectedStageId] = useState(
    currentStage?.id ?? ADVENTURE_STAGES.at(-1)?.id ?? ADVENTURE_STAGES[0]!.id
  );
  const [mapWidth, setMapWidth] = useState(335);
  const [monsterHp, setMonsterHp] = useState(ADVENTURE_STAGES[0]!.monsterHp);
  const [autoHunting, setAutoHunting] = useState(false);
  const [battleTurn, setBattleTurn] = useState(0);
  const [battleMessage, setBattleMessage] = useState('현재 스테이지를 선택하고 자동사냥을 시작하세요.');
  const [lastClearedStageId, setLastClearedStageId] = useState<string | null>(null);
  const completeStageRef = useRef(onCompleteStage);
  const selectedStage = ADVENTURE_STAGES.find((stage) => stage.id === selectedStageId) ?? ADVENTURE_STAGES[0]!;
  const selectedStageState = getAdventureStageState(gameState.clearedAdventureStageIds, selectedStage.id);
  const selectedRewardItem = selectedStage.rewardItemId == null ? undefined : getItemById(selectedStage.rewardItemId);
  const clearedCount = gameState.clearedAdventureStageIds.filter((stageId) =>
    ADVENTURE_STAGES.some((stage) => stage.id === stageId)
  ).length;
  const hasEnoughEnergy = gameState.battleEnergy >= selectedStage.energyCost;

  useEffect(() => {
    completeStageRef.current = onCompleteStage;
  }, [onCompleteStage]);

  useEffect(() => {
    if (autoHunting) {
      return;
    }

    if (lastClearedStageId === selectedStage.id) {
      return;
    }

    setMonsterHp(selectedStage.monsterHp);
    setBattleTurn(0);
    setBattleMessage(
      selectedStageState === 'cleared'
        ? '이미 클리어한 스테이지예요. 다음 스테이지로 이동할 수 있어요.'
        : selectedStageState === 'locked'
          ? '앞 스테이지를 클리어하면 길이 열려요.'
          : '버튼을 한 번 누르면 루미가 끝까지 자동으로 사냥해요.'
    );
  }, [autoHunting, lastClearedStageId, selectedStage.id, selectedStage.monsterHp, selectedStageState]);

  useEffect(() => {
    if (!autoHunting) {
      return;
    }

    const timer = setTimeout(() => {
      const nextHp = Math.max(0, monsterHp - selectedStage.autoDamage);
      const nextTurn = battleTurn + 1;
      setMonsterHp(nextHp);
      setBattleTurn(nextTurn);

      if (nextHp === 0) {
        setAutoHunting(false);
        setLastClearedStageId(selectedStage.id);
        setBattleMessage(
          `${selectedStage.monsterName} 처치 완료! ${selectedStage.goldReward} 골드와 전리품을 획득했어요.`
        );
        completeStageRef.current(selectedStage.id);
        return;
      }

      setBattleMessage(`${nextTurn}번째 자동 공격 · ${selectedStage.autoDamage} 피해! 남은 HP ${nextHp}`);
    }, 620);

    return () => clearTimeout(timer);
  }, [autoHunting, battleTurn, monsterHp, selectedStage]);

  const mapPoints = useMemo(
    () =>
      PATH_POSITIONS.map((position) => ({
        x: position.x * mapWidth,
        y: position.y * MAP_HEIGHT,
      })),
    [mapWidth]
  );

  const pathSegments = useMemo(
    () =>
      mapPoints.slice(1).map((point, index) => {
        const previous = mapPoints[index]!;
        const deltaX = point.x - previous.x;
        const deltaY = point.y - previous.y;
        const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);

        return {
          angle: Math.atan2(deltaY, deltaX),
          centerX: (point.x + previous.x) / 2,
          centerY: (point.y + previous.y) / 2,
          length,
        };
      }),
    [mapPoints]
  );

  const startAutoHunt = () => {
    if (selectedStageState !== 'current' || !hasEnoughEnergy || autoHunting) {
      return;
    }

    setLastClearedStageId(null);
    setMonsterHp(selectedStage.monsterHp);
    setBattleTurn(0);
    setBattleMessage(`${selectedStage.monsterName} 자동사냥을 시작했어요.`);
    setAutoHunting(true);
  };

  const handlePrimaryAction = () => {
    if (selectedStageState === 'cleared' && currentStage != null) {
      setSelectedStageId(currentStage.id);
      return;
    }

    startAutoHunt();
  };

  const selectStage = (stage: AdventureStage) => {
    if (autoHunting || getAdventureStageState(gameState.clearedAdventureStageIds, stage.id) === 'locked') {
      return;
    }
    setSelectedStageId(stage.id);
    setLastClearedStageId(null);
  };

  const handleMapLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth !== mapWidth) {
      setMapWidth(nextWidth);
    }
  };

  const primaryLabel = autoHunting
    ? `자동사냥 중 · ${battleTurn}회 공격`
    : selectedStageState === 'cleared'
      ? currentStage == null
        ? '초록숨 숲 모든 단계 완료'
        : `다음 ${currentStage.number}단계로 이동`
      : selectedStageState === 'locked'
        ? '이전 단계를 먼저 클리어하세요'
        : hasEnoughEnergy
          ? `자동사냥 시작 · 에너지 ${selectedStage.energyCost}`
          : `에너지 ${selectedStage.energyCost - gameState.battleEnergy} 부족`;
  const primaryDisabled =
    autoHunting ||
    selectedStageState === 'locked' ||
    (selectedStageState === 'current' && !hasEnoughEnergy) ||
    (selectedStageState === 'cleared' && currentStage == null);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenTitle eyebrow="ADVENTURE" title="모험" right={<Pill tone="orange">⚡ {gameState.battleEnergy}</Pill>} />

      <Card style={styles.chapterCard}>
        <View>
          <Text style={styles.chapterEyebrow}>CHAPTER 1</Text>
          <Text style={styles.chapterTitle}>초록숨 숲</Text>
          <Text style={styles.chapterCaption}>
            완료 {clearedCount} / {ADVENTURE_STAGES.length} 스테이지
          </Text>
        </View>
        <View style={styles.chapterBadge}>
          <Text style={styles.chapterBadgeIcon}>{clearedCount === ADVENTURE_STAGES.length ? '👑' : '🌿'}</Text>
          <Text style={styles.chapterBadgeText}>
            {clearedCount === ADVENTURE_STAGES.length ? '챕터 정복' : `다음 ${currentStage?.number ?? 9}단계`}
          </Text>
        </View>
      </Card>

      <SectionHeader caption="클리어한 길을 따라 다음 몬스터가 열려요." title="초록숨 숲 스테이지" />
      <View onLayout={handleMapLayout} style={styles.stageMap}>
        <View style={styles.mapCloudOne} />
        <View style={styles.mapCloudTwo} />
        <Text style={styles.mapTreeOne}>🌲</Text>
        <Text style={styles.mapTreeTwo}>🌳</Text>
        <Text style={styles.mapRock}>🪨</Text>

        {pathSegments.map((segment, index) => {
          const destinationStage = ADVENTURE_STAGES[index + 1]!;
          const reached =
            gameState.clearedAdventureStageIds.includes(destinationStage.id) ||
            currentStage?.id === destinationStage.id;

          return (
            <View
              key={destinationStage.id}
              pointerEvents="none"
              style={[
                styles.pathSegment,
                reached && styles.pathSegmentReached,
                {
                  left: segment.centerX - segment.length / 2,
                  top: segment.centerY - 3,
                  transform: [{ rotate: `${segment.angle}rad` }],
                  width: segment.length,
                },
              ]}
            />
          );
        })}

        {ADVENTURE_STAGES.map((stage, index) => {
          const stageState = getAdventureStageState(gameState.clearedAdventureStageIds, stage.id);
          const selected = selectedStage.id === stage.id;
          const position = mapPoints[index]!;

          return (
            <Pressable
              accessibilityLabel={`${stage.number}단계 ${stage.name} · ${
                stageState === 'cleared' ? '완료' : stageState === 'current' ? '도전 가능' : '잠김'
              }`}
              accessibilityRole="button"
              disabled={stageState === 'locked' || autoHunting}
              key={stage.id}
              onPress={() => selectStage(stage)}
              style={({ pressed }) => [
                styles.stageNodeWrap,
                {
                  left: position.x - NODE_SIZE / 2,
                  top: position.y - NODE_SIZE / 2,
                },
                pressed && styles.pressed,
              ]}
            >
              {stage.isBoss ? <Text style={styles.bossCrown}>♛</Text> : null}
              <View
                style={[
                  styles.stageNode,
                  stageState === 'cleared' && styles.stageNodeCleared,
                  stageState === 'current' && styles.stageNodeCurrent,
                  stageState === 'locked' && styles.stageNodeLocked,
                  selected && styles.stageNodeSelected,
                ]}
              >
                <Text style={styles.stageNodeIcon}>
                  {stageState === 'locked' ? '🔒' : stageState === 'cleared' ? '★' : stage.monsterIcon}
                </Text>
              </View>
              <View style={[styles.stageNumberBadge, selected && styles.stageNumberBadgeSelected]}>
                <Text style={[styles.stageNumber, selected && styles.stageNumberSelected]}>{stage.number}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader
        action={
          <Pill tone={selectedStageState === 'current' ? 'orange' : 'neutral'}>
            {selectedStageState === 'cleared' ? '클리어' : selectedStageState === 'current' ? '현재 단계' : '잠김'}
          </Pill>
        }
        caption={`${selectedStage.number}단계 · ${selectedStage.name}`}
        title={selectedStage.monsterName}
      />

      <View style={styles.monsterScene}>
        <View style={styles.sceneMoon} />
        <View style={styles.sceneHillOne} />
        <View style={styles.sceneHillTwo} />
        <View style={styles.monsterShadow} />
        <Text style={[styles.monsterEmoji, autoHunting && battleTurn % 2 === 1 && styles.monsterHit]}>
          {monsterHp === 0 ? '💥' : selectedStage.monsterIcon}
        </Text>
        <View style={[styles.monsterTag, selectedStage.isBoss && styles.monsterTagBoss]}>
          <Text style={styles.monsterTagText}>{selectedStage.isBoss ? '보스 몬스터' : '스테이지 몬스터'}</Text>
        </View>
        {autoHunting ? (
          <View style={styles.autoBadge}>
            <View style={styles.autoDot} />
            <Text style={styles.autoBadgeText}>AUTO HUNTING</Text>
          </View>
        ) : null}
        <View style={styles.monsterInfo}>
          <View style={styles.monsterNameRow}>
            <Text style={styles.monsterName}>{selectedStage.monsterName}</Text>
            <Text style={styles.monsterLevel}>Stage {selectedStage.number}</Text>
          </View>
          <ProgressBar
            color={monsterHp === 0 ? colors.inkFaint : colors.danger}
            height={10}
            trackColor="rgba(255,255,255,0.16)"
            value={monsterHp / selectedStage.monsterHp}
          />
          <Text style={styles.monsterHp}>
            {monsterHp === 0 ? '처치 완료' : `${monsterHp} / ${selectedStage.monsterHp} HP`}
          </Text>
        </View>
      </View>

      <Card style={styles.powerCard}>
        <View style={styles.powerMetrics}>
          <Metric accent={colors.brandDark} label="내 전투력" value="156" />
          <View style={styles.metricDivider} />
          <Metric label="필요 에너지" value={String(selectedStage.energyCost)} />
          <View style={styles.metricDivider} />
          <Metric accent={colors.orange} label="자동 공격" value={`+${selectedStage.autoDamage}`} />
        </View>
        <View style={[styles.battleMessage, autoHunting && styles.battleMessageActive]}>
          <Text style={styles.battleMessageIcon}>{autoHunting ? '⚔' : monsterHp === 0 ? '✓' : '⚡'}</Text>
          <Text style={styles.battleMessageText}>{battleMessage}</Text>
        </View>
        <PrimaryButton
          disabled={primaryDisabled}
          icon={autoHunting ? '◌' : selectedStageState === 'cleared' ? '›' : '▶'}
          label={primaryLabel}
          onPress={handlePrimaryAction}
          tone={selectedStageState === 'cleared' ? 'brand' : 'orange'}
        />
      </Card>

      {lastClearedStageId === selectedStage.id ? (
        <Card style={styles.lootCard}>
          <View style={styles.lootIcon}>
            <Text style={styles.lootIconText}>{selectedRewardItem?.icon ?? '●'}</Text>
          </View>
          <View style={styles.lootCopy}>
            <Text style={styles.lootEyebrow}>STAGE CLEAR REWARD</Text>
            <Text style={styles.lootTitle}>{selectedRewardItem?.name ?? `${selectedStage.goldReward} 골드`} 획득!</Text>
            <Text style={styles.lootCaption}>
              {selectedRewardItem == null
                ? '다음 스테이지가 열렸어요.'
                : `${selectedRewardItem.rarity} · 전투력 +${selectedRewardItem.power}`}
            </Text>
          </View>
          <Pill tone="brand">다음 길 오픈</Pill>
        </Card>
      ) : null}

      <SectionHeader title="현재 단계 보상" />
      <Card>
        <View style={styles.dropRow}>
          <DropItem
            icon={selectedRewardItem?.icon ?? '●'}
            label={selectedRewardItem?.name ?? '골드'}
            rarity={selectedRewardItem?.rarity ?? String(selectedStage.goldReward)}
          />
          <DropItem icon="🪨" label="숲의 조각" rarity={`${selectedStage.number + 1}개`} />
          <DropItem icon="⚡" label="자동사냥" rarity={`${selectedStage.energyCost} 소모`} />
        </View>
        <Text style={styles.dropNote}>
          자동사냥 버튼을 누른 뒤에는 조작하지 않아도 전투가 끝까지 진행돼요. 전투 장비는 실제 운동 보상에는 영향을 주지
          않아요.
        </Text>
      </Card>
    </ScrollView>
  );
}

function DropItem({ icon, label, rarity }: { icon: string; label: string; rarity: string }) {
  return (
    <View style={styles.dropItem}>
      <View style={styles.dropIcon}>
        <Text style={styles.dropEmoji}>{icon}</Text>
      </View>
      <Text numberOfLines={1} style={styles.dropLabel}>
        {label}
      </Text>
      <Text style={styles.dropRarity}>{rarity}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 128,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  chapterCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  chapterEyebrow: {
    color: colors.brandDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  chapterTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  chapterCaption: {
    color: colors.inkMuted,
    fontSize: 10,
    marginTop: 5,
  },
  chapterBadge: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 17,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chapterBadgeIcon: {
    fontSize: 17,
  },
  chapterBadgeText: {
    color: colors.brandDark,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
  },
  stageMap: {
    backgroundColor: '#DFF3E8',
    borderRadius: 30,
    height: MAP_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  mapCloudOne: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 60,
    height: 82,
    position: 'absolute',
    right: -20,
    top: 90,
    width: 130,
  },
  mapCloudTwo: {
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderRadius: 50,
    bottom: 90,
    height: 65,
    left: -20,
    position: 'absolute',
    width: 110,
  },
  mapTreeOne: {
    fontSize: 42,
    left: 20,
    opacity: 0.45,
    position: 'absolute',
    top: 160,
  },
  mapTreeTwo: {
    bottom: 110,
    fontSize: 46,
    opacity: 0.45,
    position: 'absolute',
    right: 18,
  },
  mapRock: {
    fontSize: 32,
    opacity: 0.35,
    position: 'absolute',
    right: 35,
    top: 355,
  },
  pathSegment: {
    backgroundColor: 'rgba(73,119,98,0.18)',
    borderRadius: 3,
    height: 6,
    position: 'absolute',
  },
  pathSegmentReached: {
    backgroundColor: colors.brand,
  },
  stageNodeWrap: {
    alignItems: 'center',
    height: 92,
    position: 'absolute',
    width: NODE_SIZE,
  },
  stageNode: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: 'rgba(16,42,46,0.08)',
    borderRadius: NODE_SIZE / 2,
    borderWidth: 4,
    height: NODE_SIZE,
    justifyContent: 'center',
    shadowColor: '#174B39',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    width: NODE_SIZE,
    elevation: 5,
  },
  stageNodeCleared: {
    backgroundColor: colors.brand,
    borderColor: '#8BE2BE',
  },
  stageNodeCurrent: {
    backgroundColor: colors.orange,
    borderColor: '#FFD0B1',
  },
  stageNodeLocked: {
    backgroundColor: '#BCCBC4',
    borderColor: '#D6E0DB',
    opacity: 0.72,
  },
  stageNodeSelected: {
    borderColor: colors.yellow,
    borderWidth: 5,
    transform: [{ scale: 1.08 }],
  },
  stageNodeIcon: {
    color: colors.white,
    fontSize: 27,
    fontWeight: '900',
  },
  stageNumberBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 11,
    bottom: 5,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    width: 30,
  },
  stageNumberBadgeSelected: {
    backgroundColor: colors.navy,
  },
  stageNumber: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  stageNumberSelected: {
    color: colors.white,
  },
  bossCrown: {
    color: colors.orange,
    fontSize: 20,
    position: 'absolute',
    top: -18,
    zIndex: 4,
  },
  monsterScene: {
    backgroundColor: colors.navy,
    borderRadius: 30,
    height: 350,
    overflow: 'hidden',
    position: 'relative',
  },
  sceneMoon: {
    backgroundColor: '#E2F5C8',
    borderRadius: 55,
    height: 110,
    opacity: 0.18,
    position: 'absolute',
    right: 30,
    top: 25,
    width: 110,
  },
  sceneHillOne: {
    backgroundColor: '#163F3A',
    borderRadius: 140,
    bottom: -75,
    height: 190,
    left: -40,
    position: 'absolute',
    width: 300,
  },
  sceneHillTwo: {
    backgroundColor: '#214D42',
    borderRadius: 140,
    bottom: -100,
    height: 210,
    position: 'absolute',
    right: -40,
    width: 320,
  },
  monsterShadow: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 70,
    bottom: 83,
    height: 32,
    left: '27%',
    position: 'absolute',
    width: '46%',
  },
  monsterEmoji: {
    fontSize: 132,
    left: '25%',
    position: 'absolute',
    top: 58,
  },
  monsterHit: {
    opacity: 0.55,
    transform: [{ scale: 0.92 }],
  },
  monsterTag: {
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    left: 18,
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: 'absolute',
    top: 18,
  },
  monsterTagBoss: {
    backgroundColor: colors.orange,
  },
  monsterTagText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
  },
  autoBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.pill,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    right: 18,
    top: 18,
  },
  autoDot: {
    backgroundColor: colors.yellow,
    borderRadius: 4,
    height: 7,
    marginRight: 6,
    width: 7,
  },
  autoBadgeText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  monsterInfo: {
    backgroundColor: 'rgba(5,17,25,0.82)',
    bottom: 0,
    left: 0,
    paddingBottom: 19,
    paddingHorizontal: 20,
    paddingTop: 15,
    position: 'absolute',
    right: 0,
  },
  monsterNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monsterName: {
    color: colors.white,
    fontSize: 19,
    fontWeight: '900',
  },
  monsterLevel: {
    color: '#B1C9C4',
    fontSize: 11,
    fontWeight: '800',
  },
  monsterHp: {
    color: '#B8D0CB',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'right',
  },
  powerCard: {
    marginTop: 14,
  },
  powerMetrics: {
    flexDirection: 'row',
  },
  metricDivider: {
    backgroundColor: colors.line,
    height: 36,
    width: 1,
  },
  battleMessage: {
    alignItems: 'center',
    backgroundColor: colors.orangeSoft,
    borderRadius: 13,
    flexDirection: 'row',
    marginBottom: 14,
    marginTop: 17,
    padding: 11,
  },
  battleMessageActive: {
    backgroundColor: colors.brandSoft,
  },
  battleMessageIcon: {
    color: colors.orange,
    fontSize: 14,
    marginRight: 8,
  },
  battleMessageText: {
    color: '#70472C',
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 15,
  },
  lootCard: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    flexDirection: 'row',
    marginTop: 14,
  },
  lootIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 17,
    height: 54,
    justifyContent: 'center',
    marginRight: 12,
    width: 54,
  },
  lootIconText: {
    fontSize: 27,
  },
  lootCopy: {
    flex: 1,
  },
  lootEyebrow: {
    color: colors.brandDark,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  lootTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 3,
  },
  lootCaption: {
    color: colors.inkMuted,
    fontSize: 9,
    marginTop: 3,
  },
  dropRow: {
    flexDirection: 'row',
  },
  dropItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  dropIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  dropEmoji: {
    fontSize: 25,
  },
  dropLabel: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 8,
    maxWidth: 92,
  },
  dropRarity: {
    color: colors.inkFaint,
    fontSize: 9,
    marginTop: 3,
  },
  dropNote: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    color: colors.inkMuted,
    fontSize: 9,
    lineHeight: 15,
    marginTop: 17,
    paddingTop: 13,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
