import { describe, expect, it } from "vitest";
import { InMemoryProductRepository, InMemoryWorkflowRunRepository, productSchema, workflowRunSchema } from "../src";

const product = productSchema.parse({
  id: "11111111-1111-4111-8111-111111111111", providerId: "22222222-2222-4222-8222-222222222222",
  externalProductId: "CP-1", name: "테스트 상품", categoryPath: ["생활"], brand: null,
  canonicalUrl: "https://example.com/products/1", imageUrl: null, isActive: true,
  createdAt: "2026-07-13T00:00:00+00:00", updatedAt: "2026-07-13T00:00:00+00:00",
});

describe("repository contracts", () => {
  it("upserts and finds a product by provider identity", async () => {
    const repository = new InMemoryProductRepository();
    await repository.upsert(product);
    await expect(repository.findByExternalId(product.providerId, product.externalProductId)).resolves.toEqual(product);
  });

  it("prevents duplicate workflow idempotency keys", async () => {
    const repository = new InMemoryWorkflowRunRepository();
    const run = workflowRunSchema.parse({
      id: "33333333-3333-4333-8333-333333333333", workflowName: "daily-product-discovery",
      idempotencyKey: "daily-product-discovery:2026-07-13:KR:COUPANG", status: "PENDING",
      input: {}, output: null, error: null, startedAt: "2026-07-13T00:00:00+00:00", completedAt: null,
    });
    await repository.create(run);
    await expect(repository.create(run)).rejects.toThrow("Duplicate idempotency key");
  });
});
