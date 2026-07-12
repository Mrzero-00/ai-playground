import type { Product, ProductSnapshot, PromptVersion, WorkflowRun } from "./domain";

export interface ProductRepository {
  upsert(product: Product): Promise<Product>;
  findByExternalId(providerId: string, externalProductId: string): Promise<Product | null>;
}

export interface ProductSnapshotRepository {
  create(snapshot: ProductSnapshot): Promise<ProductSnapshot>;
  findLatest(productId: string): Promise<ProductSnapshot | null>;
}

export interface WorkflowRunRepository {
  create(run: WorkflowRun): Promise<WorkflowRun>;
  findByIdempotencyKey(idempotencyKey: string): Promise<WorkflowRun | null>;
}

export interface PromptVersionRepository {
  create(prompt: PromptVersion): Promise<PromptVersion>;
  findActive(promptKey: string): Promise<PromptVersion | null>;
}
