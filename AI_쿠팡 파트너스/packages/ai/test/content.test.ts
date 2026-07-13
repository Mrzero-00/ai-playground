import { describe, expect, it } from "vitest";
import { createFixtureContentPlan, duplicateSimilarity, generateFixtureDrafts } from "../src";
describe("content pipeline", () => {
  it("creates independent structured channel drafts", () => {
    const drafts = generateFixtureDrafts(createFixtureContentPlan("휴대용 선풍기"), "휴대용 선풍기");
    expect(drafts.map((draft) => draft.channel)).toEqual(["BLOG", "INSTAGRAM_CAROUSEL", "INSTAGRAM_REEL"]);
    expect(new Set(drafts.map((draft) => draft.body)).size).toBe(3);
  });
  it("detects duplicate similarity", () => { expect(duplicateSimilarity("같은 문장 테스트", "같은 문장 테스트")).toBe(1); });
});
