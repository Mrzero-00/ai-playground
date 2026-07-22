import { scoringStableHash } from "./hash.js";
import type { FactorContributionDeltaV1, ScorecardResultV1, ScoreChangeExplanationV1, ScoreRankingResultV1 } from "./types.js";

export function rankScorecardsV1(scorecards: ScorecardResultV1[]): ScoreRankingResultV1 {
  if (scorecards.length === 0) throw new Error("Scoring Ranking requires Scorecards");
  const first = scorecards[0]!;
  scorecards.forEach(validateScorecardHash);
  if (scorecards.some((item) => item.userId !== first.userId)) throw new Error("Scoring Ranking ownership mismatch");
  if (scorecards.some((item) => item.scope !== first.scope || item.modelVersionId !== first.modelVersionId || item.philosophyVersionId !== first.philosophyVersionId)) throw new Error("Scoring Ranking requires the same scope and model versions");
  if (new Set(scorecards.map((item) => item.id)).size !== scorecards.length) throw new Error("Scoring Ranking Scorecard ids must be unique");
  if (new Set(scorecards.map((item) => `${item.subjectType}:${item.subjectId}`)).size !== scorecards.length) throw new Error("Scoring Ranking subjects must be unique");
  const eligible = scorecards.filter((item) => item.status === "SCORED" && item.score).sort((left, right) => right.score!.point - left.score!.point || right.confidence.score - left.confidence.score || (left.score!.high - left.score!.low) - (right.score!.high - right.score!.low) || left.subjectId.localeCompare(right.subjectId));
  const withoutHash: Omit<ScoreRankingResultV1, "resultHash"> = {
    scope: first.scope, modelVersionId: first.modelVersionId, philosophyVersionId: first.philosophyVersionId,
    items: eligible.map((item, index) => ({ rank: index + 1, scorecardId: item.id, subjectId: item.subjectId, score: structuredClone(item.score!), confidence: item.confidence.score })),
    excluded: scorecards.filter((item) => item.status !== "SCORED" || !item.score).sort((left, right) => left.id.localeCompare(right.id)).map((item) => ({ scorecardId: item.id, status: item.status, blockerCodes: [...item.blockerCodes] })),
  };
  return { ...withoutHash, resultHash: scoringStableHash(withoutHash) };
}

export function explainScoreChangeV1(input: { id: string; userId: string; previous: ScorecardResultV1; current: ScorecardResultV1; explainedAt: string }): ScoreChangeExplanationV1 {
  if (!input.id.trim() || !input.userId.trim()) throw new Error("Scoring Change identity is required");
  if (!Number.isFinite(new Date(input.explainedAt).getTime())) throw new Error("Scoring Change explainedAt must be valid");
  validateScorecardHash(input.previous);
  validateScorecardHash(input.current);
  if (input.previous.userId !== input.userId || input.current.userId !== input.userId) throw new Error("Scoring Change ownership mismatch");
  const sameSubject = input.previous.subjectType === input.current.subjectType && input.previous.subjectId === input.current.subjectId && input.previous.scope === input.current.scope;
  const sameModel = sameSubject && input.previous.modelVersionId === input.current.modelVersionId && input.previous.philosophyVersionId === input.current.philosophyVersionId;
  const comparisonStatus = !sameSubject ? "NOT_COMPARABLE" : sameModel ? "COMPARABLE" : "MODEL_CHANGED";
  const factorIds = [...new Set([...input.previous.factorResults.map((factor) => factor.factorId), ...input.current.factorResults.map((factor) => factor.factorId)])].sort();
  const factorDeltas: FactorContributionDeltaV1[] = factorIds.map((factorId) => {
    const previous = input.previous.factorResults.find((factor) => factor.factorId === factorId);
    const current = input.current.factorResults.find((factor) => factor.factorId === factorId);
    const comparable = comparisonStatus === "COMPARABLE" && previous?.contribution !== undefined && current?.contribution !== undefined;
    return { factorId,
      ...(previous?.contribution === undefined ? {} : { previousContribution: previous.contribution }),
      ...(current?.contribution === undefined ? {} : { currentContribution: current.contribution }),
      ...(comparable ? { contributionDelta: round2(current.contribution! - previous.contribution!) } : {}),
      reasonCodes: previous?.availability !== current?.availability ? ["AVAILABILITY_CHANGED"] : previous?.score !== current?.score ? ["FACTOR_SCORE_CHANGED"] : [] };
  });
  const reasonCodes = comparisonStatus === "NOT_COMPARABLE" ? ["SUBJECT_OR_SCOPE_MISMATCH"] : comparisonStatus === "MODEL_CHANGED" ? ["MODEL_VERSION_CHANGED"] : input.previous.status !== input.current.status ? ["SCORE_STATUS_CHANGED"] : [];
  const withoutHash: Omit<ScoreChangeExplanationV1, "resultHash"> = {
    id: input.id, userId: input.userId, previousScorecardId: input.previous.id, currentScorecardId: input.current.id,
    comparisonStatus,
    ...(comparisonStatus === "COMPARABLE" && input.previous.score && input.current.score ? { pointDelta: round2(input.current.score.point - input.previous.score.point) } : {}),
    confidenceDelta: round2(input.current.confidence.score - input.previous.confidence.score), factorDeltas, reasonCodes, explainedAt: input.explainedAt,
  };
  return { ...withoutHash, resultHash: scoringStableHash(withoutHash) };
}

function round2(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
function validateScorecardHash(scorecard: ScorecardResultV1): void { const { resultHash, ...withoutHash } = scorecard; if (resultHash !== scoringStableHash(withoutHash)) throw new Error("Scoring Scorecard hash is invalid"); }
