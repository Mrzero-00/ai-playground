import { z } from "zod";
export const workflowPayloadSchema = z.object({ date: z.iso.date(), market: z.literal("KR"), provider: z.literal("COUPANG") });
export type WorkflowPayload = z.infer<typeof workflowPayloadSchema>;
export type WorkflowStatus = "RUNNING" | "COMPLETED" | "FAILED";
export interface WorkflowAuditEvent { workflowRunId: string; agentRunId: string; provider: string; operation: string; startedAt: string; durationMs: number; success: boolean; errorCode: string | null; }
export interface WorkflowStep { name: string; run(payload: WorkflowPayload): Promise<void>; }
export interface WorkflowRunResult { idempotencyKey: string; status: WorkflowStatus; completedSteps: string[]; auditEvents: WorkflowAuditEvent[]; }

export function createIdempotencyKey(workflowName: string, payloadInput: unknown): string { const payload = workflowPayloadSchema.parse(payloadInput); return `${workflowName}:${payload.date}:${payload.market}:${payload.provider}`; }

export class LocalWorkflowRunner {
  readonly #runs = new Map<string, WorkflowRunResult>();
  public constructor(private readonly maxAttempts = 3, private readonly now: () => number = Date.now) {}
  public async execute(workflowName: string, payloadInput: unknown, steps: readonly WorkflowStep[], force = false): Promise<WorkflowRunResult> {
    const payload = workflowPayloadSchema.parse(payloadInput); const key = createIdempotencyKey(workflowName, payload); const previous = this.#runs.get(key);
    if (previous?.status === "COMPLETED" && !force) return previous;
    const result: WorkflowRunResult = previous ?? { idempotencyKey: key, status: "RUNNING", completedSteps: [], auditEvents: [] }; result.status = "RUNNING";
    for (const step of steps) {
      if (result.completedSteps.includes(step.name)) continue;
      let completed = false;
      for (let attempt = 1; attempt <= this.maxAttempts && !completed; attempt += 1) {
        const started = this.now();
        try { await step.run(payload); completed = true; result.completedSteps.push(step.name); result.auditEvents.push({ workflowRunId: key, agentRunId: `${key}:${step.name}:${String(attempt)}`, provider: payload.provider, operation: step.name, startedAt: new Date(started).toISOString(), durationMs: this.now() - started, success: true, errorCode: null }); }
        catch { result.auditEvents.push({ workflowRunId: key, agentRunId: `${key}:${step.name}:${String(attempt)}`, provider: payload.provider, operation: step.name, startedAt: new Date(started).toISOString(), durationMs: this.now() - started, success: false, errorCode: "STEP_FAILED" }); }
      }
      if (!completed) { result.status = "FAILED"; this.#runs.set(key, result); return result; }
    }
    result.status = "COMPLETED"; this.#runs.set(key, result); return result;
  }
}

export const DAILY_SCHEDULES_KST = {
  "daily-market-context": "0 6 * * *", "daily-product-discovery": "10 6 * * *", "score-product-candidates": "30 6 * * *",
  "generate-content-drafts": "0 7 * * *", "validate-generated-content": "30 7 * * *", "collect-performance": "0 23 * * *",
} as const;
