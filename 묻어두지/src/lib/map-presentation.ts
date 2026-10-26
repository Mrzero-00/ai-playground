import type { Coordinates, LocationFix } from '@/shared/contracts';

/** Seoul city hall: where the map opens before any capsule or location exists. */
export const DEFAULT_MAP_CENTER: Coordinates = { latitude: 37.5665, longitude: 126.978 };

/** The tilted, diagonal camera that makes blocks read as a little town. */
export const QUARTER_PITCH = 55;
export const QUARTER_BEARING = -28;

export type MapPerspective = 'quarter' | 'flat';

/** Camera presentation only. Never a burial location or a GPS fix. */
export function mapOrientation(perspective: MapPerspective) {
  return perspective === 'quarter' ? { pitch: QUARTER_PITCH, bearing: QUARTER_BEARING } : { pitch: 0, bearing: 0 };
}

export function mapCenter(capsules: Coordinates[], fix: Coordinates | null): Coordinates {
  if (fix) return { latitude: fix.latitude, longitude: fix.longitude };
  if (capsules.length) return { latitude: capsules[0].latitude, longitude: capsules[0].longitude };
  return DEFAULT_MAP_CENTER;
}

/** GeoJSON polygon in meters, so the accuracy footprint follows the tilted ground. */
export function accuracyFootprint(fix: LocationFix) {
  const radius = Math.min(Math.max(0, fix.accuracy), 500) / 6371008.8;
  const lat = (fix.latitude * Math.PI) / 180;
  const lng = (fix.longitude * Math.PI) / 180;
  const coordinates: number[][] = [];
  for (let index = 0; index < 64; index++) {
    const angle = (index * Math.PI) / 32;
    const y = Math.asin(Math.sin(lat) * Math.cos(radius) + Math.cos(lat) * Math.sin(radius) * Math.cos(angle));
    const x = lng + Math.atan2(Math.sin(angle) * Math.sin(radius) * Math.cos(lat), Math.cos(radius) - Math.sin(lat) * Math.sin(y));
    coordinates.push([(x * 180) / Math.PI, (y * 180) / Math.PI]);
  }
  coordinates.push([...coordinates[0]]);
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [coordinates] } };
}
