import { describe, expect, it } from "vitest";
import { withJosa } from "./korean";

describe("withJosa", () => {
  it("selects particles from the final consonant", () => {
    expect(withJosa("봄", "이/가")).toBe("봄이");
    expect(withJosa("나비", "이/가")).toBe("나비가");
    expect(withJosa("생활 리듬", "이/가")).toBe("생활 리듬이");
    expect(withJosa("교감의 거리", "이/가")).toBe("교감의 거리가");
    expect(withJosa("봄", "과/와")).toBe("봄과");
    expect(withJosa("나비", "과/와")).toBe("나비와");
  });
});
