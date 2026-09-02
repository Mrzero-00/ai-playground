import { Accuracy, getAnonymousKey, getCurrentLocation, IAP, openCamera } from '@apps-in-toss/web-framework';
import type { AppLocation } from '../types';

const LOCAL_KEY = 'ppira-local-user-key';
export const isLocalPreview = import.meta.env.DEV;

export async function resolveAnonymousUserKey(): Promise<string> {
  try {
    const result = await getAnonymousKey();
    if (typeof result === 'object' && result?.type === 'HASH') return result.hash;
  } catch {
    // 일반 브라우저 개발 환경은 로컬 익명키를 사용합니다.
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
    return { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy ?? 999 };
  } catch {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('이 기기에서 위치 정보를 사용할 수 없어요.'));
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
        () => reject(new Error('위치 권한을 허용한 뒤 다시 시도해 주세요.')),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
      );
    });
  }
}

export async function captureStillPhoto(): Promise<string> {
  const result = await openCamera({ base64: true, maxWidth: 1_600 });
  return result.dataUri.startsWith('data:') ? result.dataUri : `data:image/jpeg;base64,${result.dataUri}`;
}

export async function purchaseSingleFlyer(
  sku: string,
  grant: (orderId: string) => Promise<boolean>,
): Promise<{ orderId: string; displayAmount: string }> {
  return new Promise((resolve, reject) => {
    let cleanup: () => void = () => {};
    try {
      cleanup = IAP.createOneTimePurchaseOrder({
        options: { sku, processProductGrant: ({ orderId }) => grant(orderId) },
        onEvent: (event) => {
          cleanup();
          if (event.type === 'success') resolve({ orderId: event.data.orderId, displayAmount: event.data.displayAmount });
        },
        onError: (error) => {
          cleanup();
          reject(error instanceof Error ? error : new Error('결제를 완료하지 못했어요.'));
        },
      });
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error('인앱결제를 사용할 수 없어요.'));
    }
  });
}

export async function restorePendingPurchases(
  sku: string,
  grant: (orderId: string) => Promise<boolean>,
): Promise<number> {
  const result = await IAP.getPendingOrders();
  let restored = 0;
  for (const order of result?.orders ?? []) {
    if (order.sku !== sku || !(await grant(order.orderId))) continue;
    await IAP.completeProductGrant({ params: { orderId: order.orderId } });
    restored += 1;
  }
  return restored;
}
