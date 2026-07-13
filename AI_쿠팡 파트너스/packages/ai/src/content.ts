import { z } from "zod";

export const contentChannelSchema = z.enum(["BLOG", "INSTAGRAM_CAROUSEL", "INSTAGRAM_REEL"]);
export const contentPlanSchema = z.object({ targetAudience: z.array(z.string()).min(1), customerProblem: z.string().min(1), contentAngle: z.string().min(1), keyBenefits: z.array(z.string()), cautions: z.array(z.string()), channelPlans: z.array(z.object({ channel: contentChannelSchema, hook: z.string(), structure: z.array(z.string()), callToAction: z.string() })) });
export const contentDraftSchema = z.object({ channel: contentChannelSchema, title: z.string().nullable(), body: z.string().min(1), metadata: z.record(z.string(), z.unknown()), confidenceScore: z.number().min(0).max(1), promptKey: z.string(), promptVersion: z.number().int().positive() });
export type ContentPlan = z.infer<typeof contentPlanSchema>;
export type ContentDraft = z.infer<typeof contentDraftSchema>;

export function createFixtureContentPlan(productName: string): ContentPlan {
  return contentPlanSchema.parse({ targetAudience: ["상품 선택 정보를 찾는 사용자"], customerProblem: `${productName} 선택 기준이 불명확함`, contentAngle: "검증된 상품 정보 중심 가이드", keyBenefits: ["선택 기준 정리"], cautions: ["가격과 재고는 구매 전 확인"], channelPlans: [
    { channel: "BLOG", hook: `${productName} 선택 전 확인할 점`, structure: ["선택 기준", "주의사항"], callToAction: "최신 상품 정보를 확인하세요" },
    { channel: "INSTAGRAM_CAROUSEL", hook: "핵심 선택 기준", structure: ["문제", "기준", "주의"], callToAction: "저장해 두고 비교하세요" },
    { channel: "INSTAGRAM_REEL", hook: "구매 전 10초 체크", structure: ["훅", "핵심", "CTA"], callToAction: "상세 정보를 확인하세요" },
  ] });
}

export function generateFixtureDrafts(plan: ContentPlan, productName: string): ContentDraft[] {
  return plan.channelPlans.map((channelPlan) => contentDraftSchema.parse({ channel: channelPlan.channel, title: channelPlan.channel === "BLOG" ? channelPlan.hook : null, body: `${channelPlan.hook}\n${productName}의 검증된 상품 정보를 기준으로 비교하세요. ${plan.cautions.join(" ")}\n쿠팡 파트너스 활동으로 일정 수수료를 제공받을 수 있습니다.\n${channelPlan.callToAction}`, metadata: { structure: channelPlan.structure }, confidenceScore: .95, promptKey: channelPlan.channel.toLocaleLowerCase(), promptVersion: 1 }));
}

function tokens(value: string): Set<string> { return new Set(value.toLocaleLowerCase("ko-KR").split(/\s+/u).filter(Boolean)); }
export function duplicateSimilarity(left: string, right: string): number {
  const a = tokens(left); const b = tokens(right); const union = new Set([...a, ...b]);
  if (union.size === 0) return 1;
  return [...a].filter((token) => b.has(token)).length / union.size;
}
