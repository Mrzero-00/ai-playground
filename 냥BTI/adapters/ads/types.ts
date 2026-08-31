export type AdPlacement = "home-after-primary-action" | "result-between-sections";

export interface AdAdapter {
  readonly name: string;
  isSupported: () => boolean;
  mountBanner: (container: HTMLElement, placement: AdPlacement) => Promise<() => void>;
}
