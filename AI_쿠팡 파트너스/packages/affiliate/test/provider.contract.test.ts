import { describe, expect, it } from "vitest";
import { MockCoupangAffiliateProvider, deduplicateProducts, normalizeAffiliateProduct } from "../src";
import { coupangProductFixture } from "./fixtures";

describe("affiliate provider contract", () => {
  const provider = new MockCoupangAffiliateProvider(coupangProductFixture);
  it("searches validated products without an external call", async () => {
    const products = await provider.searchProducts({ keyword: "선풍기", limit: 10 });
    expect(products).toHaveLength(1);
  });
  it("creates deterministic affiliate tracking links", async () => {
    const product = await provider.getProduct("CP-100");
    expect(product).not.toBeNull();
    if (product === null) return;
    const first = await provider.createAffiliateLink(product);
    const second = await provider.createAffiliateLink(product);
    expect(first).toEqual(second);
  });
  it("normalizes and deduplicates products", () => {
    const products = deduplicateProducts([...coupangProductFixture, ...coupangProductFixture]);
    expect(products).toHaveLength(1);
    const normalized = normalizeAffiliateProduct(products[0], "22222222-2222-4222-8222-222222222222", "2026-07-13T00:00:00+00:00");
    expect(normalized.snapshot.productId).toBe(normalized.product.id);
  });
});
