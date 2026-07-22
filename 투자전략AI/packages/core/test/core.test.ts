import assert from "node:assert/strict";
import test from "node:test";
import { allocateCapital, evaluateLongTerm, evaluateMomentum } from "../src/index.js";

test("long-term and momentum use independent inputs and outputs", () => {
  const longTerm = evaluateLongTerm({
    businessQuality: 90, valuation: 70, moat: 90, freeCashFlow: 85,
    opportunityCost: 70, portfolioFit: 80,
  });
  const momentum = evaluateMomentum({
    relativeStrength: 90, volume: 80, sectorRotation: 70, catalyst: 90, riskReward: 80,
  });

  assert.equal(longTerm.strategy, "long-term");
  assert.equal(longTerm.total, 83);
  assert.equal(longTerm.classification, "core");
  assert.equal(momentum.strategy, "momentum");
  assert.equal(momentum.total, 83);
  assert.equal(momentum.signal, "enter");
});

test("default portfolio follows the 85/15 policy", () => {
  assert.deepEqual(allocateCapital(1_000_000), {
    capital: 1_000_000,
    longTerm: 850_000,
    momentum: 150_000,
    maxSinglePosition: 100_000,
  });
});

test("scores outside 0..100 are rejected", () => {
  assert.throws(() => evaluateMomentum({
    relativeStrength: 101, volume: 80, sectorRotation: 70, catalyst: 90, riskReward: 80,
  }), RangeError);
});

