# AI_쿠팡 파트너스 (AAOS) — 프로젝트 가이드

> AI 기반 쿠팡 파트너스 자동화 및 콘텐츠 운영 플랫폼

AI Agent로 트렌드 분석 → 상품 발굴 → 수익성 분석 → 콘텐츠 생성 → 이미지/영상 생성 →
SNS 업로드 → 성과 분석 → 자동 개선까지 수행하는 Affiliate Marketing Operating System.

전체 기획/단계별 상세는 `README.md` 참고.

## 목표

- 사람 개입 없이 하루 수십~수백 개 콘텐츠 자동 생산
- 수익성 높은 상품만 자동 선별
- 여러 SNS 자동 배포
- 성과 데이터를 학습해 스스로 개선하는 Agent

## Agent 파이프라인

Trend → Product Scout → Profit Score → Content Planner
→ (Blog / Instagram / Shorts / X / Threads) → Publish → Analytics → Learning → (Loop)

## 기술 스택

- **Frontend**: Next.js, TypeScript, Chakra UI
- **Backend**: Next.js Route Handler, Supabase
- **Queue**: BullMQ
- **Workflow**: LangGraph, Trigger.dev
- **AI**: OpenAI, Gemini, Claude
- **Image**: GPT Image, Flux / **Video**: Veo, Kling, Runway
- **DB**: Supabase, pgvector / **Storage**: Cloudflare R2

## 디렉터리(예정)

```
apps/      dashboard, worker, api
packages/  agents, shared, database, prompts, workflow, analytics
```

## 작업 규칙

- 이 폴더는 독립 프로젝트다. 작업 시 이 `CLAUDE.md` 와 `README.md` 를 우선 컨텍스트로 삼는다.
- README 상단의 `> 한 줄 요약` 을 바꾸면 루트에서
  `node ../scripts/update-readme.mjs` 를 실행해 루트 README를 갱신한다.
- API 키/시크릿은 코드에 하드코딩하지 않고 환경변수(`.env`)로 관리한다.
- **모든 작업이 끝나면 반드시 루트 README를 갱신한다.**
  루트에서 `node scripts/update-readme.mjs`(또는 프로젝트 폴더에서 `node ../scripts/update-readme.mjs`)를 실행한다.
  이 규칙은 `.claude/settings.json` 의 Stop 훅으로도 자동 강제된다(작업 종료 시 자동 실행).

## 파이프라인 서브에이전트

`.claude/agents/` 에 README의 10단계 파이프라인별 Claude Code 서브에이전트를 정의해 두었다.
해당 단계 작업은 아래 에이전트에 위임한다.

| 단계 | 에이전트 |
| --- | --- |
| Phase 2 트렌드 분석 | `trend-agent` |
| Phase 3 상품 발굴 | `product-scout-agent` |
| Phase 4 수익성 스코어링 | `profit-score-agent` |
| Phase 5 콘텐츠 전략 | `content-planner-agent` |
| Phase 6 SEO 블로그 | `blog-agent` |
| Phase 7 SNS 콘텐츠 | `sns-agent` |
| Phase 8 이미지/영상 | `creative-agent` |
| Phase 9 자동 발행 | `publish-agent` |
| Phase 10 성과 분석 | `analytics-agent` |
| Phase 11 자동 개선 | `learning-agent` |
