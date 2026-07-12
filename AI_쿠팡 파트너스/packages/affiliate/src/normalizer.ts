import { randomUUID } from "node:crypto";
import { productSchema, productSnapshotSchema, type Product, type ProductSnapshot } from "@affiliate-automation/database";
import { affiliateProductSchema, type AffiliateProduct } from "./types";

export interface NormalizedProduct { product: Product; snapshot: ProductSnapshot; }
export function normalizeAffiliateProduct(input: unknown, providerId: string, capturedAt: string): NormalizedProduct {
  const source = affiliateProductSchema.parse(input);
  const productId = randomUUID();
  const product = productSchema.parse({
    id: productId, providerId, externalProductId: source.externalProductId, name: source.name,
    categoryPath: source.categoryPath, brand: source.brand, canonicalUrl: source.productUrl,
    imageUrl: source.imageUrl, isActive: source.isAvailable, createdAt: capturedAt, updatedAt: capturedAt,
  });
  const snapshot = productSnapshotSchema.parse({
    id: randomUUID(), productId, price: source.price, currency: source.currency, reviewCount: source.reviewCount,
    rating: source.rating, isAvailable: source.isAvailable, rawPayload: source.rawPayload, capturedAt,
  });
  return { product, snapshot };
}

export function deduplicateProducts(products: readonly AffiliateProduct[]): AffiliateProduct[] {
  return [...new Map(products.map((product) => [product.externalProductId, product])).values()];
}
