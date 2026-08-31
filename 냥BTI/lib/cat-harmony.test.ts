import { describe, expect, it } from "vitest";
import { calculateCatHarmony } from "./cat-harmony";
import type { TraitScores } from "@/types/nyangbti";

const traits = (value: number): TraitScores => ({ sociability: value, boldness: value, activity: value, playfulness: value, adaptability: value, sensitivity: value });

describe("calculateCatHarmony", () => {
  it("keeps identical rhythms at the top of the descriptive range", () => {
    const result = calculateCatHarmony(traits(60), traits(60));
    expect(result.score).toBe(100);
    expect(result.dimensions).toHaveLength(4);
    expect(result.dimensions[0]).toMatchObject({
      key: "social",
      label: "교류 욕구",
      lowLabel: "혼자 회복",
      highLabel: "먼저 다가감",
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
    expect(result.sharedTips.join(" ")).toContain("구름이 자리를 뜨면");
    expect(result.sharedTips.join(" ")).toContain("보리");
    expect(result.sharedTips.length).toBeGreaterThanOrEqual(2);
    expect(result.dimensions[0].firstReading).toMatchObject({ level: "높음", title: "먼저 다가가는 편" });
    expect(result.dimensions[0].secondReading).toMatchObject({ level: "낮음", title: "혼자 회복하는 편" });
    expect(result.dimensions[0].comparison).toContain("보리");
    expect(result.dimensions[0].comparison).toContain("구름");
    expect(result.dimensions[0].tip).toContain("숨숨집");
  });

  it("keeps comparison copy aligned with the cats' actual score bands", () => {
    const quiet = traits(20);
    const moderate = traits(40);
    const result = calculateCatHarmony(quiet, moderate, { firstName: "나비", secondName: "모찌" });

    expect(result.dimensions[0].firstReading.title).toBe("혼자 회복하는 편");
    expect(result.dimensions[0].secondReading.title).toBe("상황을 보며 교류");
    expect(result.dimensions[0].comparison).toContain("모찌가 상대적으로 교류 신호를 더 자주");
    expect(result.dimensions[0].comparison).not.toContain("모찌는 먼저 다가가");
    expect(result.dimensions[2].comparison).toContain("변화된 공간을 먼저 확인하는 동안");
  });

  it("describes similar low rhythms without implying active interaction", () => {
    const result = calculateCatHarmony(traits(20), traits(20), { firstName: "탄이", secondName: "솜이" });

    expect(result.dimensions[0].comparison).toContain("각자의 자리에서 안정감");
    expect(result.dimensions[1].comparison).toContain("조용한 휴식");
    expect(result.dimensions[2].comparison).toContain("익숙한 냄새와 동선");
  });
});
