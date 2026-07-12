import { createHash } from "node:crypto";
import { affiliateProductSchema, searchProductsInputSchema, type AffiliateProduct, type AffiliateLink, type AffiliateProvider, type SearchAffiliateProductsInput } from "./types";

export class MockCoupangAffiliateProvider implements AffiliateProvider {
  public readonly provider = "COUPANG" as const;
  readonly #products: AffiliateProduct[];

  public constructor(fixture: unknown) {
    this.#products = affiliateProductSchema.array().parse(fixture);
  }
  public searchProducts(input: SearchAffiliateProductsInput): Promise<AffiliateProduct[]> {
    const parsed = searchProductsInputSchema.parse(input);
    const keyword = parsed.keyword.toLocaleLowerCase("ko-KR");
    return Promise.resolve(this.#products.filter((product) => product.name.toLocaleLowerCase("ko-KR").includes(keyword)).slice(0, parsed.limit));
  }
  public getProduct(externalProductId: string): Promise<AffiliateProduct | null> {
    return Promise.resolve(this.#products.find((product) => product.externalProductId === externalProductId) ?? null);
  }
  public createAffiliateLink(product: AffiliateProduct): Promise<AffiliateLink> {
    const trackingCode = createHash("sha256").update(`${this.provider}:${product.externalProductId}`).digest("hex").slice(0, 16);
    const affiliateUrl = new URL(product.productUrl);
    affiliateUrl.searchParams.set("subId", trackingCode);
    return Promise.resolve({ destinationUrl: product.productUrl, affiliateUrl: affiliateUrl.toString(), trackingCode });
  }
}
