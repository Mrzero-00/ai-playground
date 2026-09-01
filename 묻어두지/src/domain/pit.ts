export type Coordinates = {
  latitude: number;
  longitude: number;
};

export const DEFAULT_REVEAL_RADIUS_METERS = 150;

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceInMeters(from: Coordinates, to: Coordinates) {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export function isWithinRevealRadius(
  current: Coordinates,
  target: Coordinates,
  radiusMeters = DEFAULT_REVEAL_RADIUS_METERS,
) {
  return distanceInMeters(current, target) <= radiusMeters;
}

export type RevealRadiusDecision = 'inside' | 'outside' | 'uncertain';

export function classifyRevealRadius(
  distanceMeters: number,
  accuracyMeters: number | null,
  radiusMeters = DEFAULT_REVEAL_RADIUS_METERS,
): RevealRadiusDecision {
  if (accuracyMeters === null || accuracyMeters < 0 || accuracyMeters > 80) return 'uncertain';
  if (distanceMeters + accuracyMeters <= radiusMeters) return 'inside';
  if (distanceMeters - accuracyMeters > radiusMeters) return 'outside';
  return 'uncertain';
}
