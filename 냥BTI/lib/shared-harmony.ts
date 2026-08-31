import { TRAIT_KEYS } from "@/types/nyangbti";
import type { NyangBtiCode, TraitScores } from "@/types/nyangbti";
import { calculateAxes } from "@/lib/scoring";

export interface SharedCatResult {
  v: 1;
  name: string;
  code: NyangBtiCode;
  traits: TraitScores;
}

const CODE_PATTERN = /^[IE][NS][TF][JP]$/;
const SESSION_KEY = "nyangbti-shared-harmony-v1";

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export function encodeSharedCatResult(result: SharedCatResult): string {
  return toBase64Url(JSON.stringify(result));
}

export function decodeSharedCatResult(value: string | null | undefined): SharedCatResult | null {
  if (!value || value.length > 1500) return null;
  try {
    const candidate = JSON.parse(fromBase64Url(value)) as Partial<SharedCatResult>;
    if (candidate.v !== 1 || typeof candidate.name !== "string" || !candidate.name.trim() || candidate.name.length > 30 || /[\u0000-\u001f\u007f]/.test(candidate.name)) return null;
    if (typeof candidate.code !== "string" || !CODE_PATTERN.test(candidate.code)) return null;
    if (!candidate.traits || TRAIT_KEYS.some((key) => typeof candidate.traits?.[key] !== "number" || candidate.traits[key] < 0 || candidate.traits[key] > 100)) return null;
    const traits = candidate.traits as TraitScores;
    const axes = calculateAxes(traits);
    const derivedCode = `${axes.EI.selected}${axes.NS.selected}${axes.TF.selected}${axes.JP.selected}` as NyangBtiCode;
    if (candidate.code !== derivedCode) return null;
    return { v: 1, name: candidate.name.trim(), code: derivedCode, traits };
  } catch {
    return null;
  }
}

export function rememberSharedCatResult(payload: string): void {
  if (typeof sessionStorage !== "undefined" && decodeSharedCatResult(payload)) sessionStorage.setItem(SESSION_KEY, payload);
}

export function readRememberedSharedCatResult(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const payload = sessionStorage.getItem(SESSION_KEY);
  return decodeSharedCatResult(payload) ? payload : null;
}
