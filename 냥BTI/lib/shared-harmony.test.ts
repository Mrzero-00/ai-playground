import { describe, expect, it } from "vitest";
import { decodeSharedCatResult, encodeSharedCatResult } from "./shared-harmony";

const result = {
  v: 1 as const,
  name: "봄이",
  code: "ENFP" as const,
  traits: { sociability: 80, boldness: 70, activity: 75, playfulness: 90, adaptability: 65, sensitivity: 35 },
};

describe("shared harmony payload", () => {
  it("round-trips a Korean cat name without answers or profile details", () => {
    expect(decodeSharedCatResult(encodeSharedCatResult(result))).toEqual(result);
  });

  it("rejects malformed and out-of-range payloads", () => {
    expect(decodeSharedCatResult("not-base64")).toBeNull();
    const invalid = { ...result, traits: { ...result.traits, activity: 101 } };
    expect(decodeSharedCatResult(encodeSharedCatResult(invalid))).toBeNull();
    expect(decodeSharedCatResult(encodeSharedCatResult({ ...result, code: "ISTJ" }))).toBeNull();
    expect(decodeSharedCatResult(encodeSharedCatResult({ ...result, name: "봄이\n가짜 안내" }))).toBeNull();
  });
});
