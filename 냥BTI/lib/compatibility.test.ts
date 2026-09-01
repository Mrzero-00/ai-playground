import { describe, expect, it } from "vitest";
import { HUMAN_MBTI_CODES, HUMAN_MBTI_PROFILES } from "@/data/human-mbti";
import { calculateCompatibility, catTraitsToInteractionNeeds } from "./compatibility";
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

  it("compares every human profile against continuous cat needs", () => {
    const catNeeds = catTraitsToInteractionNeeds(sampleTraits);

    expect(Object.keys(catNeeds)).toEqual(Object.keys(HUMAN_MBTI_PROFILES.ENFP));
    Object.values(catNeeds).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });

    expect(new Set(HUMAN_MBTI_CODES.map((code) => calculateCompatibility(code, sampleTraits).score)).size)
      .toBeGreaterThan(1);
  });

  it("changes adjustment guidance according to which side is higher", () => {
    const lowNeeds = calculateCompatibility("ENFP", {
      sociability: 0,
      boldness: 0,
      activity: 0,
      playfulness: 0,
      adaptability: 0,
      sensitivity: 0,
    }, "모찌");
    const highNeeds = calculateCompatibility("ISTJ", {
      sociability: 100,
      boldness: 100,
      activity: 100,
      playfulness: 100,
      adaptability: 100,
      sensitivity: 100,
    }, "모찌");

    expect(lowNeeds.adjustment).toContain("집사님이 준비하는 놀이");
    expect(lowNeeds.adjustment).toContain("빠르거나 낯설 수");
    expect(highNeeds.adjustment).toContain("모찌가 집사님이 예상한 것보다 사람 곁에 자주");
  });

  it("describes the closest dimension without claiming every match is strong", () => {
    const result = calculateCompatibility("ENFP", sampleTraits, "모찌");

    expect(result.title).toContain("가장 가까운 조합");
    expect(result.title).not.toContain("잘 통하는");
  });

  it("returns complete copy across all MBTI types and trait band combinations", () => {
    const values = [20, 50, 80];
    for (const mbti of HUMAN_MBTI_CODES) {
      for (const sociability of values) {
        for (const boldness of values) {
          for (const activity of values) {
            for (const playfulness of values) {
              for (const adaptability of values) {
                for (const sensitivity of values) {
                  const result = calculateCompatibility(mbti, {
                    sociability,
                    boldness,
                    activity,
                    playfulness,
                    adaptability,
                    sensitivity,
                  }, "모찌");
                  expect(result.score).toBeGreaterThanOrEqual(45);
                  expect(result.score).toBeLessThanOrEqual(97);
                  [result.title, result.goodFit, result.adjustment, result.tip].forEach((value) => {
                    expect(value.trim().length).toBeGreaterThan(0);
                    expect(value).not.toMatch(/undefined|NaN/);
                    expect(value).not.toMatch(/자원|동선|피난처|기준점|교류량|교류 신호|보폭|생활 구역|적응할 지원|놀이를 걸/);
                  });
                  expect(result.goodFit.length).toBeGreaterThan(100);
                  expect(result.adjustment.length).toBeGreaterThan(100);
                  expect(result.tip.length).toBeGreaterThan(90);
                }
              }
            }
          }
        }
      }
    }
  });
});
