type JosaPair = "이/가" | "은/는" | "과/와";

const JOSA: Record<JosaPair, readonly [string, string]> = {
  "이/가": ["이", "가"],
  "은/는": ["은", "는"],
  "과/와": ["과", "와"],
};

export function withJosa(word: string, pair: JosaPair): string {
  const trimmed = word.trim();
  const last = trimmed.charCodeAt(trimmed.length - 1);
  const hasBatchim = last >= 0xac00 && last <= 0xd7a3
    ? (last - 0xac00) % 28 !== 0
    : false;
  return `${word}${JOSA[pair][hasBatchim ? 0 : 1]}`;
}
