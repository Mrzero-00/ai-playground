import { describe, expect, it } from "vitest";
import { CHARACTER_ASSETS } from "@/data/character-assets";
import { HUMAN_MBTI_CODES, HUMAN_MBTI_PROFILES } from "@/data/human-mbti";
import { ANSWER_OPTIONS, QUESTIONS } from "@/data/questions";
import { TYPE_CONTENT } from "@/data/type-content";
import { TRAIT_KEYS } from "@/types/nyangbti";

describe("냥BTI data integrity", () => {
  it("contains 30 unique questions with five primary questions per trait", () => {
    expect(QUESTIONS).toHaveLength(30);
    expect(new Set(QUESTIONS.map(({ id }) => id)).size).toBe(30);

    for (const trait of TRAIT_KEYS) {
      expect(QUESTIONS.filter((question) => question.trait === trait)).toHaveLength(5);
    }
  });

  it("uses the complete 0..4 answer scale and valid finite weights", () => {
    expect(ANSWER_OPTIONS.map(({ value }) => value)).toEqual([0, 1, 2, 3, 4]);

    for (const question of QUESTIONS) {
      expect(question.prompt.trim().length).toBeGreaterThan(0);
      expect(question.example).toMatch(/^예:/);
      expect(Object.keys(question.weights).length).toBeGreaterThan(0);
      for (const [trait, weight] of Object.entries(question.weights)) {
        expect(TRAIT_KEYS).toContain(trait);
        expect(Number.isFinite(weight)).toBe(true);
      }
    }
  });

  it("keeps all 16 result contents, human profiles, and character assets aligned", () => {
    const expectedCodes = [...HUMAN_MBTI_CODES].sort();

    expect(Object.keys(TYPE_CONTENT).sort()).toEqual(expectedCodes);
    expect(Object.keys(HUMAN_MBTI_PROFILES).sort()).toEqual(expectedCodes);
    expect(Object.keys(CHARACTER_ASSETS).sort()).toEqual(expectedCodes);

    for (const code of HUMAN_MBTI_CODES) {
      expect(TYPE_CONTENT[code].code).toBe(code);
      expect(CHARACTER_ASSETS[code]).toBe(`/characters/${code.toLowerCase()}.png`);
      for (const value of Object.values(HUMAN_MBTI_PROFILES[code])) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });
});
