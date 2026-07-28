import { Storage } from '@apps-in-toss/framework';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_GAME_STATE, migrateGameState, rolloverGameState, type GameState } from '../domain/gameState';

const STORAGE_KEY = 'quest-run:game-state:v2';

export function usePersistentGameState() {
  const [gameState, setGameState] = useState<GameState>(DEFAULT_GAME_STATE);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadGameState() {
      try {
        const storedValue = await Storage.getItem(STORAGE_KEY);
        if (storedValue != null && active) {
          const parsed = JSON.parse(storedValue) as Record<string, unknown>;
          setGameState(rolloverGameState(migrateGameState(parsed), Date.now()));
        }
      } catch {
        // 샌드박스 밖의 UI 테스트에서는 기본 상태를 사용한다.
      } finally {
        if (active) {
          hasLoadedRef.current = true;
          setIsHydrated(true);
        }
      }
    }

    void loadGameState();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      return;
    }

    void Storage.setItem(STORAGE_KEY, JSON.stringify(gameState)).catch(() => {
      // 저장 실패가 운동 흐름을 중단시키지 않도록 다음 변경 때 다시 시도한다.
    });
  }, [gameState]);

  const updateGameState = useCallback((updater: (current: GameState) => GameState) => {
    setGameState((current) => updater(current));
  }, []);

  const resetGameState = useCallback(() => {
    const timestamp = Date.now();
    setGameState({
      ...DEFAULT_GAME_STATE,
      dailyDateKey: rolloverGameState(DEFAULT_GAME_STATE, timestamp).dailyDateKey,
      weeklyDateKey: rolloverGameState(DEFAULT_GAME_STATE, timestamp).weeklyDateKey,
      claimedQuestIds: [],
      unlockedItemIds: [...DEFAULT_GAME_STATE.unlockedItemIds],
      equippedItemIds: { ...DEFAULT_GAME_STATE.equippedItemIds },
      unlockedAchievementIds: [],
      awardedEnduranceMilestones: [],
      regionDistancesKm: {},
      runHistory: [],
    });
  }, []);

  return {
    gameState,
    isHydrated,
    resetGameState,
    updateGameState,
  };
}
