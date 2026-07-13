import { describe, expect, it } from "vitest";
import { calculateProductScore, passesHardFilter, rankCandidates } from "../src";
const noPenalties = { recentlyPublished: false, lowReviewCount: false, unstablePrice: false, duplicatedCategory: false, weakDataConfidence: false };
describe("product scoring", () => {
  it("calculates a bounded weighted score and penalties", () => {
    const score = calculateProductScore("a", { trend: 100, season: 100, weather: 100, conversionPotential: 100, commissionPotential: 100, contentFit: 100 }, { ...noPenalties, recentlyPublished: true });
    expect(score.finalScore).toBe(80);
  });
  it("ranks deterministically and applies hard filters", () => {
    const a = calculateProductScore("a", { trend: 80, season: 80, weather: 80, conversionPotential: 80, commissionPotential: 80, contentFit: 80 }, noPenalties);
    const b = { ...a, id: "b", finalScore: 90 };
    expect(rankCandidates([a, b], 1)[0]?.id).toBe("b");
    expect(passesHardFilter({ isAvailable: true, categoryAllowed: true, hasCanonicalUrl: true })).toBe(true);
  });
});
