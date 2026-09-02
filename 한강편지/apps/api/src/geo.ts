import type { Coordinates } from './types.js';

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (value: number) => (value * Math.PI) / 180;

export function distanceMeters(
  from: Pick<Coordinates, 'latitude' | 'longitude'>,
  to: Pick<Coordinates, 'latitude' | 'longitude'>,
): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
