import { beforeEach, describe, expect, it } from "vitest";
import { initialReviewItems, useReviewStore } from "./review-store";
describe("review state", () => {
  beforeEach(() => { useReviewStore.setState({ items: initialReviewItems }); });
  it("approves compliant review content", () => { useReviewStore.getState().approve("fixture-content-1"); expect(useReviewStore.getState().items[0]?.status).toBe("APPROVED"); });
  it("requires a rejection reason", () => { useReviewStore.getState().reject("fixture-content-1", " "); expect(useReviewStore.getState().items[0]?.status).toBe("REVIEW_REQUIRED"); });
});
