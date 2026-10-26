import type { CapsuleSummary, LocationFix } from '../shared/contracts';
import type { MapPerspective } from '../lib/mapPresentation';

export type CapsuleAtlasProps = {
  capsules: CapsuleSummary[];
  fix: LocationFix | null;
  center: { latitude: number; longitude: number };
  recenterKey: number;
  bottomInset: number;
  active: boolean;
  now: number;
  perspective: MapPerspective;
  onSelect: (capsule: CapsuleSummary) => void;
};
