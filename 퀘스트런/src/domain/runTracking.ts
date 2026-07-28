export interface RunPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface RunTrack {
  acceptedPoints: RunPoint[];
  currentSpeedMetersPerSecond: number;
  distanceMeters: number;
  maxSpeedMetersPerSecond: number;
  rejectedPointCount: number;
  regionDistancesMeters: Record<string, number>;
}

export interface NormalizedRoutePoint {
  x: number;
  y: number;
}

export interface CompletedRun {
  id: string;
  startedAt: number;
  finishedAt: number;
  elapsedSeconds: number;
  distanceKm: number;
  averagePaceSecondsPerKm: number | null;
  averageSpeedKmh?: number;
  maxSpeedKmh?: number;
  estimatedCaloriesKcal?: number;
  routePath?: NormalizedRoutePoint[];
  regionDistancesKm: Record<string, number>;
}

export interface DemoRunOptions {
  distanceKm: number;
  paceSecondsPerKm?: number;
  region?: '서울특별시' | '제주특별자치도';
  finishedAt?: number;
}

const EARTH_RADIUS_METERS = 6_371_000;
const MAX_ACCEPTED_ACCURACY_METERS = 50;
const MAX_RUNNING_SPEED_METERS_PER_SECOND = 12;
const MIN_SEGMENT_METERS = 2;
const DEFAULT_RUNNER_WEIGHT_KG = 65;
const MAX_STORED_ROUTE_POINTS = 80;

export const EMPTY_RUN_TRACK: RunTrack = {
  acceptedPoints: [],
  currentSpeedMetersPerSecond: 0,
  distanceMeters: 0,
  maxSpeedMetersPerSecond: 0,
  rejectedPointCount: 0,
  regionDistancesMeters: {},
};

export function haversineDistanceMeters(
  from: Pick<RunPoint, 'latitude' | 'longitude'>,
  to: Pick<RunPoint, 'latitude' | 'longitude'>
): number {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

export function appendRunPoint(track: RunTrack, point: RunPoint): RunTrack {
  if (!isCoordinateValid(point) || point.accuracy > MAX_ACCEPTED_ACCURACY_METERS) {
    return rejectPoint(track);
  }

  const previousPoint = track.acceptedPoints.at(-1);

  if (previousPoint == null) {
    return {
      ...track,
      acceptedPoints: [point],
    };
  }

  const elapsedSeconds = (point.timestamp - previousPoint.timestamp) / 1000;
  if (elapsedSeconds <= 0) {
    return rejectPoint(track);
  }

  const segmentMeters = haversineDistanceMeters(previousPoint, point);
  const speedMetersPerSecond = segmentMeters / elapsedSeconds;

  if (segmentMeters < MIN_SEGMENT_METERS || speedMetersPerSecond > MAX_RUNNING_SPEED_METERS_PER_SECOND) {
    return rejectPoint(track);
  }

  const region = inferSupportedRegion(previousPoint, point);
  const nextRegionDistances = { ...track.regionDistancesMeters };

  if (region != null) {
    nextRegionDistances[region] = (nextRegionDistances[region] ?? 0) + segmentMeters;
  }

  return {
    acceptedPoints: [...track.acceptedPoints, point],
    currentSpeedMetersPerSecond: speedMetersPerSecond,
    distanceMeters: track.distanceMeters + segmentMeters,
    maxSpeedMetersPerSecond: Math.max(track.maxSpeedMetersPerSecond, speedMetersPerSecond),
    rejectedPointCount: track.rejectedPointCount,
    regionDistancesMeters: nextRegionDistances,
  };
}

export function calculateAveragePaceSecondsPerKm(elapsedSeconds: number, distanceMeters: number): number | null {
  if (elapsedSeconds <= 0 || distanceMeters < 100) {
    return null;
  }

  return Math.round(elapsedSeconds / (distanceMeters / 1000));
}

export function calculateAverageSpeedKmh(elapsedSeconds: number, distanceMeters: number): number {
  if (elapsedSeconds <= 0 || distanceMeters <= 0) {
    return 0;
  }

  return roundTo((distanceMeters / elapsedSeconds) * 3.6, 1);
}

export function calculateEstimatedCalories(distanceKm: number, weightKg = DEFAULT_RUNNER_WEIGHT_KG): number {
  return Math.max(0, Math.round(distanceKm * Math.max(30, weightKg)));
}

export function normalizeRoutePath(
  points: Array<Pick<RunPoint, 'latitude' | 'longitude'>>,
  maxPoints = MAX_STORED_ROUTE_POINTS
): NormalizedRoutePoint[] {
  if (points.length === 0) {
    return [];
  }

  const sampledPoints = sampleRoutePoints(points, maxPoints);
  if (sampledPoints.length === 1) {
    return [{ x: 0.5, y: 0.5 }];
  }

  const latitudes = sampledPoints.map((point) => point.latitude);
  const longitudes = sampledPoints.map((point) => point.longitude);
  const minimumLatitude = Math.min(...latitudes);
  const maximumLatitude = Math.max(...latitudes);
  const minimumLongitude = Math.min(...longitudes);
  const maximumLongitude = Math.max(...longitudes);
  const centerLatitude = (minimumLatitude + maximumLatitude) / 2;
  const centerLongitude = (minimumLongitude + maximumLongitude) / 2;
  const longitudeScale = Math.cos(toRadians(centerLatitude));
  const latitudeSpan = maximumLatitude - minimumLatitude;
  const longitudeSpan = (maximumLongitude - minimumLongitude) * longitudeScale;
  const largestSpan = Math.max(latitudeSpan, longitudeSpan, 0.000001);
  const visibleScale = 0.82;

  return sampledPoints.map((point) => ({
    x: roundTo(0.5 + (((point.longitude - centerLongitude) * longitudeScale) / largestSpan) * visibleScale, 4),
    y: roundTo(0.5 - ((point.latitude - centerLatitude) / largestSpan) * visibleScale, 4),
  }));
}

export function completeRun(
  track: RunTrack,
  startedAt: number,
  finishedAt: number,
  elapsedSeconds: number
): CompletedRun {
  const distanceKm = roundTo(track.distanceMeters / 1000, 2);
  const regionDistancesKm = Object.fromEntries(
    Object.entries(track.regionDistancesMeters).map(([region, meters]) => [region, roundTo(meters / 1000, 2)])
  );

  return {
    id: `run-${startedAt}`,
    startedAt,
    finishedAt,
    elapsedSeconds,
    distanceKm,
    averagePaceSecondsPerKm: calculateAveragePaceSecondsPerKm(elapsedSeconds, track.distanceMeters),
    averageSpeedKmh: calculateAverageSpeedKmh(elapsedSeconds, track.distanceMeters),
    maxSpeedKmh: roundTo(track.maxSpeedMetersPerSecond * 3.6, 1),
    estimatedCaloriesKcal: calculateEstimatedCalories(distanceKm),
    routePath: normalizeRoutePath(track.acceptedPoints),
    regionDistancesKm,
  };
}

export function createDemoRun({
  distanceKm,
  paceSecondsPerKm = 390,
  region,
  finishedAt = Date.now(),
}: DemoRunOptions): CompletedRun {
  const safeDistanceKm = Math.max(0.1, roundTo(distanceKm, 2));
  const safePace = Math.max(180, Math.round(paceSecondsPerKm));
  const elapsedSeconds = Math.round(safeDistanceKm * safePace);
  const startedAt = finishedAt - elapsedSeconds * 1000;
  const averageSpeedKmh = roundTo(3_600 / safePace, 1);

  return {
    id: `demo-run-${finishedAt}-${safeDistanceKm}`,
    startedAt,
    finishedAt,
    elapsedSeconds,
    distanceKm: safeDistanceKm,
    averagePaceSecondsPerKm: safePace,
    averageSpeedKmh,
    maxSpeedKmh: roundTo(averageSpeedKmh * 1.18, 1),
    estimatedCaloriesKcal: calculateEstimatedCalories(safeDistanceKm),
    routePath: createDemoRoutePath(region),
    regionDistancesKm: region == null ? {} : { [region]: safeDistanceKm },
  };
}

export function formatPace(paceSecondsPerKm: number | null): string {
  if (paceSecondsPerKm == null) {
    return '--:--';
  }

  const minutes = Math.floor(paceSecondsPerKm / 60);
  const seconds = paceSecondsPerKm % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}

function inferSupportedRegion(
  from: Pick<RunPoint, 'latitude' | 'longitude'>,
  to: Pick<RunPoint, 'latitude' | 'longitude'>
): string | undefined {
  const midpoint = {
    latitude: (from.latitude + to.latitude) / 2,
    longitude: (from.longitude + to.longitude) / 2,
  };

  if (
    midpoint.latitude >= 33.06 &&
    midpoint.latitude <= 33.62 &&
    midpoint.longitude >= 126.08 &&
    midpoint.longitude <= 126.98
  ) {
    return '제주특별자치도';
  }

  if (
    midpoint.latitude >= 37.413 &&
    midpoint.latitude <= 37.715 &&
    midpoint.longitude >= 126.734 &&
    midpoint.longitude <= 127.269
  ) {
    return '서울특별시';
  }

  return undefined;
}

function isCoordinateValid(point: RunPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Number.isFinite(point.accuracy) &&
    Number.isFinite(point.timestamp) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180 &&
    point.accuracy >= 0
  );
}

function rejectPoint(track: RunTrack): RunTrack {
  return {
    ...track,
    rejectedPointCount: track.rejectedPointCount + 1,
  };
}

function sampleRoutePoints(
  points: Array<Pick<RunPoint, 'latitude' | 'longitude'>>,
  maxPoints: number
): Array<Pick<RunPoint, 'latitude' | 'longitude'>> {
  const safeMaximum = Math.max(2, Math.floor(maxPoints));
  if (points.length <= safeMaximum) {
    return points;
  }

  const step = (points.length - 1) / (safeMaximum - 1);
  return Array.from({ length: safeMaximum }, (_, index) => {
    return points[Math.min(points.length - 1, Math.round(index * step))]!;
  });
}

function createDemoRoutePath(region?: DemoRunOptions['region']): NormalizedRoutePoint[] {
  const seoulRoute = [
    { x: 0.12, y: 0.72 },
    { x: 0.2, y: 0.6 },
    { x: 0.3, y: 0.64 },
    { x: 0.4, y: 0.45 },
    { x: 0.52, y: 0.5 },
    { x: 0.62, y: 0.3 },
    { x: 0.75, y: 0.36 },
    { x: 0.88, y: 0.18 },
  ];
  const jejuRoute = [
    { x: 0.15, y: 0.7 },
    { x: 0.23, y: 0.46 },
    { x: 0.38, y: 0.38 },
    { x: 0.49, y: 0.58 },
    { x: 0.62, y: 0.68 },
    { x: 0.74, y: 0.48 },
    { x: 0.84, y: 0.28 },
  ];

  return region === '제주특별자치도' ? jejuRoute : seoulRoute;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function roundTo(value: number, digits: number): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
