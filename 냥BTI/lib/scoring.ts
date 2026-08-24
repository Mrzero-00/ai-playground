import { QUESTIONS } from "@/data/questions";
import { TRAIT_KEYS } from "@/types/nyangbti";
import type {
  AxisKey,
  AxisResult,
  NyangBtiCode,
  NyangBtiResult,
  SurveyAnswers,
  TraitKey,
  TraitScores,
} from "@/types/nyangbti";

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

const round = (value: number) => Math.round(value * 10) / 10;

export function calculateTraitScores(answers: SurveyAnswers): TraitScores {
  const raw = Object.fromEntries(TRAIT_KEYS.map((trait) => [trait, 0])) as TraitScores;
  const min = Object.fromEntries(TRAIT_KEYS.map((trait) => [trait, 0])) as TraitScores;
  const max = Object.fromEntries(TRAIT_KEYS.map((trait) => [trait, 0])) as TraitScores;

  for (const question of QUESTIONS) {
    const answer = clamp(answers[question.id] ?? 2, 0, 4);
    const centeredAnswer = answer - 2;

    for (const [trait, weight] of Object.entries(question.weights) as [TraitKey, number][]) {
      raw[trait] += centeredAnswer * weight;
      min[trait] -= 2 * Math.abs(weight);
      max[trait] += 2 * Math.abs(weight);
    }
  }

  return Object.fromEntries(
    TRAIT_KEYS.map((trait) => {
      const range = max[trait] - min[trait];
      const normalized = range === 0 ? 50 : ((raw[trait] - min[trait]) / range) * 100;
      return [trait, round(clamp(normalized))];
    }),
  ) as TraitScores;
}

function createAxis(
  key: AxisKey,
  first: string,
  second: string,
  firstScore: number,
  label: string,
): AxisResult {
  const score = round(clamp(firstScore));
  const selected = score >= 50 ? first : second;
  const strength = round(50 + Math.abs(score - 50));
  const level = strength >= 75 ? "높음" : strength >= 61 ? "중간" : "낮음";

  return { key, first, second, firstScore: score, selected, strength, level, label };
}

export function calculateAxes(traits: TraitScores): NyangBtiResult["axes"] {
  const eScore = traits.sociability;
  const nScore =
    traits.boldness * 0.45 +
    traits.adaptability * 0.35 +
    (100 - traits.sensitivity) * 0.2;
  const fScore =
    traits.sociability * 0.5 +
    traits.sensitivity * 0.3 +
    (100 - traits.boldness) * 0.2;
  const pScore =
    traits.playfulness * 0.55 + traits.activity * 0.3 + traits.adaptability * 0.15;

  return {
    EI: createAxis("EI", "E", "I", eScore, "교류 에너지"),
    NS: createAxis("NS", "N", "S", nScore, "탐색 방식"),
    TF: createAxis("TF", "F", "T", fScore, "반응 방식"),
    JP: createAxis("JP", "P", "J", pScore, "생활 리듬"),
  };
}

export function scoreSurvey(answers: SurveyAnswers): NyangBtiResult {
  const traits = calculateTraitScores(answers);
  const axes = calculateAxes(traits);
  const code = `${axes.EI.selected}${axes.NS.selected}${axes.TF.selected}${axes.JP.selected}` as NyangBtiCode;

  return { code, traits, axes };
}

export function getTraitLevel(score: number): "낮음" | "중간" | "높음" {
  if (score < 40) return "낮음";
  if (score < 65) return "중간";
  return "높음";
}

export function getCompletedAnswerCount(answers: SurveyAnswers): number {
  return QUESTIONS.reduce(
    (count, question) => count + (Number.isFinite(answers[question.id]) ? 1 : 0),
    0,
  );
}
