import { describe, expect, it } from "vitest";
import { QUESTIONS } from "@/data/questions";
import { calculateTraitScores, scoreSurvey } from "./scoring";

const allAnswers = (value: number) =>
  Object.fromEntries(QUESTIONS.map((question) => [question.id, value]));

describe("냥BTI scoring", () => {
  it("keeps a neutral response at the midpoint for every trait", () => {
    expect(calculateTraitScores(allAnswers(2))).toEqual({
      sociability: 50,
      boldness: 50,
      activity: 50,
      playfulness: 50,
      adaptability: 50,
      sensitivity: 50,
    });
  });

  it("normalizes every trait to the 0..100 range", () => {
    for (const answers of [allAnswers(0), allAnswers(4)]) {
      for (const score of Object.values(calculateTraitScores(answers))) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("derives a four-letter code that agrees with selected axes", () => {
    const result = scoreSurvey(allAnswers(4));
    expect(result.code).toBe(
      `${result.axes.EI.selected}${result.axes.NS.selected}${result.axes.TF.selected}${result.axes.JP.selected}`,
    );
  });
});
