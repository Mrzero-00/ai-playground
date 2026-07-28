import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ENDURANCE_MILESTONES, ITEMS, type GameItem } from '../domain/game';
import type { GameState } from '../domain/gameState';
import { formatPace, type CompletedRun } from '../domain/runTracking';
import { Card, Metric, Pill, ProgressBar, ScreenTitle, SectionHeader } from '../ui/components';
import { RunRouteMap } from '../ui/RunRouteMap';
import { colors, radii } from '../ui/theme';
import heroImage from '../../assets/quest-run-hero.png';

type InventoryTab = 'equipment' | 'cosmetic';

export function CharacterScreen({ gameState }: { gameState: GameState }) {
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>('equipment');
  const [selectedItemId, setSelectedItemId] = useState('wood-sword');
  const nextEnduranceMilestone = ENDURANCE_MILESTONES.find((milestone) => milestone.days > gameState.dailyStreak);
  const enduranceProgress = nextEnduranceMilestone == null ? 1 : gameState.dailyStreak / nextEnduranceMilestone.days;

  const visibleItems = ITEMS.map((item) => ({
    ...item,
    unlocked: gameState.unlockedItemIds.includes(item.id),
  })).filter((item) => (inventoryTab === 'cosmetic' ? item.kind === 'cosmetic' : item.kind !== 'cosmetic'));

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenTitle eyebrow="MY HERO" title="캐릭터" right={<Pill tone="brand">전투력 156</Pill>} />

      <View style={styles.characterCard}>
        <View style={styles.characterGlow} />
        <View style={styles.characterHeader}>
          <Pill tone="dark">Lv. {gameState.level} · 새싹 러너</Pill>
          <View style={styles.currency}>
            <Text style={styles.currencyText}>● {gameState.gold.toLocaleString()}</Text>
          </View>
        </View>
        <Image
          accessibilityLabel="민트색 러닝복과 주황색 러닝화를 착용한 픽셀 여우 캐릭터"
          resizeMode="contain"
          source={heroImage}
          style={styles.characterImage}
        />
        <View style={styles.characterNameCard}>
          <View>
            <Text style={styles.characterName}>루미</Text>
            <Text style={styles.characterTitle}>초록숨 숲의 탐험가</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setInventoryTab('cosmetic')} style={styles.styleButton}>
            <Text style={styles.styleButtonText}>꾸미기</Text>
          </Pressable>
        </View>
      </View>

      <Card style={styles.statCard}>
        <View style={styles.statMetrics}>
          <Metric accent={colors.danger} label="체력" value="48" />
          <View style={styles.metricDivider} />
          <Metric accent={colors.orange} label="공격" value="32" />
          <View style={styles.metricDivider} />
          <Metric accent={colors.brandDark} label="방어" value="24" />
          <View style={styles.metricDivider} />
          <Metric accent={colors.purple} label="지구력" value={String(gameState.endurance)} />
        </View>
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

      <SectionHeader caption="장비 능력치는 모험 전투에만 적용돼요." title="내 아이템" />

      <View style={styles.segment}>
        <SegmentButton
          active={inventoryTab === 'equipment'}
          label="장비"
          onPress={() => setInventoryTab('equipment')}
        />
        <SegmentButton
          active={inventoryTab === 'cosmetic'}
          label="꾸미기"
          onPress={() => setInventoryTab('cosmetic')}
        />
      </View>

      <View style={styles.itemGrid}>
        {visibleItems.map((item) => (
          <ItemCard
            item={item}
            key={item.id}
            onPress={() => setSelectedItemId(item.id)}
            selected={selectedItemId === item.id}
          />
        ))}
      </View>

      {inventoryTab === 'cosmetic' ? (
        <Card style={styles.regionNotice}>
          <View style={styles.regionNoticeIcon}>
            <Text style={styles.regionNoticeEmoji}>🧭</Text>
          </View>
          <View style={styles.regionNoticeCopy}>
            <Text style={styles.regionNoticeTitle}>지역을 달리며 발견하세요</Text>
            <Text style={styles.regionNoticeText}>
              숨은 조건을 달성하면 그 지역의 추억을 담은 꾸미기 아이템이 열려요. 모든 꾸미기 아이템의 전투력은 0이에요.
            </Text>
          </View>
        </Card>
      ) : (
        <Card style={styles.loadoutCard}>
          <View style={styles.loadoutHeader}>
            <Text style={styles.loadoutTitle}>현재 장착 효과</Text>
            <Pill tone="orange">+38 전투력</Pill>
          </View>
          <View style={styles.loadoutRows}>
            <LoadoutRow icon="⚔" label="무기" value="단단한 목검 +12" />
            <LoadoutRow icon="♜" label="상의" value="새싹 바람막이 +18" />
            <LoadoutRow icon="◒" label="신발" value="바람 러닝화 +8" />
          </View>
        </Card>
      )}

      <SectionHeader title="성장 기록" />
      <Card>
        <View style={styles.recordRow}>
          <Text style={styles.recordLabel}>누적 러닝 거리</Text>
          <Text style={styles.recordValue}>{gameState.totalDistanceKm.toFixed(1)}km</Text>
        </View>
        <View style={styles.recordDivider} />
        <View style={styles.recordRow}>
          <Text style={styles.recordLabel}>완료한 퀘스트</Text>
          <Text style={styles.recordValue}>{gameState.claimedQuestIds.length}개</Text>
        </View>
        <View style={styles.recordDivider} />
        <View style={styles.recordRow}>
          <Text style={styles.recordLabel}>오늘 처치한 몬스터</Text>
          <Text style={styles.recordValue}>{gameState.dailyBattles}마리</Text>
        </View>
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
            <Text style={styles.emptyHistoryIcon}>🏃</Text>
            <Text style={styles.emptyHistoryTitle}>아직 저장된 러닝이 없어요</Text>
            <Text style={styles.emptyHistoryCaption}>첫 러닝을 완료하면 여기에 기록이 나타나요.</Text>
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

function RunHistoryRow({ isLast, run }: { isLast: boolean; run: CompletedRun }) {
  const finishedDate = new Date(run.finishedAt);
  const dateLabel = `${finishedDate.getMonth() + 1}월 ${finishedDate.getDate()}일`;
  const regionLabel = Object.keys(run.regionDistancesKm)[0] ?? '일반 러닝';

  return (
    <View style={[styles.historyRow, !isLast && styles.historyRowDivider]}>
      <View style={styles.historyDate}>
        <Text style={styles.historyDateText}>{dateLabel}</Text>
        <Text style={styles.historyRegion}>{regionLabel}</Text>
      </View>
      <View style={styles.historyMetric}>
        <Text style={styles.historyValue}>{run.distanceKm.toFixed(2)}km</Text>
        <Text style={styles.historyPace}>
          {formatPace(run.averagePaceSecondsPerKm)}
          {run.averageSpeedKmh == null ? '' : ` · ${run.averageSpeedKmh.toFixed(1)}km/h`}
        </Text>
      </View>
    </View>
  );
}

function ItemCard({ item, selected, onPress }: { item: GameItem; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!item.unlocked}
      onPress={onPress}
      style={[styles.itemCard, selected && styles.itemCardSelected, !item.unlocked && styles.itemCardLocked]}
    >
      <View style={[styles.itemIcon, item.kind === 'cosmetic' && styles.itemIconCosmetic]}>
        <Text style={styles.itemEmoji}>{item.unlocked ? item.icon : '🔒'}</Text>
      </View>
      <Pill style={styles.itemRarity} tone={item.kind === 'cosmetic' ? 'purple' : 'brand'}>
        {item.rarity}
      </Pill>
      <Text numberOfLines={1} style={styles.itemName}>
        {item.name}
      </Text>
      <Text style={styles.itemPower}>
        {item.kind === 'cosmetic' ? (item.unlocked ? '꾸미기 전용' : '숨은 업적으로 해금') : `전투력 +${item.power}`}
      </Text>
    </Pressable>
  );
}

function LoadoutRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.loadoutRow}>
      <View style={styles.loadoutIcon}>
        <Text style={styles.loadoutIconText}>{icon}</Text>
      </View>
      <Text style={styles.loadoutLabel}>{label}</Text>
      <Text style={styles.loadoutValue}>{value}</Text>
    </View>
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
  characterCard: {
    backgroundColor: colors.navy,
    borderRadius: 30,
    height: 390,
    overflow: 'hidden',
    position: 'relative',
  },
  characterGlow: {
    backgroundColor: '#128A76',
    borderRadius: 170,
    height: 320,
    left: '13%',
    opacity: 0.3,
    position: 'absolute',
    top: 20,
    width: 320,
  },
  characterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 18,
    position: 'absolute',
    right: 18,
    top: 18,
    zIndex: 5,
  },
  currency: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  currencyText: {
    color: colors.yellow,
    fontSize: 11,
    fontWeight: '900',
  },
  characterImage: {
    bottom: 30,
    height: 352,
    left: '7%',
    position: 'absolute',
    width: '86%',
  },
  characterNameCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(5,18,27,0.82)',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    position: 'absolute',
    right: 0,
  },
  characterName: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
  },
  characterTitle: {
    color: '#9BBDB6',
    fontSize: 10,
    marginTop: 4,
  },
  styleButton: {
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  styleButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
  },
  statCard: {
    marginTop: 14,
  },
  statMetrics: {
    flexDirection: 'row',
  },
  metricDivider: {
    backgroundColor: colors.line,
    height: 36,
    width: 1,
  },
  enduranceInfo: {
    alignItems: 'center',
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 17,
    paddingTop: 15,
  },
  enduranceCopy: {
    flex: 1,
  },
  enduranceTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  enduranceCaption: {
    color: colors.inkMuted,
    fontSize: 9,
    marginBottom: 10,
    marginTop: 4,
  },
  enduranceDays: {
    color: colors.purple,
    fontSize: 11,
    fontWeight: '900',
  },
  segment: {
    backgroundColor: '#E7EEEA',
    borderRadius: radii.medium,
    flexDirection: 'row',
    marginBottom: 13,
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
  },
  segmentButtonText: {
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  segmentButtonTextActive: {
    color: colors.ink,
  },
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderColor: 'transparent',
    borderRadius: 20,
    borderWidth: 2,
    padding: 12,
    width: '48.5%',
  },
  itemCardSelected: {
    borderColor: colors.brand,
  },
  itemCardLocked: {
    opacity: 0.58,
  },
  itemIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 17,
    height: 62,
    justifyContent: 'center',
    marginBottom: 10,
    width: '100%',
  },
  itemIconCosmetic: {
    backgroundColor: '#EEEAFE',
  },
  itemEmoji: {
    fontSize: 30,
  },
  itemRarity: {
    minHeight: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  itemName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 7,
  },
  itemPower: {
    color: colors.inkMuted,
    fontSize: 9,
    marginTop: 4,
  },
  regionNotice: {
    backgroundColor: '#EEEAFE',
    flexDirection: 'row',
    marginTop: 14,
  },
  regionNoticeIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
    marginRight: 13,
    width: 54,
  },
  regionNoticeEmoji: {
    fontSize: 27,
  },
  regionNoticeCopy: {
    flex: 1,
  },
  regionNoticeTitle: {
    color: '#403886',
    fontSize: 13,
    fontWeight: '900',
  },
  regionNoticeText: {
    color: '#6F68A1',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
  },
  loadoutCard: {
    marginTop: 14,
  },
  loadoutHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  loadoutTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  loadoutRows: {
    marginTop: 5,
  },
  loadoutRow: {
    alignItems: 'center',
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: 55,
  },
  loadoutIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    height: 34,
    justifyContent: 'center',
    marginRight: 10,
    width: 34,
  },
  loadoutIconText: {
    color: colors.brandDark,
    fontSize: 16,
  },
  loadoutLabel: {
    color: colors.inkMuted,
    fontSize: 10,
    width: 40,
  },
  loadoutValue: {
    color: colors.ink,
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  recordRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  recordLabel: {
    color: colors.inkMuted,
    fontSize: 11,
  },
  recordValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  recordDivider: {
    backgroundColor: colors.line,
    height: 1,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  emptyHistoryIcon: {
    fontSize: 28,
  },
  emptyHistoryTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 8,
  },
  emptyHistoryCaption: {
    color: colors.inkMuted,
    fontSize: 10,
    marginTop: 4,
  },
  historyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  historyRowDivider: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    marginBottom: 12,
    paddingBottom: 12,
  },
  historyDate: {
    flex: 1,
  },
  historyDateText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  historyRegion: {
    color: colors.inkMuted,
    fontSize: 9,
    marginTop: 4,
  },
  historyMetric: {
    alignItems: 'flex-end',
  },
  historyValue: {
    color: colors.brandDark,
    fontSize: 14,
    fontWeight: '900',
  },
  historyPace: {
    color: colors.inkMuted,
    fontSize: 9,
    marginTop: 4,
  },
  latestRouteMap: {
    marginBottom: 12,
  },
});
