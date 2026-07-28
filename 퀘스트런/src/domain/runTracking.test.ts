import {
  EMPTY_RUN_TRACK,
  appendRunPoint,
  calculateAveragePaceSecondsPerKm,
  calculateAverageSpeedKmh,
  calculateEstimatedCalories,
  completeRun,
  createDemoRun,
  formatPace,
  haversineDistanceMeters,
  normalizeRoutePath,
} from './runTracking';

describe('러닝 GPS 기록', () => {
  it('두 GPS 좌표 사이 거리를 계산한다', () => {
    const distance = haversineDistanceMeters(
      { latitude: 37.5665, longitude: 126.978 },
      { latitude: 37.5665, longitude: 126.9893 }
    );

    expect(distance).toBeGreaterThan(990);
    expect(distance).toBeLessThan(1_010);
  });

  it('정확도가 낮은 좌표는 거리에서 제외한다', () => {
    const track = appendRunPoint(EMPTY_RUN_TRACK, {
      latitude: 37.5665,
      longitude: 126.978,
      accuracy: 120,
      timestamp: 1_000,
    });

    expect(track.distanceMeters).toBe(0);
    expect(track.rejectedPointCount).toBe(1);
  });

  it('차량 이동처럼 비정상적으로 빠른 좌표 이동을 제외한다', () => {
    const first = appendRunPoint(EMPTY_RUN_TRACK, {
      latitude: 37.5665,
      longitude: 126.978,
      accuracy: 8,
      timestamp: 1_000,
    });
    const jumped = appendRunPoint(first, {
      latitude: 37.5665,
      longitude: 126.9893,
      accuracy: 8,
      timestamp: 11_000,
    });

    expect(jumped.distanceMeters).toBe(0);
    expect(jumped.rejectedPointCount).toBe(1);
  });

  it('서울에서 이동한 유효 거리를 지역별로 누적한다', () => {
    const first = appendRunPoint(EMPTY_RUN_TRACK, {
      latitude: 37.5665,
      longitude: 126.978,
      accuracy: 8,
      timestamp: 1_000,
    });
    const second = appendRunPoint(first, {
      latitude: 37.5665,
      longitude: 126.9786,
      accuracy: 8,
      timestamp: 11_000,
    });

    expect(second.distanceMeters).toBeGreaterThan(50);
    expect(second.regionDistancesMeters['서울특별시']).toBeGreaterThan(50);
  });

  it('완료된 러닝의 페이스와 지역 거리를 정리한다', () => {
    const track = {
      acceptedPoints: [],
      currentSpeedMetersPerSecond: 3,
      distanceMeters: 2_000,
      maxSpeedMetersPerSecond: 4,
      rejectedPointCount: 0,
      regionDistancesMeters: { 제주특별자치도: 1_500 },
    };
    const run = completeRun(track, 1_000, 721_000, 720);

    expect(run.distanceKm).toBe(2);
    expect(run.averagePaceSecondsPerKm).toBe(360);
    expect(run.averageSpeedKmh).toBe(10);
    expect(run.maxSpeedKmh).toBe(14.4);
    expect(run.estimatedCaloriesKcal).toBe(130);
    expect(run.regionDistancesKm['제주특별자치도']).toBe(1.5);
    expect(formatPace(run.averagePaceSecondsPerKm)).toBe('6:00/km');
  });

  it('100m 미만 러닝은 평균 페이스를 표시하지 않는다', () => {
    expect(calculateAveragePaceSecondsPerKm(50, 80)).toBeNull();
  });

  it('개발용 러닝을 실제 완료 기록과 같은 형태로 만든다', () => {
    const finishedAt = new Date('2026-07-28T10:00:00+09:00').getTime();
    const run = createDemoRun({
      distanceKm: 2,
      paceSecondsPerKm: 360,
      region: '서울특별시',
      finishedAt,
    });

    expect(run.elapsedSeconds).toBe(720);
    expect(run.startedAt).toBe(finishedAt - 720_000);
    expect(run.regionDistancesKm).toEqual({ 서울특별시: 2 });
    expect(run.routePath?.length).toBeGreaterThan(2);
  });

  it('평균 속도와 예상 칼로리를 계산한다', () => {
    expect(calculateAverageSpeedKmh(600, 2_000)).toBe(12);
    expect(calculateEstimatedCalories(3, 70)).toBe(210);
  });

  it('GPS 경로를 좌표가 남지 않는 상대 경로로 변환한다', () => {
    const route = normalizeRoutePath([
      { latitude: 37.5, longitude: 127 },
      { latitude: 37.51, longitude: 127.01 },
      { latitude: 37.52, longitude: 127.005 },
    ]);

    expect(route).toHaveLength(3);
    expect(route.every((point) => point.x >= 0 && point.x <= 1)).toBe(true);
    expect(route.every((point) => point.y >= 0 && point.y <= 1)).toBe(true);
    expect(route[0]).not.toHaveProperty('latitude');
  });
});
