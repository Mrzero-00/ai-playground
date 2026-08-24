import type { AdAdapter } from "./types";

export const placeholderAdAdapter: AdAdapter = {
  name: "development-placeholder",
  isSupported: () => false,
  mountBanner: async () => () => undefined,
};
