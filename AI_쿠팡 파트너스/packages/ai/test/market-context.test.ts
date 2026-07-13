import { describe, expect, it } from "vitest";
import { DeterministicMarketResearchAgent, FixtureMarketDataProvider } from "../src";

describe("market context", () => {
  it("collects fixtures and produces structured ranked themes", async () => {
    const trends = await new FixtureMarketDataProvider([{ keyword: "휴대용 선풍기", score: 90 }]).collect("2026-07-13");
    const output = await new DeterministicMarketResearchAgent().research({ date: "2026-07-13", locale: "ko-KR", weather: [], searchTrends: trends, seasonalEvents: [], previousPerformanceSummary: {} });
    expect(output.themes[0]?.urgency).toBe("HIGH");
  });
});
