import { createHmac } from "node:crypto";
import { config, type Item } from "./config.js";

const DOMAIN = "https://api-gateway.coupang.com";
const API_PREFIX = "/v2/providers/affiliate_open_api/apis/openapi/v1";

// 쿠팡 파트너스 HMAC 서명: message = datetime + method + path + query
// datetime 포맷: yyMMdd'T'HHmmss'Z' (UTC)
function authorization(method: string, path: string, query: string): string {
  const datetime = new Date().toISOString().slice(2, 19).replace(/[-:]/g, "") + "Z";
  const message = datetime + method + path + query;
  const signature = createHmac("sha256", config.coupang.secretKey())
    .update(message)
    .digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${config.coupang.accessKey()}, signed-date=${datetime}, signature=${signature}`;
}

async function request(method: string, path: string, query = ""): Promise<any> {
  const auth = authorization(method, path, query);
  const url = `${DOMAIN}${path}${query ? `?${query}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: auth, "Content-Type": "application/json;charset=UTF-8" },
  });
  const json = await res.json();
  if (!res.ok || (json.rCode && json.rCode !== "0")) {
    throw new Error(`쿠팡 API 오류 (${path}): ${JSON.stringify(json)}`);
  }
  return json;
}

interface CoupangProduct {
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
  categoryName?: string;
  isRocket?: boolean;
  discount?: number;
}

function toItem(p: CoupangProduct): Item {
  return {
    productName: p.productName,
    price: `${p.productPrice.toLocaleString("ko-KR")}원`,
    discountRate: typeof p.discount === "number" ? `${p.discount}%` : undefined,
    category: p.categoryName,
    imageUrl: p.productImage,
    affiliateUrl: p.productUrl,
  };
}

// 키워드 상품 검색. 응답의 productUrl 이 이미 어필리에이트 딥링크다(subId 반영).
export async function searchProducts(keyword: string, limit = 5): Promise<Item[]> {
  const params = new URLSearchParams({ keyword, limit: String(limit) });
  if (config.coupang.subId) params.set("subId", config.coupang.subId);
  const path = `${API_PREFIX}/products/search`;
  const json = await request("GET", path, params.toString());
  const products: CoupangProduct[] = json?.data?.productData ?? [];
  return products.map(toItem);
}

// 골드박스(오늘의 딜) 상품.
export async function goldbox(limit = 5): Promise<Item[]> {
  const params = new URLSearchParams();
  if (config.coupang.subId) params.set("subId", config.coupang.subId);
  const path = `${API_PREFIX}/products/goldbox`;
  const json = await request("GET", path, params.toString());
  const products: CoupangProduct[] = (json?.data ?? []).slice(0, limit);
  return products.map(toItem);
}
