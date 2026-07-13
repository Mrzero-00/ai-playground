import { describe, expect, it } from "vitest";
import { DisabledInstagramPublishingProvider, InMemoryContentSitePublishingProvider } from "../src";
const content = { id: "content-1", channel: "CONTENT_SITE" as const, title: "가이드", body: "승인된 본문", status: "APPROVED" as const };
describe("publishing adapters", () => {
  it("publishes approved content idempotently", async () => { const provider = new InMemoryContentSitePublishingProvider("https://content.example.com", () => "2026-07-13T00:00:00+00:00"); const first = await provider.publish(content); const second = await provider.publish(content); expect(second).toEqual(first); });
  it("keeps Instagram disabled without permissions", async () => { await expect(new DisabledInstagramPublishingProvider().publish({ ...content, channel: "INSTAGRAM" })).rejects.toMatchObject({ context: { retryable: false } }); });
});
