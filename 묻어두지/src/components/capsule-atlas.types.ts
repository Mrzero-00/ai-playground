import type { MapPerspective } from '@/lib/map-presentation';
import type { CapsuleSummary, Coordinates, LocationFix } from '@/shared/contracts';

export type CapsuleAtlasProps = {
  capsules: CapsuleSummary[];
  fix: LocationFix | null;
  center: Coordinates;
  /** Bump to re-center the camera on `center` without changing it. */
  recenterKey: number;
  /** Pixels covered by UI at the bottom (sheets, buttons): the camera and credits avoid it. */
  bottomInset: number;
  active: boolean;
  now: number;
  perspective: MapPerspective;
  onSelect: (capsule: CapsuleSummary) => void;
  /** Pin-picking mode: the map reports where the user tapped and draws a pin there. */
  pin?: Coordinates | null;
  onPick?: (coordinates: Coordinates) => void;
};
