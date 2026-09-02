import { Accuracy, getAnonymousKey, getCurrentLocation, openCamera } from '@apps-in-toss/web-framework';
import type { AppLocation } from '../types';

const LOCAL_KEY = 'hangang-letter-local-user-key';

export async function resolveAnonymousUserKey(): Promise<string> {
  try {
    const result = await getAnonymousKey();
    if (typeof result === 'object' && result?.type === 'HASH') return result.hash;
  } catch {
    // 일반 브라우저 개발 환경에서는 로컬 익명키를 사용합니다.
  }

  const existing = localStorage.getItem(LOCAL_KEY);
  if (existing) return existing;
  const generated = `local-${crypto.randomUUID()}`;
  localStorage.setItem(LOCAL_KEY, generated);
  return generated;
}

export async function acquireCurrentLocation(): Promise<AppLocation> {
  try {
    const result = await getCurrentLocation({ accuracy: Accuracy.Balanced });
    return {
      latitude: result.coords.latitude,
      longitude: result.coords.longitude,
      accuracy: result.coords.accuracy ?? 999,
    };
  } catch {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('이 기기에서 위치 정보를 사용할 수 없어요.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }),
        () => reject(new Error('위치 권한을 허용한 뒤 다시 시도해 주세요.')),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
      );
    });
  }
}

export async function captureStillPhoto(): Promise<string> {
  const result = await openCamera({ base64: true, maxWidth: 1_600 });
  return result.dataUri.startsWith('data:')
    ? result.dataUri
    : `data:image/jpeg;base64,${result.dataUri}`;
}
