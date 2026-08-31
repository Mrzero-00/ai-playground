import { placeholderAdAdapter } from "./placeholder";
import { tossAdAdapter } from "./toss";
import type { AdAdapter } from "./types";

export function getAdAdapter(): AdAdapter {
  return tossAdAdapter.isSupported() ? tossAdAdapter : placeholderAdAdapter;
}
