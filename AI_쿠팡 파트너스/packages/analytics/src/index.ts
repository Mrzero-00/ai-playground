import { z } from "zod";
export const performanceEventSchema = z.object({ id: z.string().min(1), publicationId: z.string().nullable(), affiliateLinkId: z.string().min(1), eventType: z.enum(["CLICK", "CONVERSION"]), eventAt: z.iso.datetime({ offset: true }), sessionId: z.string().nullable(), anonymousUserId: z.string().nullable(), metadata: z.record(z.string(), z.unknown()) });
export const conversionSchema = z.object({ externalConversionId: z.string().min(1), affiliateLinkId: z.string().nullable(), productId: z.string().nullable(), amount: z.number().nonnegative().nullable(), commission: z.number().nonnegative().nullable(), currency: z.string().length(3), convertedAt: z.iso.datetime({ offset: true }), rawPayload: z.record(z.string(), z.unknown()) });
export type PerformanceEvent = z.infer<typeof performanceEventSchema>;
export type Conversion = z.infer<typeof conversionSchema>;

export function buildTrackedUrl(destination: string, campaign: string, contentId: string): string {
  const url = z.url().parse(destination); const parsed = new URL(url); parsed.searchParams.set("utm_source", "affiliate-content"); parsed.searchParams.set("utm_medium", "referral"); parsed.searchParams.set("utm_campaign", campaign); parsed.searchParams.set("utm_content", contentId); return parsed.toString();
}
export function normalizeConversions(input: unknown): Conversion[] {
  const parsed = conversionSchema.array().parse(input); return [...new Map(parsed.map((conversion) => [conversion.externalConversionId, conversion])).values()];
}
export interface PerformanceSummary { clicks: number; conversions: number; conversionRate: number; revenue: number; commission: number; revenuePerClick: number; }
export function summarizePerformance(events: readonly PerformanceEvent[], conversions: readonly Conversion[]): PerformanceSummary {
  const clicks = events.filter((event) => event.eventType === "CLICK").length; const conversionCount = conversions.length;
  const revenue = conversions.reduce((sum, conversion) => sum + (conversion.amount ?? 0), 0); const commission = conversions.reduce((sum, conversion) => sum + (conversion.commission ?? 0), 0);
  return { clicks, conversions: conversionCount, conversionRate: clicks === 0 ? 0 : conversionCount / clicks, revenue, commission, revenuePerClick: clicks === 0 ? 0 : revenue / clicks };
}
