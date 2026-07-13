import { describe, expect, it } from "vitest";
import { ensureDisclosure, validateCompliance } from "../src";
describe("compliance rules", () => {
  it("passes a disclosed factual draft", () => {
    const body = ensureDisclosure("휴대용 선풍기 선택 기준을 확인하세요.");
    expect(validateCompliance({ body, productName: "휴대용 선풍기", categoryPath: ["가전"], links: ["https://example.com/product"] }).passed).toBe(true);
  });
  it("automatically rejects critical violations", () => {
    const result = validateCompliance({ body: "이 제품은 질병을 완치합니다.", productName: "제품", categoryPath: ["불법의약품"], links: ["http://invalid.example"] });
    expect(result.passed).toBe(false); expect(result.violations.some((item) => item.severity === "CRITICAL")).toBe(true);
  });
});
