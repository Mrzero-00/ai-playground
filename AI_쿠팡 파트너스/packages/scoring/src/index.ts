import { z } from "zod";

export const scoreComponentsSchema = z.object({ trend: z.number().min(0).max(100), season: z.number().min(0).max(100), weather: z.number().min(0).max(100), conversionPotential: z.number().min(0).max(100), commissionPotential: z.number().min(0).max(100), contentFit: z.number().min(0).max(100) });
export const scoreWeightsSchema = scoreComponentsSchema.refine((weights) => Math.abs(Object.values(weights).reduce((sum, value) => sum + value, 0) - 1) < 0.000001, "weights must sum to 1");
export const SCORE_WEIGHTS = { trend: .25, season: .15, weather: .15, conversionPotential: .2, commissionPotential: .1, contentFit: .15 } as const;
export const penaltyInputSchema = z.object({ recentlyPublished: z.boolean(), lowReviewCount: z.boolean(), unstablePrice: z.boolean(), duplicatedCategory: z.boolean(), weakDataConfidence: z.boolean() });
const PENALTIES = { recentlyPublished: 20, lowReviewCount: 10, unstablePrice: 15, duplicatedCategory: 8, weakDataConfidence: 20 } as const;
export interface ScoredCandidate { id: string; finalScore: number; penaltyScore: number; scoreVersion: string; reasons: string[]; }

export function calculateProductScore(id: string, componentsInput: unknown, penaltiesInput: unknown, scoreVersion = "v1"): ScoredCandidate {
  const components = scoreComponentsSchema.parse(componentsInput);
  const penalties = penaltyInputSchema.parse(penaltiesInput);
  const weighted = Object.entries(SCORE_WEIGHTS).reduce((sum, [key, weight]) => sum + components[key as keyof typeof components] * weight, 0);
  const penaltyScore = Object.entries(penalties).reduce((sum, [key, enabled]) => sum + (enabled ? PENALTIES[key as keyof typeof PENALTIES] : 0), 0);
  return { id, finalScore: Math.max(0, Math.min(100, Number((weighted - penaltyScore).toFixed(2)))), penaltyScore, scoreVersion, reasons: Object.entries(penalties).filter(([, enabled]) => enabled).map(([key]) => key) };
}

export function rankCandidates(candidates: readonly ScoredCandidate[], limit: number): ScoredCandidate[] {
  const safeLimit = z.number().int().positive().parse(limit);
  return [...candidates].sort((a, b) => b.finalScore - a.finalScore || a.id.localeCompare(b.id)).slice(0, safeLimit);
}

export function passesHardFilter(input: { isAvailable: boolean; categoryAllowed: boolean; hasCanonicalUrl: boolean }): boolean {
  return input.isAvailable && input.categoryAllowed && input.hasCanonicalUrl;
}
