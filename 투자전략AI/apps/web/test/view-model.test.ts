import assert from "node:assert/strict";
import test from "node:test";
import { formatDecimalString } from "../lib/decimal-format";
import { mapApiErrorToUi } from "../lib/error-map";
import { deriveApprovalViewModel, toScoreViewModel } from "../lib/view-model";

test("blocked and unavailable scores never become numeric zero", () => {
  assert.equal(toScoreViewModel({ status: "BLOCKED", blockerCodes: ["STALE"] }).scoreLabel, "산출 차단");
  assert.equal(toScoreViewModel({ status: "UNAVAILABLE", blockerCodes: [] }).scoreLabel, "산출 불가");
  assert.throws(() => toScoreViewModel({ status: "SCORED", blockerCodes: [] }), /requires score/);
});

test("score and confidence remain parallel values", () => {
  const result = toScoreViewModel({ status: "SCORED", score: { point: 82, low: 76, high: 87 }, confidence: { score: 71, grade: "MEDIUM" }, blockerCodes: [] });
  assert.equal(result.scoreLabel, "82");
  assert.equal(result.rangeLabel, "76–87");
  assert.equal(result.confidenceLabel, "71 · MEDIUM");
});

test("approval fails closed for DENY, stale, manual review and expiry", () => {
  const base = { status: "PENDING_APPROVAL" as const, riskStatus: "ALLOW" as const, stale: false, expiresAt: "2026-07-23T00:00:00Z", now: "2026-07-22T00:00:00Z" };
  assert.equal(deriveApprovalViewModel(base).canApprove, true);
  assert.equal(deriveApprovalViewModel({ ...base, riskStatus: "DENY" }).canApprove, false);
  assert.equal(deriveApprovalViewModel({ ...base, stale: true }).canApprove, false);
  assert.equal(deriveApprovalViewModel({ ...base, riskStatus: "REQUIRE_MANUAL_REVIEW" }).canApprove, false);
  assert.equal(deriveApprovalViewModel({ ...base, now: "2026-07-24T00:00:00Z" }).status, "EXPIRED");
});

test("Decimal formatting does not coerce through floating point", () => {
  assert.equal(formatDecimalString("9007199254740993.1200", { currency: "KRW" }), "9,007,199,254,740,993.12 KRW");
  assert.equal(formatDecimalString("-1234.500"), "-1,234.5");
  assert.throws(() => formatDecimalString("1e6"), /invalid Decimal/);
});

test("API error codes map to distinct safe recovery states", () => {
  assert.equal(mapApiErrorToUi("ALLOCATION_PROPOSAL_EXPIRED").recovery.includes("새 Proposal"), true);
  assert.equal(mapApiErrorToUi("RISK_DENY").severity, "CRITICAL");
  assert.equal(mapApiErrorToUi("IDEMPOTENCY_CONFLICT").title.includes("상태가 변경"), true);
});
