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
    expect(result.sharedTips.join(" ")).toContain("조심스러운 고양이");
    expect(result.sharedTips.length).toBeGreaterThanOrEqual(2);
    expect(result.dimensions[0].firstReading).toMatchObject({ level: "높음", title: "먼저 다가가는 편" });
    expect(result.dimensions[0].secondReading).toMatchObject({ level: "낮음", title: "혼자 회복하는 편" });
    expect(result.dimensions[0].comparison).toContain("보리");
    expect(result.dimensions[0].comparison).toContain("구름");
    expect(result.dimensions[0].tip).toContain("숨숨집");
  });
});
