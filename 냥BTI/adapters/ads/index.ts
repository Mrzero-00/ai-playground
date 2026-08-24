import { placeholderAdAdapter } from "./placeholder";
import type { AdAdapter } from "./types";

/**
 * 실제 App in Toss 광고 SDK 연결 시 런타임 판별 후 TossAdsAdapter를 반환한다.
 * 현재는 일반 브라우저에서 네트워크 요청을 만들지 않는 placeholder만 사용한다.
 */
export function getAdAdapter(): AdAdapter {
  return placeholderAdAdapter;
}
