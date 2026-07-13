import { describe, expect, it, vi } from "vitest";
import { LocalWorkflowRunner, createIdempotencyKey } from "../src";
const payload = { date: "2026-07-13", market: "KR" as const, provider: "COUPANG" as const };
describe("workflow runner", () => {
  it("prevents duplicate completed workflow execution", async () => { const run = vi.fn(() => Promise.resolve()); const runner = new LocalWorkflowRunner(); await runner.execute("daily-product-discovery", payload, [{ name: "collect", run }]); await runner.execute("daily-product-discovery", payload, [{ name: "collect", run }]); expect(run).toHaveBeenCalledTimes(1); expect(createIdempotencyKey("daily-product-discovery", payload)).toBe("daily-product-discovery:2026-07-13:KR:COUPANG"); });
  it("retries failed steps and records audit events", async () => { let attempts = 0; const runner = new LocalWorkflowRunner(3, () => 0); const result = await runner.execute("score-product-candidates", payload, [{ name: "score", run: () => { attempts += 1; return attempts < 2 ? Promise.reject(new Error("fixture")) : Promise.resolve(); } }]); expect(result.status).toBe("COMPLETED"); expect(result.auditEvents).toHaveLength(2); });
});
