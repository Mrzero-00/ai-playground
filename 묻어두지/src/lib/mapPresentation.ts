import type { LocationFix } from '../shared/contracts';

export type MapPerspective = 'quarter' | 'flat';
export const QUARTER_PITCH = 55;
export const QUARTER_BEARING = -28;

/** Camera presentation only. Never use this as a burial location or GPS fix. */
export function mapOrientation(perspective: MapPerspective) {
  return perspective === 'quarter' ? { pitch: QUARTER_PITCH, bearing: QUARTER_BEARING } : { pitch: 0, bearing: 0 };
}

/** GeoJSON polygon in meters, so the accuracy footprint follows the tilted ground. */
export function accuracyFootprint(fix: LocationFix) {
  const radius = Math.min(Math.max(0, fix.accuracy), 500) / 6371008.8;
  const lat = fix.latitude * Math.PI / 180, lng = fix.longitude * Math.PI / 180;
  const coordinates: number[][] = [];
  for (let index = 0; index < 64; index++) {
    const angle = index * Math.PI / 32;
    const y = Math.asin(Math.sin(lat) * Math.cos(radius) + Math.cos(lat) * Math.sin(radius) * Math.cos(angle));
    const x = lng + Math.atan2(Math.sin(angle) * Math.sin(radius) * Math.cos(lat), Math.cos(radius) - Math.sin(lat) * Math.sin(y));
    coordinates.push([x * 180 / Math.PI, y * 180 / Math.PI]);
  }
  coordinates.push([...coordinates[0]]);
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [coordinates] } };
}
