import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Metric, Pill, PrimaryButton, ProgressBar, ScreenTitle, SectionHeader } from '../ui/components';
import { colors, radii } from '../ui/theme';

const STAGES = [
  { id: 1, label: '2-1', icon: '🍄', state: 'done' },
  { id: 2, label: '2-2', icon: '🐾', state: 'done' },
  { id: 3, label: '2-3', icon: '🗿', state: 'current' },
  { id: 4, label: '2-4', icon: '🌑', state: 'locked' },
] as const;

export function AdventureScreen({
  battleEnergy,
  onSpendEnergy,
  onMonsterDefeated,
}: {
  battleEnergy: number;
  onSpendEnergy: (amount: number) => void;
  onMonsterDefeated: () => void;
}) {
  const [monsterHp, setMonsterHp] = useState(168);
  const [battleMessage, setBattleMessage] = useState('러닝으로 모은 에너지를 사용해 공격해요.');
  const defeated = monsterHp === 0;

  const attackMonster = () => {
    if (battleEnergy < 120 || defeated) {
      return;
    }

    const nextHp = Math.max(0, monsterHp - 84);
    setMonsterHp(nextHp);
    onSpendEnergy(120);
    if (nextHp === 0) {
      onMonsterDefeated();
    }
    setBattleMessage(
      nextHp === 0
        ? '이끼 골렘을 처치했어요! 첫 처치 보상을 확인하세요.'
        : '84 피해! 한 번 더 공격하면 쓰러뜨릴 수 있어요.'
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenTitle eyebrow="ADVENTURE" title="모험" right={<Pill tone="orange">⚡ {battleEnergy}</Pill>} />

      <Card style={styles.chapterCard}>
        <View>
          <Text style={styles.chapterEyebrow}>CHAPTER 2</Text>
          <Text style={styles.chapterTitle}>초록숨 숲</Text>
          <Text style={styles.chapterCaption}>완료 2 / 7 스테이지</Text>
        </View>
        <View style={styles.chapterBadge}>
          <Text style={styles.chapterBadgeIcon}>🌿</Text>
          <Text style={styles.chapterBadgeText}>숲의 조각 4</Text>
        </View>
      </Card>

      <View style={styles.monsterScene}>
        <View style={styles.sceneMoon} />
        <View style={styles.sceneHillOne} />
        <View style={styles.sceneHillTwo} />
        <View style={styles.monsterShadow} />
        <Text style={styles.monsterEmoji}>🗿</Text>
        <View style={styles.monsterTag}>
          <Text style={styles.monsterTagText}>정예 몬스터</Text>
        </View>
        <View style={styles.monsterInfo}>
          <View style={styles.monsterNameRow}>
            <Text style={styles.monsterName}>이끼 골렘</Text>
            <Text style={styles.monsterLevel}>Lv. 6</Text>
          </View>
          <ProgressBar
            color={defeated ? colors.inkFaint : colors.danger}
            height={10}
            trackColor="rgba(255,255,255,0.16)"
            value={monsterHp / 168}
          />
          <Text style={styles.monsterHp}>{defeated ? '처치 완료' : `${monsterHp} / 168 HP`}</Text>
        </View>
      </View>

      <Card style={styles.powerCard}>
        <View style={styles.powerMetrics}>
          <Metric accent={colors.brandDark} label="내 전투력" value="156" />
          <View style={styles.metricDivider} />
          <Metric label="권장 전투력" value="140" />
          <View style={styles.metricDivider} />
          <Metric accent={colors.orange} label="예상 승률" value={defeated ? '완료' : '높음'} />
        </View>
        <View style={styles.battleMessage}>
          <Text style={styles.battleMessageIcon}>{defeated ? '✓' : '⚡'}</Text>
          <Text style={styles.battleMessageText}>{battleMessage}</Text>
        </View>
        <PrimaryButton
          disabled={defeated || battleEnergy < 120}
          icon={defeated ? '✓' : '⚔'}
          label={defeated ? '첫 처치 완료' : '에너지 120으로 공격'}
          onPress={attackMonster}
          tone={defeated ? 'dark' : 'orange'}
        />
      </Card>

      {defeated ? (
        <Card style={styles.lootCard}>
          <View style={styles.lootIcon}>
            <Text style={styles.lootIconText}>🧤</Text>
          </View>
          <View style={styles.lootCopy}>
            <Text style={styles.lootEyebrow}>FIRST CLEAR REWARD</Text>
            <Text style={styles.lootTitle}>숲빛 장갑 획득!</Text>
            <Text style={styles.lootCaption}>희귀 · 공격력 +16</Text>
          </View>
          <Pill tone="brand">새 장비</Pill>
        </Card>
      ) : null}

      <SectionHeader caption="몬스터를 처치하면 다음 길이 열려요." title="초록숨 숲 지도" />
      <ScrollView contentContainerStyle={styles.stageList} horizontal showsHorizontalScrollIndicator={false}>
        {STAGES.map((stage) => (
          <View
            key={stage.id}
            style={[
              styles.stageCard,
              stage.state === 'current' && styles.stageCardCurrent,
              stage.state === 'locked' && styles.stageCardLocked,
            ]}
          >
            <View
              style={[
                styles.stageIcon,
                stage.state === 'done' && styles.stageIconDone,
                stage.state === 'current' && styles.stageIconCurrent,
              ]}
            >
              <Text style={styles.stageEmoji}>{stage.state === 'locked' ? '🔒' : stage.icon}</Text>
            </View>
            <Text style={[styles.stageLabel, stage.state === 'current' && styles.stageLabelCurrent]}>
              {stage.label}
            </Text>
            <Text style={styles.stageState}>
              {stage.state === 'done' ? '완료' : stage.state === 'current' ? '도전 중' : '잠김'}
            </Text>
          </View>
        ))}
      </ScrollView>

      <SectionHeader title="가능한 전리품" />
      <Card>
        <View style={styles.dropRow}>
          <DropItem icon="🧤" label="숲빛 장갑" rarity="희귀" />
          <DropItem icon="🪨" label="골렘 핵" rarity="재료" />
          <DropItem icon="●" label="골드" rarity="40~90" />
        </View>
        <Text style={styles.dropNote}>전투 장비는 모험 능력치만 높이며 실제 운동 보상에는 영향을 주지 않아요.</Text>
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
      <Text style={styles.dropLabel}>{label}</Text>
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
    marginBottom: 14,
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
    fontSize: 142,
    left: '24%',
    position: 'absolute',
    top: 50,
  },
  monsterTag: {
    backgroundColor: colors.orange,
    borderRadius: radii.pill,
    left: 18,
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: 'absolute',
    top: 18,
  },
  monsterTagText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
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
  battleMessageIcon: {
    color: colors.orange,
    fontSize: 14,
    marginRight: 8,
  },
  battleMessageText: {
    color: '#8B4A22',
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
  stageList: {
    gap: 10,
    paddingRight: 20,
  },
  stageCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    minWidth: 100,
    padding: 13,
  },
  stageCardCurrent: {
    backgroundColor: colors.navy,
  },
  stageCardLocked: {
    opacity: 0.55,
  },
  stageIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  stageIconDone: {
    backgroundColor: colors.brandSoft,
  },
  stageIconCurrent: {
    backgroundColor: colors.orange,
  },
  stageEmoji: {
    fontSize: 25,
  },
  stageLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 9,
  },
  stageLabelCurrent: {
    color: colors.white,
  },
  stageState: {
    color: colors.inkFaint,
    fontSize: 9,
    marginTop: 3,
  },
  dropRow: {
    flexDirection: 'row',
  },
  dropItem: {
    alignItems: 'center',
    flex: 1,
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
});
