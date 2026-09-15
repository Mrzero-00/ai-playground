import * as Location from 'expo-location';
import type { LocationFix } from '../shared/contracts';

export async function currentLocation(): Promise<LocationFix> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('캡슐을 묻고 찾으려면 위치 접근을 허용해 주세요. 설정에서 정확한 위치도 켜 주세요.');
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('휴대폰의 위치 서비스를 켜 주세요.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fix = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('현재 위치를 찾는 데 시간이 걸려요. 하늘이 보이는 곳에서 다시 시도해 주세요.')), 20_000);
    }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
  if (fix.coords.accuracy === null) throw new Error('위치 정확도를 확인하지 못했어요. 정확한 위치를 허용하고 다시 시도해 주세요.');
  return {
    latitude: fix.coords.latitude,
    longitude: fix.coords.longitude,
    accuracy: fix.coords.accuracy,
    timestamp: fix.timestamp,
    mocked: fix.mocked,
  };
}
