import { executionStableHashV1, type BrokerOrderRequestV1, type BrokerOrderV1, type BrokerPortV1 } from "@investment-os/core";

export class PaperBrokerV1 implements BrokerPortV1 {
  private readonly orders = new Map<string, BrokerOrderV1>();

  async createOrder(order: BrokerOrderRequestV1): Promise<BrokerOrderV1> {
    const existing = this.orders.get(order.clientOrderId);
    if (existing) return existing;
    const result: BrokerOrderV1 = {
      brokerOrderId: `paper-${executionStableHashV1(order).slice(0, 20)}`,
      clientOrderId: order.clientOrderId,
      status: "PENDING",
      raw: structuredClone(order),
    };
    this.orders.set(order.clientOrderId, result);
    return result;
  }

  async getOrder(_accountId: string, brokerOrderId: string): Promise<BrokerOrderV1> {
    const result = [...this.orders.values()].find((order) => order.brokerOrderId === brokerOrderId);
    if (!result) throw new Error("Paper order not found");
    return result;
  }

  async cancelOrder(accountId: string, brokerOrderId: string): Promise<BrokerOrderV1> {
    const existing = await this.getOrder(accountId, brokerOrderId);
    const cancelled = { ...existing, status: "CANCELLED" };
    this.orders.set(existing.clientOrderId!, cancelled);
    return cancelled;
  }
}
