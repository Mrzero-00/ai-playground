import type { InvestmentOsRepository } from "./repository.js";

export class OutboxPublisher {
  constructor(private readonly repository: InvestmentOsRepository) {}

  async publishPending(at: string): Promise<number> {
    const pending = await this.repository.listPendingOutbox();
    for (const record of pending) await this.repository.markOutboxPublished(record.id, at);
    return pending.length;
  }
}
