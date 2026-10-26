import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { PlantedLocation } from '@/domain/capsule';
import { classifyRevealRadius, distanceInMeters } from '@/domain/pit';

export type CheckInState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'inside'; distance: number; accuracy: number }
  | { status: 'outside'; distance: number; accuracy: number }
  | { status: 'uncertain'; distance: number; accuracy: number | null }
  | { status: 'error'; message: string };

/**
 * 2차(AR) 현장 판정 미리보기. 클라이언트 판정은 안내용이며 서버가 최종 판정한다(CHK-02).
 * 현재 좌표 원문은 저장하지 않고 거리·정확도만 상태로 둔다.
 */
export function useCheckIn(target: PlantedLocation | null) {
  const [state, setState] = useState<CheckInState>({ status: 'idle' });
  const [attempts, setAttempts] = useState(0);
  const mounted = useRef(true);

  const measure = useCallback(async () => {
    if (!target) {
      setState({ status: 'error', message: '아직 심은 자리가 없어요. 먼저 캡슐을 심어 주세요.' });
      return;
    }
    setState({ status: 'loading' });
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      if (mounted.current) setState({ status: 'error', message: '위치 권한이 꺼져 있어요. 설정에서 허용한 뒤 다시 확인해 주세요.' });
      return;
    }
    try {
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const distance = distanceInMeters(current.coords, target);
      const accuracy = current.coords.accuracy;
      const decision = classifyRevealRadius(distance, accuracy);
      if (!mounted.current) return;
      setAttempts((count) => count + 1);
      if (decision === 'uncertain') setState({ status: 'uncertain', distance, accuracy });
      else setState({ status: decision, distance, accuracy: accuracy ?? 0 });
    } catch {
      if (mounted.current) setState({ status: 'error', message: '위치를 확인하지 못했어요. 야외에서 한 번 더 시도해 주세요.' });
    }
  }, [target]);

  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => {
      void measure();
    }, 0);
    return () => {
      mounted.current = false;
      clearTimeout(timer);
    };
  }, [measure]);

  return { state, measure, attempts };
}
