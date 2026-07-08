import { config, type Item } from "./config.js";
import { items as sampleItems } from "./items.js";
import { searchProducts, goldbox } from "./coupang.js";

// 아이템 출처 결정:
// - 쿠팡 키가 있고 SEARCH_KEYWORD 가 있으면 키워드 검색
// - 쿠팡 키만 있으면 골드박스(오늘의 딜)
// - 그 외에는 샘플 아이템
export async function loadItems(): Promise<Item[]> {
  if (!config.coupang.configured()) {
    console.log("쿠팡 키가 없어 샘플 아이템을 사용합니다.");
    return sampleItems;
  }
  if (config.searchKeyword) {
    console.log(`쿠팡 검색: "${config.searchKeyword}" (limit ${config.searchLimit})`);
    return searchProducts(config.searchKeyword, config.searchLimit);
  }
  console.log(`쿠팡 골드박스(오늘의 딜) 상위 ${config.searchLimit}개`);
  return goldbox(config.searchLimit);
}
