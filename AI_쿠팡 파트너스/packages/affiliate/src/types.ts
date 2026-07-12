import { z } from "zod";

export const affiliateProductSchema = z.object({
  externalProductId: z.string().min(1), name: z.string().min(1), price: z.number().nonnegative().nullable(),
  currency: z.string().length(3).default("KRW"), imageUrl: z.url().nullable(), productUrl: z.url(),
  categoryPath: z.array(z.string().min(1)), brand: z.string().min(1).nullable(),
  reviewCount: z.number().int().nonnegative().nullable(), rating: z.number().min(0).max(5).nullable(),
  isAvailable: z.boolean(), rawPayload: z.record(z.string(), z.unknown()),
});
export const searchProductsInputSchema = z.object({ keyword: z.string().trim().min(1), limit: z.number().int().min(1).max(100) });
export type AffiliateProduct = z.infer<typeof affiliateProductSchema>;
export type SearchAffiliateProductsInput = z.infer<typeof searchProductsInputSchema>;
export interface AffiliateLink { destinationUrl: string; affiliateUrl: string; trackingCode: string; }

export interface AffiliateProvider {
  readonly provider: "COUPANG";
  searchProducts(input: SearchAffiliateProductsInput): Promise<AffiliateProduct[]>;
  getProduct(externalProductId: string): Promise<AffiliateProduct | null>;
  createAffiliateLink(product: AffiliateProduct): Promise<AffiliateLink>;
}
