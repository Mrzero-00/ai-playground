import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { config, type Item, type GeneratedContent } from "./config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey() });

// 브랜드/포맷 규칙 — 모든 아이템에 동일하게 적용되는 안정적 프리픽스라 프롬프트 캐싱 대상.
const SYSTEM_PROMPT = `당신은 쿠팡 파트너스 어필리에이트 콘텐츠 전문 카피라이터다.
주어진 상품 정보로 (1) 한국어 소개 글과 (2) 인스타그램 캡션을 작성한다.

[소개 글 규칙]
- 800~1200자, 실사용자에게 도움이 되는 정보 중심(과장 광고 금지).
- 구조: 후킹 도입 → 핵심 특징 3가지 → 이런 분께 추천 → 마무리 CTA.
- 자연스러운 한국어, AI 티 나는 표현 지양.

[인스타그램 캡션 규칙]
- 300자 이내, 첫 줄에 강한 훅.
- 이모지 적절히 사용, 마지막에 구매 유도 CTA.
- 해시태그는 caption 본문에 넣지 말고 hashtags 배열로 분리.

[해시태그 규칙]
- 8~15개, '#' 포함. 상품/카테고리/타깃 관련 한국어 위주.

[필수 고지]
- 소개 글과 캡션 모두에 "쿠팡 파트너스 활동으로 일정 수수료를 제공받을 수 있습니다." 문구를 자연스럽게 1회 포함.`;

const ContentSchema = z.object({
  article: z.string().describe("800~1200자 한국어 소개 글"),
  caption: z.string().describe("300자 이내 인스타그램 캡션 (해시태그 제외)"),
  hashtags: z.array(z.string()).describe("'#' 포함 해시태그 8~15개"),
});

export async function generateContent(item: Item): Promise<GeneratedContent> {
  const response = await client.messages.parse({
    model: config.model,
    max_tokens: 16000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: { format: zodOutputFormat(ContentSchema) },
    messages: [
      {
        role: "user",
        content: `다음 상품으로 콘텐츠를 작성해줘.\n\n${JSON.stringify(item, null, 2)}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error(`콘텐츠 생성 실패: ${item.productName}`);
  return parsed;
}
