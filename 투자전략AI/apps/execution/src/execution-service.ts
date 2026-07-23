import {
  createAutomatedExecutionIntentV1,
  evaluateExecutionPreflightV1,
  executionStableHashV1,
  type AutomatedExecutionIntentInputV1,
  type BrokerOrderRequestV1,
  type BrokerPortV1,
  type ExecutionPreflightObservationV1,
  type ExecutionRuntimeGateV1,
  type ExecutionSubmissionResultV1,
} from "@investment-os/core";

export class AutomatedExecutionServiceV1 {
  private readonly completed = new Map<string, ExecutionSubmissionResultV1>();
  private readonly pending = new Map<string, Promise<ExecutionSubmissionResultV1>>();

  constructor(private readonly options: { runtime: ExecutionRuntimeGateV1; broker?: BrokerPortV1 }) {}

  async submit(input: AutomatedExecutionIntentInputV1, observation: ExecutionPreflightObservationV1): Promise<ExecutionSubmissionResultV1> {
    const intent = createAutomatedExecutionIntentV1(input);
    const complete = this.completed.get(intent.idempotencyKey);
    if (complete) return replay(complete);
    const active = this.pending.get(intent.idempotencyKey);
    if (active) return replay(await active);
    const task = this.execute(intent, observation);
    this.pending.set(intent.idempotencyKey, task);
    try {
      const result = await task;
      this.completed.set(intent.idempotencyKey, result);
      return result;
    } finally {
      this.pending.delete(intent.idempotencyKey);
    }
  }

  private async execute(
    intent: ReturnType<typeof createAutomatedExecutionIntentV1>,
    observation: ExecutionPreflightObservationV1,
  ): Promise<ExecutionSubmissionResultV1> {
    const preflight = evaluateExecutionPreflightV1(intent, this.options.runtime, observation);
    if (!preflight.allowed) return result({
      intentId: intent.id,
      mode: this.options.runtime.mode,
      status: "BLOCKED",
      externalSubmissionAttempted: false,
      blockerCodes: preflight.blockerCodes,
      warningCodes: preflight.warningCodes,
      idempotentReplay: false,
    });
    if (this.options.runtime.mode === "DRY_RUN") return result({
      intentId: intent.id,
      mode: "DRY_RUN",
      status: "DRY_RUN_VALIDATED",
      externalSubmissionAttempted: false,
      blockerCodes: [],
      warningCodes: preflight.warningCodes,
      idempotentReplay: false,
    });
    if (!this.options.broker) return result({
      intentId: intent.id,
      mode: this.options.runtime.mode,
      status: "BLOCKED",
      externalSubmissionAttempted: false,
      blockerCodes: ["BROKER_ADAPTER_UNAVAILABLE"],
      warningCodes: preflight.warningCodes,
      idempotentReplay: false,
    });
    const externalSubmissionAttempted = this.options.runtime.mode === "LIVE";
    try {
      const order = await this.options.broker.createOrder(toBrokerOrder(intent));
      return result({
        intentId: intent.id,
        mode: this.options.runtime.mode,
        status: "SUBMITTED",
        brokerOrderId: order.brokerOrderId,
        externalSubmissionAttempted,
        blockerCodes: [],
        warningCodes: preflight.warningCodes,
        idempotentReplay: false,
      });
    } catch (error) {
      if (isOutcomeUnknown(error)) return result({
        intentId: intent.id,
        mode: this.options.runtime.mode,
        status: "UNKNOWN",
        externalSubmissionAttempted,
        blockerCodes: ["BROKER_ORDER_OUTCOME_UNKNOWN"],
        warningCodes: preflight.warningCodes,
        idempotentReplay: false,
      });
      return result({
        intentId: intent.id,
        mode: this.options.runtime.mode,
        status: "BLOCKED",
        externalSubmissionAttempted,
        blockerCodes: ["BROKER_ORDER_REJECTED"],
        warningCodes: preflight.warningCodes,
        idempotentReplay: false,
      });
    }
  }
}

function toBrokerOrder(intent: ReturnType<typeof createAutomatedExecutionIntentV1>): BrokerOrderRequestV1 {
  return {
    accountId: intent.accountId,
    clientOrderId: intent.clientOrderId,
    symbol: intent.symbol,
    side: intent.side,
    orderType: intent.orderType,
    timeInForce: intent.timeInForce,
    ...(intent.quantity === undefined ? {} : { quantity: intent.quantity }),
    ...(intent.orderAmount === undefined ? {} : { orderAmount: intent.orderAmount }),
    ...(intent.limitPrice === undefined ? {} : { price: intent.limitPrice }),
    confirmHighValueOrder: false,
  };
}

function result(value: Omit<ExecutionSubmissionResultV1, "resultHash">): ExecutionSubmissionResultV1 {
  return { ...value, resultHash: executionStableHashV1(value) };
}

function replay(value: ExecutionSubmissionResultV1): ExecutionSubmissionResultV1 {
  const canonical = { ...value, idempotentReplay: true };
  return { ...canonical, resultHash: executionStableHashV1({ ...canonical, resultHash: undefined }) };
}

function isOutcomeUnknown(error: unknown): error is Error & { outcomeUnknown: true } {
  return error instanceof Error && "outcomeUnknown" in error && error.outcomeUnknown === true;
}
