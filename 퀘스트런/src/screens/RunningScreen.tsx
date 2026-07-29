import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { calculateRunRewards, type RunRewards } from '../domain/game';
import { applyCompletedRun, type GameState } from '../domain/gameState';
import {
  calculateAverageSpeedKmh,
  calculateEstimatedCalories,
  completeRun,
  formatPace,
  normalizeRoutePath,
  type CompletedRun,
} from '../domain/runTracking';
import { useRunningSession } from '../hooks/useRunningSession';
import { Card, Pill, PrimaryButton, ProgressBar } from '../ui/components';
import { RunRouteMap } from '../ui/RunRouteMap';
import { colors } from '../ui/theme';

interface RunningScreenProps {
  onCancel: () => void;
  onFinish: (run: CompletedRun) => void;
  onUseDemoRun?: () => void;
}

export function RunningScreen({ onCancel, onFinish, onUseDemoRun }: RunningScreenProps) {
  const {
    track,
    elapsedSeconds,
    trackingStatus,
    accuracyMeters,
    errorMessage,
    startedAt,
    distanceKm,
    currentSpeedKmh,
    averageSpeedKmh,
    maxSpeedKmh,
    averagePaceSecondsPerKm,
    togglePause,
    retry,
  } = useRunningSession();
  const paused = trackingStatus === 'paused';
  const formattedTime = formatElapsedTime(elapsedSeconds);
  const canControl = trackingStatus === 'active' || trackingStatus === 'paused';
  const dailyDistanceProgress = Math.min(1, distanceKm);
  const liveRoutePath = normalizeRoutePath(track.acceptedPoints);
  const gpsLabel =
    trackingStatus === 'requesting'
      ? 'GPS 찾는 중'
      : trackingStatus === 'denied'
        ? '권한 필요'
        : trackingStatus === 'error'
          ? 'GPS 오류'
          : accuracyMeters == null
            ? 'GPS 대기'
            : accuracyMeters <= 20
              ? 'GPS 좋음'
              : 'GPS 보통';

  return (
    <SafeAreaView style={styles.runningSafeArea}>
      <View style={styles.runningHeader}>
        <Pressable
          accessibilityLabel="러닝 화면 닫기"
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>×</Text>
        </Pressable>
        <Pill tone="dark">실시간 GPS 기록</Pill>
        <View style={styles.gpsStatus}>
          <View
            style={[styles.gpsDot, (trackingStatus === 'denied' || trackingStatus === 'error') && styles.gpsDotError]}
          />
          <Text style={styles.gpsText}>{gpsLabel}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.runMain}
        showsVerticalScrollIndicator={false}
        style={styles.runMainScroll}
      >
        <Text style={styles.runStatus}>
          {trackingStatus === 'requesting'
            ? '위치를 확인하고 있어요'
            : paused
              ? '잠시 쉬는 중'
              : trackingStatus === 'active'
                ? '안전하게 달리는 중'
                : 'GPS 연결이 필요해요'}
        </Text>
        <Text style={styles.distanceValue}>{distanceKm.toFixed(2)}</Text>
        <Text style={styles.distanceUnit}>km</Text>
        <Text style={styles.livePace}>평균 페이스 {formatPace(averagePaceSecondsPerKm)}</Text>

        <View style={styles.runMetrics}>
          <View style={styles.runMetric}>
            <Text style={styles.runMetricValue}>{formattedTime}</Text>
            <Text style={styles.runMetricLabel}>시간</Text>
          </View>
          <View style={styles.runMetricDivider} />
          <View style={styles.runMetric}>
            <Text style={styles.runMetricValue}>{formatSpeed(currentSpeedKmh)}</Text>
            <Text style={styles.runMetricLabel}>현재 속도</Text>
          </View>
          <View style={styles.runMetricDivider} />
          <View style={styles.runMetric}>
            <Text style={styles.runMetricValue}>{formatSpeed(averageSpeedKmh)}</Text>
            <Text style={styles.runMetricLabel}>평균 속도</Text>
          </View>
          <View style={styles.runMetricDivider} />
          <View style={styles.runMetric}>
            <Text style={styles.runMetricValue}>{formatSpeed(maxSpeedKmh)}</Text>
            <Text style={styles.runMetricLabel}>최고 속도</Text>
          </View>
        </View>

        <RunRouteMap
          caption={
            track.acceptedPoints.length > 0
              ? `GPS ${track.acceptedPoints.length}개 지점 기록 중`
              : '첫 번째 GPS 위치를 기다리고 있어요'
          }
          dark
          height={176}
          path={liveRoutePath}
          style={styles.liveRouteMap}
        />

        {trackingStatus === 'denied' || trackingStatus === 'error' ? (
          <View style={styles.permissionCard}>
            <View style={styles.permissionCardTop}>
              <Text style={styles.permissionIcon}>⌖</Text>
              <View style={styles.permissionCopy}>
                <Text style={styles.permissionTitle}>
                  {trackingStatus === 'denied' ? '위치 권한이 필요해요' : 'GPS 연결을 다시 시도해 주세요'}
                </Text>
                <Text style={styles.permissionText}>
                  {errorMessage ?? '달린 거리와 지역 업적을 기록하려면 위치 권한을 허용해 주세요.'}
                </Text>
              </View>
            </View>
            <PrimaryButton label="위치 권한 다시 확인" onPress={retry} tone="orange" />
            {onUseDemoRun == null ? null : (
              <Pressable
                accessibilityRole="button"
                onPress={onUseDemoRun}
                style={({ pressed }) => [styles.demoRunButton, pressed && styles.pressed]}
              >
                <Text style={styles.demoRunButtonText}>GPS 없이 2km 샘플 러닝 체험</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        <View style={styles.questProgress}>
          <View style={styles.questProgressTop}>
            <Text style={styles.questProgressIcon}>✦</Text>
            <View style={styles.questProgressCopy}>
              <Text style={styles.questProgressTitle}>
                {dailyDistanceProgress >= 1 ? '일일 퀘스트 달성!' : '1km 퀘스트 진행 중'}
              </Text>
              <Text style={styles.questProgressCaption}>
                {dailyDistanceProgress >= 1
                  ? '1km 러닝 · 120 XP 받을 준비 완료'
                  : `${distanceKm.toFixed(2)} / 1km · 계속 달려보세요`}
              </Text>
            </View>
            <Text style={styles.questProgressCheck}>{dailyDistanceProgress >= 1 ? '✓' : ''}</Text>
          </View>
          <ProgressBar color={colors.yellow} value={dailyDistanceProgress} />
        </View>
      </ScrollView>

      <View style={styles.runControls}>
        <Pressable
          accessibilityLabel={paused ? '러닝 다시 시작' : '러닝 일시정지'}
          accessibilityRole="button"
          disabled={!canControl}
          onPress={togglePause}
          style={({ pressed }) => [
            styles.pauseButton,
            !canControl && styles.controlDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.pauseIcon}>{paused ? '▶' : 'Ⅱ'}</Text>
          <Text style={styles.pauseLabel}>{paused ? '계속하기' : '일시정지'}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="러닝 완료"
          accessibilityRole="button"
          disabled={!canControl}
          onPress={() => onFinish(completeRun(track, startedAt, Date.now(), elapsedSeconds))}
          style={({ pressed }) => [
            styles.finishButton,
            !canControl && styles.controlDisabled,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.finishSquare} />
          <Text style={styles.finishLabel}>완료</Text>
        </Pressable>
      </View>

      <Text style={styles.safetyText}>주변을 살피며 달려주세요. 보상은 러닝 종료 후 한 번에 지급돼요.</Text>
    </SafeAreaView>
  );
}

interface RunSummaryScreenProps {
  run: CompletedRun;
  gameState: GameState;
  onContinue: () => void;
}

export function RunSummaryScreen({ run, gameState, onContinue }: RunSummaryScreenProps) {
  const rewards: RunRewards = calculateRunRewards(run.distanceKm);
  const nextGameState = applyCompletedRun(gameState, run);
  const levelProgress = nextGameState.experience / nextGameState.experienceToNextLevel;
  const hasRegionalProgress = Object.keys(run.regionDistancesKm).length > 0;
  const averageSpeedKmh = run.averageSpeedKmh ?? calculateAverageSpeedKmh(run.elapsedSeconds, run.distanceKm * 1_000);
  const maxSpeedKmh = run.maxSpeedKmh ?? averageSpeedKmh;
  const estimatedCaloriesKcal = run.estimatedCaloriesKcal ?? calculateEstimatedCalories(run.distanceKm);

  return (
    <SafeAreaView style={styles.summarySafeArea}>
      <ScrollView contentContainerStyle={styles.summaryContent} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeText}>✓</Text>
        </View>
        <Text style={styles.summaryEyebrow}>RUN COMPLETE</Text>
        <Text style={styles.summaryTitle}>멋진 러닝이었어요!</Text>
        <Text style={styles.summaryCaption}>오늘의 발걸음이 러너 레벨과 새로운 스타일로 이어져요.</Text>

        <Card style={styles.summaryRecordCard}>
          <View style={styles.summaryMainMetric}>
            <Text style={styles.summaryDistance}>{run.distanceKm.toFixed(2)}</Text>
            <Text style={styles.summaryDistanceUnit}>km</Text>
          </View>
          <View style={styles.summaryMetricRow}>
            <SummaryMetric label="시간" value={formatElapsedTime(run.elapsedSeconds)} />
            <View style={styles.summaryMetricDivider} />
            <SummaryMetric label="평균 페이스" value={formatPace(run.averagePaceSecondsPerKm)} />
            <View style={styles.summaryMetricDivider} />
            <SummaryMetric label="평균 속도" value={formatSpeed(averageSpeedKmh)} />
          </View>
        </Card>

        <RunRouteMap caption="GPS 좌표를 지운 상대 경로" path={run.routePath ?? []} style={styles.summaryRouteMap} />

        <Card style={styles.runDetailCard}>
          <Text style={styles.runDetailTitle}>상세 운동 기록</Text>
          <View style={styles.runDetailRow}>
            <RunDetailMetric icon="⚡" label="최고 속도" value={formatSpeed(maxSpeedKmh)} />
            <View style={styles.runDetailDivider} />
            <RunDetailMetric icon="🔥" label="예상 칼로리" value={`${estimatedCaloriesKcal} kcal`} />
          </View>
          <View style={styles.runDetailHorizontalDivider} />
          <View style={styles.runDetailRow}>
            <RunDetailMetric icon="◷" label="이동 시간" value={formatElapsedTime(run.elapsedSeconds)} />
            <View style={styles.runDetailDivider} />
            <RunDetailMetric icon="⌁" label="경로 지점" value={`${run.routePath?.length ?? 0}개`} />
          </View>
          <Text style={styles.calorieNotice}>칼로리는 체중 65kg 기준 예상치예요.</Text>
        </Card>

        <Text style={styles.rewardSectionTitle}>획득한 성장 보상</Text>
        <View style={styles.rewardRow}>
          <View style={[styles.rewardCard, styles.rewardCardExperience]}>
            <Text style={styles.rewardIcon}>✦</Text>
            <Text style={styles.rewardValue}>+{rewards.experience}</Text>
            <Text style={styles.rewardLabel}>경험치</Text>
          </View>
          <View style={[styles.rewardCard, styles.rewardCardEnergy]}>
            <Text style={styles.rewardIcon}>●</Text>
            <Text style={styles.rewardValue}>+{rewards.styleCoins}</Text>
            <Text style={styles.rewardLabel}>러닝 코인</Text>
          </View>
        </View>

        <Card style={styles.levelCard}>
          <View style={styles.levelCardTop}>
            <View>
              <Text style={styles.levelCardTitle}>Lv. {nextGameState.level} 성장 중</Text>
              <Text style={styles.levelCardCaption}>
                다음 레벨까지 {Math.max(0, nextGameState.experienceToNextLevel - nextGameState.experience)} XP
              </Text>
            </View>
            <Text style={styles.levelPercent}>{Math.round(levelProgress * 100)}%</Text>
          </View>
          <ProgressBar color={colors.yellow} height={10} value={levelProgress} />
        </Card>

        {hasRegionalProgress ? (
          <Card style={styles.clueCard}>
            <View style={styles.clueIcon}>
              <Text style={styles.clueIconText}>?</Text>
            </View>
            <View style={styles.clueCopy}>
              <View style={styles.clueTitleRow}>
                <Text style={styles.clueTitle}>지역의 단서를 발견했어요</Text>
                <Pill tone="purple">숨은 업적</Pill>
              </View>
              <Text style={styles.clueText}>
                이 지역에서의 발걸음이 기록됐어요. 더 달리면 특별한 이야기가 열릴지도 몰라요.
              </Text>
            </View>
          </Card>
        ) : null}

        <PrimaryButton icon="✓" label="보상 받고 계속하기" onPress={onContinue} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryMetricValue}>{value}</Text>
      <Text style={styles.summaryMetricLabel}>{label}</Text>
    </View>
  );
}

function RunDetailMetric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.runDetailMetric}>
      <Text style={styles.runDetailIcon}>{icon}</Text>
      <View>
        <Text style={styles.runDetailValue}>{value}</Text>
        <Text style={styles.runDetailLabel}>{label}</Text>
      </View>
    </View>
  );
}

function formatSpeed(speedKmh: number): string {
  return speedKmh > 0 ? `${speedKmh.toFixed(1)} km/h` : '--';
}

function formatElapsedTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  runningSafeArea: {
    backgroundColor: colors.navy,
    flex: 1,
  },
  runningHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 19,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  closeButtonText: {
    color: colors.white,
    fontSize: 25,
    fontWeight: '500',
    marginTop: -2,
  },
  gpsStatus: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  gpsDot: {
    backgroundColor: colors.brand,
    borderRadius: 4,
    height: 8,
    marginRight: 6,
    width: 8,
  },
  gpsDotError: {
    backgroundColor: colors.danger,
  },
  gpsText: {
    color: '#A5C4BD',
    fontSize: 10,
    fontWeight: '700',
  },
  runMain: {
    flexGrow: 1,
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 29,
  },
  runMainScroll: {
    flex: 1,
  },
  runStatus: {
    color: '#A5C4BD',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  distanceValue: {
    color: colors.white,
    fontSize: 78,
    fontWeight: '900',
    letterSpacing: -3,
    marginTop: 4,
    textAlign: 'center',
  },
  distanceUnit: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: '900',
    marginTop: -6,
    textAlign: 'center',
  },
  livePace: {
    color: '#8FAAA5',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  runMetrics: {
    flexDirection: 'row',
    marginTop: 28,
  },
  runMetric: {
    alignItems: 'center',
    flex: 1,
  },
  runMetricValue: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  runMetricLabel: {
    color: '#829F99',
    fontSize: 9,
    marginTop: 5,
  },
  runMetricDivider: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    height: 32,
    width: 1,
  },
  liveRouteMap: {
    marginTop: 24,
  },
  routePreview: {
    backgroundColor: '#132F36',
    borderRadius: 26,
    height: 180,
    marginTop: 26,
    overflow: 'hidden',
    position: 'relative',
  },
  routeGridHorizontalOne: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 58,
  },
  routeGridHorizontalTwo: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 120,
  },
  routeGridVerticalOne: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: 0,
    left: '33%',
    position: 'absolute',
    top: 0,
    width: 1,
  },
  routeGridVerticalTwo: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: 0,
    left: '68%',
    position: 'absolute',
    top: 0,
    width: 1,
  },
  routeLineOne: {
    backgroundColor: colors.brand,
    borderRadius: 4,
    height: 7,
    left: 55,
    position: 'absolute',
    top: 105,
    transform: [{ rotate: '-28deg' }],
    width: 95,
  },
  routeLineTwo: {
    backgroundColor: colors.brand,
    borderRadius: 4,
    height: 7,
    left: 130,
    position: 'absolute',
    top: 79,
    transform: [{ rotate: '18deg' }],
    width: 98,
  },
  routeLineThree: {
    backgroundColor: colors.brand,
    borderRadius: 4,
    height: 7,
    left: 210,
    position: 'absolute',
    top: 64,
    transform: [{ rotate: '-24deg' }],
    width: 75,
  },
  routeStart: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    bottom: 43,
    height: 20,
    justifyContent: 'center',
    left: 45,
    position: 'absolute',
    width: 20,
  },
  routePointText: {
    color: colors.brandDark,
    fontSize: 8,
    fontWeight: '900',
  },
  routeCurrent: {
    alignItems: 'center',
    backgroundColor: 'rgba(22,184,122,0.3)',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 45,
    top: 39,
    width: 32,
  },
  routeCurrentInner: {
    backgroundColor: colors.brand,
    borderColor: colors.white,
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    width: 16,
  },
  routePreviewLabel: {
    bottom: 12,
    color: '#6F8F89',
    fontSize: 8,
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
  },
  permissionCard: {
    backgroundColor: 'rgba(238,102,95,0.12)',
    borderColor: 'rgba(238,102,95,0.32)',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
    padding: 13,
  },
  permissionCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 11,
  },
  permissionIcon: {
    color: colors.danger,
    fontSize: 22,
    marginRight: 11,
  },
  permissionCopy: {
    flex: 1,
  },
  permissionTitle: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  permissionText: {
    color: '#AFC6C1',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },
  demoRunButton: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 9,
    paddingVertical: 12,
  },
  demoRunButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  questProgress: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    marginTop: 14,
    padding: 14,
  },
  questProgressTop: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 10,
  },
  questProgressIcon: {
    color: colors.yellow,
    fontSize: 19,
    marginRight: 10,
  },
  questProgressCopy: {
    flex: 1,
  },
  questProgressTitle: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  questProgressCaption: {
    color: '#8FAAA5',
    fontSize: 8,
    marginTop: 3,
  },
  questProgressCheck: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: '900',
  },
  runControls: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
  },
  pauseButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 21,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 62,
  },
  pauseIcon: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '900',
    marginRight: 8,
  },
  pauseLabel: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  finishButton: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: 21,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 62,
  },
  finishSquare: {
    backgroundColor: colors.white,
    borderRadius: 3,
    height: 15,
    marginRight: 9,
    width: 15,
  },
  finishLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  controlDisabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  safetyText: {
    color: '#78938E',
    fontSize: 9,
    marginBottom: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  summarySafeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  summaryContent: {
    alignItems: 'center',
    paddingBottom: 38,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  summaryBadge: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  summaryBadgeText: {
    color: colors.white,
    fontSize: 25,
    fontWeight: '900',
  },
  summaryEyebrow: {
    color: colors.brandDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginTop: 18,
  },
  summaryTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 7,
  },
  summaryCaption: {
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  summaryRecordCard: {
    marginTop: 22,
    width: '100%',
  },
  summaryMainMetric: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  summaryDistance: {
    color: colors.ink,
    fontSize: 53,
    fontWeight: '900',
    letterSpacing: -2,
  },
  summaryDistanceUnit: {
    color: colors.brandDark,
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 5,
  },
  summaryMetricRow: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    marginTop: 15,
    paddingTop: 15,
  },
  summaryMetric: {
    alignItems: 'center',
    flex: 1,
  },
  summaryMetricValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  summaryMetricLabel: {
    color: colors.inkMuted,
    fontSize: 9,
    marginTop: 4,
  },
  summaryMetricDivider: {
    backgroundColor: colors.line,
    height: 30,
    width: 1,
  },
  summaryRouteMap: {
    marginTop: 12,
  },
  runDetailCard: {
    marginTop: 12,
    width: '100%',
  },
  runDetailTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 15,
  },
  runDetailRow: {
    flexDirection: 'row',
  },
  runDetailMetric: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  runDetailIcon: {
    fontSize: 19,
    marginRight: 9,
  },
  runDetailValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  runDetailLabel: {
    color: colors.inkMuted,
    fontSize: 9,
    marginTop: 3,
  },
  runDetailDivider: {
    backgroundColor: colors.line,
    marginHorizontal: 8,
    width: 1,
  },
  runDetailHorizontalDivider: {
    backgroundColor: colors.line,
    height: 1,
    marginVertical: 14,
  },
  calorieNotice: {
    color: colors.inkFaint,
    fontSize: 8,
    marginTop: 14,
    textAlign: 'right',
  },
  rewardSectionTitle: {
    alignSelf: 'flex-start',
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 11,
    marginTop: 24,
  },
  rewardRow: {
    flexDirection: 'row',
    gap: 11,
    width: '100%',
  },
  rewardCard: {
    alignItems: 'center',
    borderRadius: 22,
    flex: 1,
    padding: 18,
  },
  rewardCardExperience: {
    backgroundColor: colors.orangeSoft,
  },
  rewardCardEnergy: {
    backgroundColor: colors.brandSoft,
  },
  rewardIcon: {
    color: colors.orange,
    fontSize: 22,
  },
  rewardValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 7,
  },
  rewardLabel: {
    color: colors.inkMuted,
    fontSize: 10,
    marginTop: 4,
  },
  levelCard: {
    backgroundColor: colors.navy,
    marginTop: 12,
    width: '100%',
  },
  levelCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  levelCardTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  levelCardCaption: {
    color: '#91AFA9',
    fontSize: 9,
    marginTop: 4,
  },
  levelPercent: {
    color: colors.yellow,
    fontSize: 13,
    fontWeight: '900',
  },
  clueCard: {
    flexDirection: 'row',
    marginBottom: 18,
    marginTop: 12,
    width: '100%',
  },
  clueIcon: {
    alignItems: 'center',
    backgroundColor: '#EEEAFE',
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
    marginRight: 12,
    width: 54,
  },
  clueIconText: {
    color: colors.purple,
    fontSize: 20,
    fontWeight: '900',
  },
  clueCopy: {
    flex: 1,
  },
  clueTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clueTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  clueText: {
    color: colors.inkMuted,
    fontSize: 9,
    lineHeight: 15,
    marginTop: 7,
  },
});
