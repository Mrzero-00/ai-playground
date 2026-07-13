import { z } from "zod";

export const weatherContextSchema = z.object({ region: z.string().min(1), summary: z.string().min(1), temperatureCelsius: z.number() });
export const searchTrendSchema = z.object({ keyword: z.string().min(1), score: z.number().min(0).max(100) });
export const seasonalEventSchema = z.object({ name: z.string().min(1), date: z.iso.date() });
export const marketResearchInputSchema = z.object({
  date: z.iso.date(), locale: z.literal("ko-KR"), weather: z.array(weatherContextSchema),
  searchTrends: z.array(searchTrendSchema), seasonalEvents: z.array(seasonalEventSchema),
  previousPerformanceSummary: z.record(z.string(), z.number()),
});
export const marketResearchOutputSchema = z.object({
  themes: z.array(z.object({ keyword: z.string(), reason: z.string(), targetAudience: z.array(z.string()), urgency: z.enum(["LOW", "MEDIUM", "HIGH"]), confidence: z.number().min(0).max(1) })),
  avoidedThemes: z.array(z.object({ keyword: z.string(), reason: z.string() })),
});
export type MarketResearchInput = z.infer<typeof marketResearchInputSchema>;
export type MarketResearchOutput = z.infer<typeof marketResearchOutputSchema>;

export interface MarketDataProvider<T> { collect(date: string): Promise<T[]>; }
export interface MarketResearchAgent { research(input: MarketResearchInput): Promise<MarketResearchOutput>; }

export class FixtureMarketDataProvider<T> implements MarketDataProvider<T> {
  public constructor(private readonly fixture: readonly T[]) {}
  public collect(date: string): Promise<T[]> { void date; return Promise.resolve([...this.fixture]); }
}

export class DeterministicMarketResearchAgent implements MarketResearchAgent {
  public research(input: MarketResearchInput): Promise<MarketResearchOutput> {
    const parsed = marketResearchInputSchema.parse(input);
    const themes = [...parsed.searchTrends].sort((a, b) => b.score - a.score).slice(0, 5).map((trend) => ({
      keyword: trend.keyword, reason: `검색 관심도 ${String(trend.score)}점`, targetAudience: ["대한민국 온라인 쇼핑 사용자"],
      urgency: trend.score >= 80 ? "HIGH" as const : trend.score >= 50 ? "MEDIUM" as const : "LOW" as const,
      confidence: trend.score / 100,
    }));
    return Promise.resolve(marketResearchOutputSchema.parse({ themes, avoidedThemes: [] }));
  }
}
