import type { CapsuleSummary, LocationFix } from '../shared/contracts';

export const DEFAULT_MAP_CENTER = { latitude: 37.5665, longitude: 126.978 };

/** Map framing is never a burial location or permission to open a capsule. */
export function mapCenter(capsules: CapsuleSummary[], fix: LocationFix | null) {
  if (fix) return { latitude: fix.latitude, longitude: fix.longitude };
  if (capsules.length) return { latitude: capsules[0].latitude, longitude: capsules[0].longitude };
  return DEFAULT_MAP_CENTER;
}

export function drawerHeights(height: number) {
  const safeHeight = Math.max(240, height);
  return { collapsed: Math.min(194, safeHeight * .34), expanded: Math.max(194, safeHeight - 115) };
}

export function snapDrawer(height: number, velocity: number, stops: ReturnType<typeof drawerHeights>) {
  if (velocity < -.3) return true;
  if (velocity > .3) return false;
  return height > (stops.collapsed + stops.expanded) / 2;
}
