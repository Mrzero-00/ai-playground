import { getServerTime } from '@apps-in-toss/framework';
import { createRoute } from '@granite-js/react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import {
  applyCompletedRun,
  claimGroupQuestReward,
  claimQuestReward,
  equipItem,
  getDateKey,
  markFriendNotificationsSeen,
  purchaseItem,
  selectAvatarPreset,
  selectGroupQuestMode,
} from '../domain/gameState';
import { createDemoRun, type CompletedRun, type DemoRunOptions } from '../domain/runTracking';
import { usePersistentGameState } from '../hooks/usePersistentGameState';
import { CharacterScreen } from '../screens/CharacterScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { QuestScreen } from '../screens/QuestScreen';
import { RunConsentScreen } from '../screens/RunConsentScreen';
import { RunningScreen, RunSummaryScreen } from '../screens/RunningScreen';
import { SocialScreen } from '../screens/SocialScreen';
import { StyleShopScreen } from '../screens/StyleShopScreen';
import { TestLabModal } from '../screens/TestLabModal';
import { colors, radii } from '../ui/theme';

export const Route = createRoute('/', {
  component: QuestRunApp,
});

type AppTab = 'home' | 'quest' | 'style' | 'social' | 'character';
type RunFlow = 'idle' | 'consent' | 'running' | 'summary';

const NAV_ITEMS: Array<{ id: AppTab; label: string; icon: string }> = [
  { id: 'home', label: '홈', icon: '⌂' },
  { id: 'quest', label: '퀘스트', icon: '✓' },
  { id: 'style', label: '스타일', icon: '✦' },
  { id: 'social', label: '친구', icon: '♧' },
  { id: 'character', label: '아바타', icon: '♙' },
];

const TEST_LAB_ENABLED = __DEV__;

function QuestRunApp() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [runFlow, setRunFlow] = useState<RunFlow>('idle');
  const [completedRun, setCompletedRun] = useState<CompletedRun | null>(null);
  const [testLabVisible, setTestLabVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { gameState, isHydrated, resetGameState, updateGameState } = usePersistentGameState();

  const startDemoRun = (options: DemoRunOptions) => {
    setCompletedRun(createDemoRun(options));
    setTestLabVisible(false);
    setRunFlow('summary');
  };

  useEffect(() => {
    if (toast == null) {
      return;
    }

    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  if (runFlow === 'running') {
    return (
      <>
        <StatusBar barStyle="light-content" />
        <RunningScreen
          onCancel={() => setRunFlow('idle')}
          onFinish={(run) => {
            setCompletedRun(run);
            setRunFlow('summary');
          }}
          onUseDemoRun={
            TEST_LAB_ENABLED
              ? () =>
                  startDemoRun({
                    distanceKm: 2,
                    paceSecondsPerKm: 390,
                    region: '서울특별시',
                  })
              : undefined
          }
        />
      </>
    );
  }

  if (runFlow === 'consent') {
    return (
      <RunConsentScreen
        onCancel={() => setRunFlow('idle')}
        onContinue={() => setRunFlow('running')}
      />
    );
  }

  if (runFlow === 'summary' && completedRun != null) {
    return (
      <>
        <StatusBar barStyle="dark-content" />
        <RunSummaryScreen
          gameState={gameState}
          run={completedRun}
          onContinue={() => {
            updateGameState((current) => applyCompletedRun(current, completedRun));
            setCompletedRun(null);
            setRunFlow('idle');
            setActiveTab('home');
            setToast('러닝 보상과 퀘스트 진행도가 반영됐어요.');
          }}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.app}>
        <View style={styles.screen}>
          {activeTab === 'home' ? (
            <HomeScreen
              gameState={gameState}
              isHydrated={isHydrated}
              onOpenStyle={() => setActiveTab('style')}
              onOpenQuest={() => setActiveTab('quest')}
              onOpenTestLab={TEST_LAB_ENABLED ? () => setTestLabVisible(true) : undefined}
              onStartRun={() => setRunFlow('consent')}
            />
          ) : null}
          {activeTab === 'quest' ? (
            <QuestScreen
              gameState={gameState}
              onClaimQuest={async (questId) => {
                let timestamp = Date.now();
                try {
                  if (getServerTime.isSupported()) {
                    timestamp = (await getServerTime()) ?? timestamp;
                  }
                } catch {
                  // 서버 시간을 사용할 수 없는 로컬 환경에서는 기기 시간을 사용한다.
                }

                updateGameState((current) => claimQuestReward(current, questId, getDateKey(timestamp)));
                setToast('퀘스트 보상을 받았어요!');
              }}
            />
          ) : null}
          {activeTab === 'style' ? (
            <StyleShopScreen
              gameState={gameState}
              onEquipItem={(itemId) => {
                updateGameState((current) => equipItem(current, itemId));
                setToast('러너의 스타일을 바꿨어요!');
              }}
              onPurchaseItem={(itemId) => {
                updateGameState((current) => equipItem(purchaseItem(current, itemId), itemId));
                setToast('새 꾸미기 아이템을 얻고 바로 착용했어요!');
              }}
            />
          ) : null}
          {activeTab === 'social' ? (
            <SocialScreen
              gameState={gameState}
              onClaimGroupQuest={() => {
                updateGameState((current) => claimGroupQuestReward(current));
                setToast('월간 한정 꾸미기 보상을 받았어요!');
              }}
              onMarkNotificationsSeen={(notificationIds) => {
                updateGameState((current) => markFriendNotificationsSeen(current, notificationIds));
              }}
              onSelectGroupMode={(mode) => {
                updateGameState((current) => selectGroupQuestMode(current, mode));
                setToast(mode === 'group' ? '친구들과 함께 도전해요!' : '혼자 400km 도전을 시작했어요.');
              }}
            />
          ) : null}
          {activeTab === 'character' ? (
            <CharacterScreen
              gameState={gameState}
              onEquipItem={(itemId) => {
                updateGameState((current) => equipItem(current, itemId));
                setToast('러너의 스타일을 바꿨어요!');
              }}
              onOpenStyle={() => setActiveTab('style')}
              onSelectAvatarPreset={(preset) => {
                updateGameState((current) => selectAvatarPreset(current, preset));
                setToast(preset === 'mori' ? '남자 러너 모리로 변경했어요!' : '여자 러너 루미로 변경했어요!');
              }}
            />
          ) : null}
        </View>

        <BottomNavigation activeTab={activeTab} onSelectTab={setActiveTab} />

        {toast ? (
          <View accessibilityLiveRegion="polite" style={styles.toast}>
            <Text style={styles.toastIcon}>✓</Text>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}

        {TEST_LAB_ENABLED ? (
          <TestLabModal
            gameState={gameState}
            onClose={() => setTestLabVisible(false)}
            onReset={() => {
              resetGameState();
              setTestLabVisible(false);
              setToast('테스트 데이터가 처음 상태로 초기화됐어요.');
            }}
            onStartDemoRun={startDemoRun}
            visible={testLabVisible}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function BottomNavigation({ activeTab, onSelectTab }: { activeTab: AppTab; onSelectTab: (tab: AppTab) => void }) {
  return (
    <View style={styles.navOuter}>
      <View style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeTab;

          return (
            <Pressable
              accessibilityLabel={`${item.label} 화면`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={item.id}
              onPress={() => onSelectTab(item.id)}
              style={({ pressed }) => [styles.navItem, pressed && styles.navPressed]}
            >
              <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
                <Text style={[styles.navIcon, active && styles.navIconActive]}>{item.icon}</Text>
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  app: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  navOuter: {
    bottom: 10,
    left: 14,
    position: 'absolute',
    right: 14,
  },
  nav: {
    backgroundColor: colors.surface,
    borderRadius: 25,
    flexDirection: 'row',
    minHeight: 76,
    paddingHorizontal: 7,
    paddingVertical: 9,
    shadowColor: '#07241A',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 12,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  navPressed: {
    opacity: 0.68,
  },
  navIconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 34,
    justifyContent: 'center',
    width: 42,
  },
  navIconWrapActive: {
    backgroundColor: colors.brandSoft,
  },
  navIcon: {
    color: colors.inkFaint,
    fontSize: 19,
    fontWeight: '800',
  },
  navIconActive: {
    color: colors.brandDark,
  },
  navLabel: {
    color: colors.inkFaint,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
  },
  navLabelActive: {
    color: colors.brandDark,
    fontWeight: '900',
  },
  toast: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: radii.medium,
    bottom: 98,
    flexDirection: 'row',
    left: 24,
    paddingHorizontal: 16,
    paddingVertical: 13,
    position: 'absolute',
    right: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  toastIcon: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '900',
    marginRight: 9,
  },
  toastText: {
    color: colors.white,
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
  },
});
