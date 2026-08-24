import { describe, expect, it } from "vitest";
import { HUMAN_MBTI_CODES } from "@/data/human-mbti";
import { calculateCompatibility } from "./compatibility";
import type { TraitScores } from "@/types/nyangbti";

const sampleTraits: TraitScores = {
  sociability: 62,
  boldness: 41,
  activity: 38,
  playfulness: 71,
  adaptability: 44,
  sensitivity: 73,
};

describe("guardian compatibility", () => {
  it("returns bounded, deterministic entertainment scores for all 16 types", () => {
    const firstRun = HUMAN_MBTI_CODES.map((code) =>
      calculateCompatibility(code, sampleTraits, "모찌"),
    );
    const secondRun = HUMAN_MBTI_CODES.map((code) =>
      calculateCompatibility(code, sampleTraits, "모찌"),
    );

    expect(firstRun).toEqual(secondRun);
    firstRun.forEach(({ score }) => {
      expect(score).toBeGreaterThanOrEqual(45);
      expect(score).toBeLessThanOrEqual(97);
    });
  });
});
