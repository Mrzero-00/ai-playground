import React from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GameState } from '../domain/gameState';
import type { DemoRunOptions } from '../domain/runTracking';
import { Card, Pill } from '../ui/components';
import { colors, radii } from '../ui/theme';

interface TestLabModalProps {
  gameState: GameState;
  onClose: () => void;
  onReset: () => void;
  onStartDemoRun: (options: DemoRunOptions) => void;
  visible: boolean;
}

const SCENARIOS: Array<{
  id: string;
  icon: string;
  title: string;
  description: string;
  reward: string;
  options: DemoRunOptions;
}> = [
  {
    id: 'seoul-2km',
    icon: '🏙️',
    title: '서울 2km 러닝',
    description: '일일 거리·러닝 퀘스트와 경험치 획득을 확인해요.',
    reward: '200 XP · 러닝 코인 80',
    options: {
      distanceKm: 2,
      paceSecondsPerKm: 390,
      region: '서울특별시',
    },
  },
  {
    id: 'jeju-5km',
    icon: '🍊',
    title: '제주 5km 러닝',
    description: '지역 누적 거리와 숨은 한라봉 모자 업적을 확인해요.',
    reward: '500 XP · 한라봉 모자',
    options: {
      distanceKm: 5,
      paceSecondsPerKm: 420,
      region: '제주특별자치도',
    },
  },
  {
    id: 'short-run',
    icon: '🌱',
    title: '짧은 500m 러닝',
    description: '퀘스트를 아직 달성하지 않은 중간 상태를 확인해요.',
    reward: '50 XP · 러닝 코인 20',
    options: {
      distanceKm: 0.5,
      paceSecondsPerKm: 450,
      region: '서울특별시',
    },
  },
];

export function TestLabModal({ gameState, onClose, onReset, onStartDemoRun, visible }: TestLabModalProps) {
  const confirmReset = () => {
    Alert.alert('테스트 데이터 초기화', '러닝 기록과 해금한 아이템을 처음 상태로 되돌릴까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화',
        style: 'destructive',
        onPress: onReset,
      },
    ]);
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>DEVELOPMENT</Text>
            <Text style={styles.title}>테스트 러닝</Text>
          </View>
          <Pressable
            accessibilityLabel="테스트 화면 닫기"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.statusCard}>
            <View style={styles.statusTop}>
              <View>
                <Text style={styles.statusTitle}>현재 저장 상태</Text>
                <Text style={styles.statusCaption}>선택한 러닝도 실제 기록과 동일하게 저장돼요.</Text>
              </View>
              <Pill tone="orange">개발 전용</Pill>
            </View>
            <View style={styles.metrics}>
              <TestMetric label="레벨" value={`Lv. ${gameState.level}`} />
              <View style={styles.metricDivider} />
              <TestMetric label="오늘 거리" value={`${gameState.dailyDistanceKm.toFixed(2)}km`} />
              <View style={styles.metricDivider} />
              <TestMetric label="러닝 코인" value={gameState.styleCoins.toLocaleString()} />
            </View>
          </Card>

          <Text style={styles.sectionTitle}>테스트 시나리오</Text>
          <Text style={styles.sectionCaption}>GPS 없이 러닝 완료 화면부터 보상 반영까지 확인할 수 있어요.</Text>

          <View style={styles.scenarioList}>
            {SCENARIOS.map((scenario) => (
              <Pressable
                accessibilityLabel={`${scenario.title} 시작`}
                accessibilityRole="button"
                key={scenario.id}
                onPress={() => onStartDemoRun(scenario.options)}
                style={({ pressed }) => [styles.scenarioCard, pressed && styles.pressed]}
              >
                <View style={styles.scenarioIcon}>
                  <Text style={styles.scenarioEmoji}>{scenario.icon}</Text>
                </View>
                <View style={styles.scenarioCopy}>
                  <Text style={styles.scenarioTitle}>{scenario.title}</Text>
                  <Text style={styles.scenarioDescription}>{scenario.description}</Text>
                  <Text style={styles.scenarioReward}>{scenario.reward}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>

          <Card style={styles.guideCard}>
            <Text style={styles.guideTitle}>추천 테스트 순서</Text>
            <Text style={styles.guideText}>
              1. 서울 2km 러닝 완료{'\n'}
              2. 퀘스트에서 거리·러닝 보상 수령{'\n'}
              3. 스타일 상점에서 아이템 구매{'\n'}
              4. 내 아바타에서 새 아이템 착용
            </Text>
          </Card>

          <Pressable
            accessibilityRole="button"
            onPress={confirmReset}
            style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
          >
            <Text style={styles.resetText}>저장된 테스트 데이터 초기화</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function TestMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 15,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  eyebrow: {
    color: colors.orange,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 3,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  closeText: {
    color: colors.ink,
    fontSize: 27,
    marginTop: -2,
  },
  content: {
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  statusCard: {
    backgroundColor: colors.navy,
  },
  statusTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '900',
  },
  statusCaption: {
    color: '#A8C5BF',
    fontSize: 10,
    marginTop: 5,
  },
  metrics: {
    borderTopColor: 'rgba(255,255,255,0.12)',
    borderTopWidth: 1,
    flexDirection: 'row',
    marginTop: 17,
    paddingTop: 17,
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#89AAA3',
    fontSize: 9,
    marginTop: 5,
  },
  metricDivider: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    height: 32,
    width: 1,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 27,
  },
  sectionCaption: {
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  scenarioList: {
    gap: 10,
    marginTop: 14,
  },
  scenarioCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.large,
    flexDirection: 'row',
    padding: 15,
  },
  scenarioIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
    marginRight: 13,
    width: 54,
  },
  scenarioEmoji: {
    fontSize: 25,
  },
  scenarioCopy: {
    flex: 1,
  },
  scenarioTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  scenarioDescription: {
    color: colors.inkMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  scenarioReward: {
    color: colors.brandDark,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
  },
  chevron: {
    color: colors.inkFaint,
    fontSize: 25,
    marginLeft: 9,
  },
  guideCard: {
    backgroundColor: colors.brandSoft,
    marginTop: 22,
  },
  guideTitle: {
    color: colors.brandDark,
    fontSize: 14,
    fontWeight: '900',
  },
  guideText: {
    color: '#376A60',
    fontSize: 11,
    lineHeight: 20,
    marginTop: 9,
  },
  resetButton: {
    alignItems: 'center',
    borderColor: '#F1B4B4',
    borderRadius: radii.medium,
    borderWidth: 1,
    marginTop: 14,
    paddingVertical: 15,
  },
  resetText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.99 }],
  },
});
