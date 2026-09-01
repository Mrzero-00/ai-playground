import { describe, expect, it } from "vitest";
import { calculateCatHarmony } from "./cat-harmony";
import { TRAIT_KEYS } from "@/types/nyangbti";
import type { TraitScores } from "@/types/nyangbti";

const traits = (value: number): TraitScores => ({ sociability: value, boldness: value, activity: value, playfulness: value, adaptability: value, sensitivity: value });

describe("calculateCatHarmony", () => {
  it("keeps identical rhythms at the top of the descriptive range", () => {
    const result = calculateCatHarmony(traits(60), traits(60));
    expect(result.score).toBe(100);
    expect(result.dimensions).toHaveLength(4);
    expect(result.dimensions[0]).toMatchObject({
      key: "social",
      label: "사람과 지내는 거리",
      lowLabel: "혼자 쉬기",
      highLabel: "사람 곁 찾기",
      difference: 0,
    });
    expect(result.dimensions[0].comparison).toContain("첫 번째 고양이");
    expect(result.dimensions[0].tip.length).toBeGreaterThan(20);
    expect(result.careGuides).toHaveLength(2);
    expect(result.commonCautions).toHaveLength(3);
  });

  it("returns a bounded entertainment score for very different traits", () => {
    const result = calculateCatHarmony(traits(0), traits(100));
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.title).toContain("속도");
  });

  it("uses names and trait differences in individual and shared guidance", () => {
    const active = { ...traits(50), sociability: 90, activity: 90, playfulness: 90, sensitivity: 20 };
    const cautious = { ...traits(50), sociability: 10, boldness: 10, adaptability: 10, sensitivity: 90 };
    const result = calculateCatHarmony(active, cautious, { firstName: "보리", secondName: "구름" });

    expect(result.careGuides[0].name).toBe("보리");
    expect(result.careGuides[0].cautions.join(" ")).toContain("보리");
    expect(result.careGuides[1].cautions.join(" ")).toContain("구름");
    expect(result.sharedTips.join(" ")).toContain("구름이 자리를 뜨고 보리가 뒤따르는");
    expect(result.sharedTips.join(" ")).toContain("보리");
    expect(result.sharedTips.length).toBeGreaterThanOrEqual(2);
    expect(result.dimensions[0].firstReading).toMatchObject({ level: "높음", title: "사람 곁을 자주 찾는 편" });
    expect(result.dimensions[0].secondReading).toMatchObject({ level: "낮음", title: "사람과 거리를 정하는 편" });
    expect(result.dimensions[0].comparison).toContain("보리");
    expect(result.dimensions[0].comparison).toContain("구름");
    expect(result.dimensions[0].tip).toContain("숨숨집");
  });

  it("keeps comparison copy aligned with the cats' actual score bands", () => {
    const quiet = traits(20);
    const moderate = traits(40);
    const result = calculateCatHarmony(quiet, moderate, { firstName: "나비", secondName: "모찌" });

    expect(result.dimensions[0].firstReading.title).toBe("사람과 거리를 정하는 편");
    expect(result.dimensions[0].secondReading.title).toBe("상황을 보며 사람과 교류");
    expect(result.dimensions[0].comparison).toContain("사람과 지낼 때는 모찌가 사람 곁에 다가가거나 따라오는 행동을 더 자주");
    expect(result.dimensions[0].comparison).toContain("단정할 수는 없지만");
    expect(result.dimensions[0].comparison).not.toContain("모찌는 먼저 다가가");
    expect(result.dimensions[2].comparison).toContain("달라진 공간을 먼저 둘러보는 동안");
    expect(result.dimensions[2].tip).toContain("새 물건은 평소 쉬거나 먹는 자리와 조금 떨어진 곳에 먼저 놓고");
    expect(result.dimensions[2].tip).toContain("평소 쓰던 밥그릇과 화장실로 갈 수 있는 길");
  });

  it("describes similar low rhythms without implying active interaction", () => {
    const result = calculateCatHarmony(traits(20), traits(20), { firstName: "탄이", secondName: "솜이" });

    expect(result.dimensions[0].comparison).toContain("사람과의 거리를 스스로 정하는 편");
    expect(result.dimensions[1].comparison).toContain("조용한 휴식");
    expect(result.dimensions[2].comparison).toContain("가구·밥그릇·화장실 위치가 그대로");
  });

  it("returns complete context for all 729 trait-band profiles against their complementary profile", () => {
    const values = [20, 50, 80];
    const combinations = values.length ** TRAIT_KEYS.length;

    for (let index = 0; index < combinations; index += 1) {
      let cursor = index;
      const first = {} as TraitScores;
      const second = {} as TraitScores;
      for (const trait of TRAIT_KEYS) {
        const value = values[cursor % values.length];
        first[trait] = value;
        second[trait] = 100 - value;
        cursor = Math.floor(cursor / values.length);
      }

      const result = calculateCatHarmony(first, second, { firstName: "보리", secondName: "구름" });
      const strings = [
        result.title,
        ...result.dimensions.flatMap((dimension) => [
          dimension.description,
          dimension.firstReading.title,
          dimension.firstReading.description,
          dimension.secondReading.title,
          dimension.secondReading.description,
          dimension.comparison,
          dimension.tip,
        ]),
        ...result.careGuides.flatMap((guide) => [guide.summary, ...guide.cautions]),
        ...result.sharedTips,
        ...result.commonCautions,
      ];

      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.dimensions).toHaveLength(4);
      expect(result.careGuides).toHaveLength(2);
      expect(result.sharedTips.length).toBeGreaterThanOrEqual(2);
      strings.forEach((value) => {
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value).not.toMatch(/undefined|NaN/);
        expect(value).not.toMatch(/자원|동선|피난처|기준점|교류량|교류 신호|보폭|생활 구역|적응할 지원|놀이를 걸/);
      });
    }
  });
});
