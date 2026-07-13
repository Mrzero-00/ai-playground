import { ExternalServiceError } from "@affiliate-automation/shared";
import { z } from "zod";
export const publishableContentSchema = z.object({ id: z.string().min(1), channel: z.enum(["CONTENT_SITE", "INSTAGRAM"]), title: z.string().nullable(), body: z.string().min(1), status: z.literal("APPROVED") });
export const publishResultSchema = z.object({ publicationId: z.string(), contentId: z.string(), status: z.literal("PUBLISHED"), publishedUrl: z.url(), publishedAt: z.iso.datetime({ offset: true }) });
export type PublishableContent = z.infer<typeof publishableContentSchema>;
export type PublishResult = z.infer<typeof publishResultSchema>;
export interface PublishingProvider { readonly channel: PublishableContent["channel"]; publish(content: PublishableContent): Promise<PublishResult>; }

export class InMemoryContentSitePublishingProvider implements PublishingProvider {
  public readonly channel = "CONTENT_SITE" as const;
  readonly #publications = new Map<string, PublishResult>();
  public constructor(private readonly baseUrl: string, private readonly now: () => string = () => new Date().toISOString()) { z.url().parse(baseUrl); }
  public publish(contentInput: PublishableContent): Promise<PublishResult> {
    const content = publishableContentSchema.parse(contentInput); const existing = this.#publications.get(content.id); if (existing) return Promise.resolve(existing);
    const result = publishResultSchema.parse({ publicationId: `publication:${content.id}`, contentId: content.id, status: "PUBLISHED", publishedUrl: new URL(`/posts/${encodeURIComponent(content.id)}`, this.baseUrl).toString(), publishedAt: this.now() });
    this.#publications.set(content.id, result); return Promise.resolve(result);
  }
}

export class DisabledInstagramPublishingProvider implements PublishingProvider {
  public readonly channel = "INSTAGRAM" as const;
  public publish(content: PublishableContent): Promise<PublishResult> {
    void content;
    return Promise.reject(new ExternalServiceError("Instagram publishing is disabled until official permissions are configured", { provider: "META", operation: "publish", retryable: false }));
  }
}
