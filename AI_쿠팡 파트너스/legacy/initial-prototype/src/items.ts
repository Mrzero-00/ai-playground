import type { Item } from "./config.js";

// 지금은 하드코딩된 샘플. 이후 Product Scout 단계에서 쿠팡 파트너스 API 결과로 대체한다.
export const items: Item[] = [
  {
    productName: "무선 블루투스 이어폰 노이즈캔슬링",
    price: "39,900원",
    discountRate: "32%",
    rating: "4.7",
    reviewCount: "12,483",
    brand: "샘플브랜드",
    category: "이어폰/헤드폰",
    features: ["액티브 노이즈캔슬링", "최대 30시간 재생", "IPX5 생활방수"],
    imageUrl: "https://example.com/public/earbuds.jpg",
    affiliateUrl: "https://link.coupang.com/a/EXAMPLE",
  },
];
