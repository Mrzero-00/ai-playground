export type AdPlacement = "result-between-sections" | "result-footer";

export interface AdAdapter {
  readonly name: string;
  isSupported: () => boolean;
  mountBanner: (container: HTMLElement, placement: AdPlacement) => Promise<() => void>;
}
