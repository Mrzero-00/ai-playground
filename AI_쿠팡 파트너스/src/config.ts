import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name} 가 설정되지 않았습니다. .env 를 확인하세요.`);
  return v;
}

export const config = {
  anthropicApiKey: () => required("ANTHROPIC_API_KEY"),
  instagram: {
    userId: () => required("IG_USER_ID"),
    accessToken: () => required("IG_ACCESS_TOKEN"),
    apiVersion: process.env.GRAPH_API_VERSION || "v21.0",
  },
  coupang: {
    accessKey: () => required("COUPANG_ACCESS_KEY"),
    secretKey: () => required("COUPANG_SECRET_KEY"),
    subId: process.env.COUPANG_SUB_ID || undefined,
    configured: () => !!process.env.COUPANG_ACCESS_KEY && !!process.env.COUPANG_SECRET_KEY,
  },
  searchKeyword: process.env.SEARCH_KEYWORD || undefined,
  searchLimit: Number(process.env.SEARCH_LIMIT || "5"),
  dryRun: process.env.DRY_RUN === "1",
  model: "claude-opus-4-7" as const,
};

export interface Item {
  productName: string;
  price: string;
  discountRate?: string;
  rating?: string;
  reviewCount?: string;
  brand?: string;
  category?: string;
  features?: string[];
  imageUrl: string;
  affiliateUrl: string;
}

export interface GeneratedContent {
  article: string;
  caption: string;
  hashtags: string[];
}
