import type { Product, ProductSnapshot, PromptVersion, WorkflowRun } from "./domain";
import type {
  ProductRepository, ProductSnapshotRepository, PromptVersionRepository, WorkflowRunRepository,
} from "./repositories";

export class InMemoryProductRepository implements ProductRepository {
  readonly #products = new Map<string, Product>();
  public upsert(product: Product): Promise<Product> {
    this.#products.set(`${product.providerId}:${product.externalProductId}`, product);
    return Promise.resolve(product);
  }
  public findByExternalId(providerId: string, externalProductId: string): Promise<Product | null> {
    return Promise.resolve(this.#products.get(`${providerId}:${externalProductId}`) ?? null);
  }
}

export class InMemoryProductSnapshotRepository implements ProductSnapshotRepository {
  readonly #snapshots: ProductSnapshot[] = [];
  public create(snapshot: ProductSnapshot): Promise<ProductSnapshot> {
    this.#snapshots.push(snapshot);
    return Promise.resolve(snapshot);
  }
  public findLatest(productId: string): Promise<ProductSnapshot | null> {
    const latest = this.#snapshots.filter((item) => item.productId === productId)
      .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0] ?? null;
    return Promise.resolve(latest);
  }
}

export class InMemoryWorkflowRunRepository implements WorkflowRunRepository {
  readonly #runs = new Map<string, WorkflowRun>();
  public create(run: WorkflowRun): Promise<WorkflowRun> {
    if (this.#runs.has(run.idempotencyKey)) {
      return Promise.reject(new Error(`Duplicate idempotency key: ${run.idempotencyKey}`));
    }
    this.#runs.set(run.idempotencyKey, run);
    return Promise.resolve(run);
  }
  public findByIdempotencyKey(idempotencyKey: string): Promise<WorkflowRun | null> {
    return Promise.resolve(this.#runs.get(idempotencyKey) ?? null);
  }
}

export class InMemoryPromptVersionRepository implements PromptVersionRepository {
  readonly #prompts: PromptVersion[] = [];
  public create(prompt: PromptVersion): Promise<PromptVersion> {
    if (prompt.isActive) {
      this.#prompts.forEach((item, index) => {
        if (item.promptKey === prompt.promptKey && item.isActive) this.#prompts[index] = { ...item, isActive: false };
      });
    }
    this.#prompts.push(prompt);
    return Promise.resolve(prompt);
  }
  public findActive(promptKey: string): Promise<PromptVersion | null> {
    return Promise.resolve(this.#prompts.find((item) => item.promptKey === promptKey && item.isActive) ?? null);
  }
}
