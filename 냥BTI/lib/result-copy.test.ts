import { describe, expect, it } from "vitest";
import { TYPE_CONTENT } from "@/data/type-content";
import { calculateAxes } from "@/lib/scoring";
import { buildBehaviorResultCopy, getAxisPresentation, getTraitInterpretation, getTypePresentation } from "./result-copy";
import { TRAIT_KEYS } from "@/types/nyangbti";
import type { NyangBtiResult, TraitScores } from "@/types/nyangbti";

const traits = (value: number): TraitScores => ({
  sociability: value,
  boldness: value,
  activity: value,
  playfulness: value,
  adaptability: value,
  sensitivity: value,
});

function resultFor(scores: TraitScores): NyangBtiResult {
  const axes = calculateAxes(scores);
  const code = `${axes.EI.selected}${axes.NS.selected}${axes.TF.selected}${axes.JP.selected}` as NyangBtiResult["code"];
  return { code, traits: scores, axes };
}

describe("behavior result copy", () => {
  it("presents neutral answers as a balanced result instead of a strong ENFP stereotype", () => {
    const result = resultFor(traits(50));
    const presentation = getTypePresentation(result, TYPE_CONTENT[result.code]);
    const copy = buildBehaviorResultCopy(result.traits, "모찌");

    expect(result.code).toBe("ENFP");
    expect(presentation.isBalanced).toBe(true);
    expect(presentation.name).toContain("균형형");
    expect(presentation.tagline).toContain("상황에 따른 차이");
    expect(copy.description).toContain("어느 한 모습으로 강하게 기울기보다");
    const axisPresentation = getAxisPresentation(result.axes.EI, result.traits);
    expect(axisPresentation.heading).toBe("E·I 균형");
    expect(axisPresentation.description).toContain("사람과 지낼 때");
    expect(axisPresentation.description).toContain("익숙한 소리와 움직임");
  });

  it("expands an I axis with the cat's observed relationship and sensitivity behavior", () => {
    const result = resultFor({
      sociability: 20,
      boldness: 45,
      activity: 50,
      playfulness: 50,
      adaptability: 45,
      sensitivity: 80,
    });
    const presentation = getAxisPresentation(result.axes.EI, result.traits);

    expect(presentation.heading).toBe("I 성향");
    expect(presentation.description).toContain("혼자 쉴 거리를 확보할 때");
    expect(presentation.description).toContain("먼저 거리를 정하고 혼자 쉬는 시간");
    expect(presentation.description).toContain("작은 소리나 접촉");
  });

  it("explains the displayed level rather than repeating one generic trait definition", () => {
    expect(getTraitInterpretation("sociability", 20)).toContain("혼자 쉬는 시간");
    expect(getTraitInterpretation("sociability", 50)).toContain("상황과 컨디션");
    expect(getTraitInterpretation("sociability", 80)).toContain("교류를 자주");
    expect(getTraitInterpretation("sensitivity", 80)).toContain("빠르게 알아차리고");
  });

  it("builds care and warning copy from the continuous traits", () => {
    const sensitiveAndCautious: TraitScores = {
      sociability: 25,
      boldness: 20,
      activity: 30,
      playfulness: 25,
      adaptability: 20,
      sensitivity: 85,
    };
    const copy = buildBehaviorResultCopy(sensitiveAndCautious, "나비");

    expect(copy.description).toContain("작은 소리와 접촉");
    expect(copy.cautions.join(" ")).toContain("갑작스러운 접촉");
    expect(copy.observationSigns.join(" ")).toContain("환경이 달라진 뒤");
    expect(copy.care.play).toContain("바닥 가까이에서 익숙한 장난감을 천천히");
    expect(copy.care.relationship).toContain("먼저 다가와");
  });

  it("does not prescribe a quiet environment from low boldness alone", () => {
    const cautiousButCalm: TraitScores = {
      sociability: 50,
      boldness: 20,
      activity: 50,
      playfulness: 50,
      adaptability: 25,
      sensitivity: 20,
    };
    const copy = buildBehaviorResultCopy(cautiousButCalm, "보리");

    expect(copy.care.environment).toContain("익숙한 숨는 자리와 자주 다니는 길");
    expect(copy.care.environment).not.toContain("사람 발길과 소리가 적은");
  });

  it("returns complete, non-duplicated copy for all 729 low-middle-high trait combinations", () => {
    const values = [20, 50, 80];
    const combinations = values.length ** TRAIT_KEYS.length;

    for (let index = 0; index < combinations; index += 1) {
      let cursor = index;
      const scores = {} as TraitScores;
      for (const trait of TRAIT_KEYS) {
        scores[trait] = values[cursor % values.length];
        cursor = Math.floor(cursor / values.length);
      }
      const result = resultFor(scores);
      const copy = buildBehaviorResultCopy(scores, "모찌");
      const presentation = getTypePresentation(result, TYPE_CONTENT[result.code]);
      const strings = [
        copy.description,
        ...copy.strengths,
        ...copy.cautions,
        ...copy.observationSigns,
        ...Object.values(copy.care),
        presentation.name,
        presentation.tagline,
        ...Object.values(result.axes).flatMap((axis) => Object.values(getAxisPresentation(axis, scores))),
      ];

      expect(copy.strengths).toHaveLength(2);
      expect(copy.cautions).toHaveLength(2);
      expect(copy.observationSigns).toHaveLength(2);
      copy.strengths.forEach((value) => expect(value.length).toBeGreaterThan(55));
      copy.cautions.forEach((value) => expect(value.length).toBeGreaterThan(70));
      copy.observationSigns.forEach((value) => expect(value.length).toBeGreaterThan(70));
      Object.values(copy.care).forEach((value) => expect(value.length).toBeGreaterThan(60));
      expect(new Set(copy.strengths).size).toBe(2);
      expect(new Set(copy.cautions).size).toBe(2);
      strings.forEach((value) => {
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value).not.toMatch(/undefined|NaN/);
        expect(value).not.toMatch(/자원|동선|피난처|기준점|교류량|교류 신호|보폭|생활 구역|적응할 지원|놀이를 걸/);
      });
    }
  });
});
