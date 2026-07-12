# Codex Start Prompt

아래 내용을 Codex에 첫 작업으로 전달합니다.

---

이 저장소는 쿠팡 파트너스 기반 Affiliate Automation Platform이다.

먼저 다음 파일을 순서대로 읽어라.

1. `README.md`
2. `AGENTS.md`
3. `docs/architecture.md`
4. `docs/data-model.md`
5. `docs/ai-workflows.md`
6. `docs/implementation-plan.md`
7. `docs/environment.md`

이번 작업에서는 `docs/implementation-plan.md`의 Phase 0만 구현한다.

필수 요구사항:

- pnpm workspace
- Turborepo
- TypeScript strict mode
- Next.js App Router
- Chakra UI
- TanStack Query
- Zustand
- Vitest
- ESLint
- GitHub Actions CI
- 모든 패키지에 package.json과 tsconfig.json 구성
- 모든 환경변수는 Zod로 검증
- `any` 사용 금지
- 외부 API 실제 호출 금지
- 쿠팡, OpenAI, Supabase는 mock 또는 interface만 정의
- 주석은 복잡한 로직에만 작성
- 루트에서 다음 명령이 모두 동작해야 함

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

구조:

```text
apps/dashboard
apps/content-site
apps/worker
packages/shared
packages/database
packages/affiliate
packages/ai
packages/scoring
packages/compliance
packages/publishing
packages/analytics
packages/ui
```

작업 완료 후 다음을 보고하라.

1. 생성 및 수정한 파일
2. 구현한 구조
3. 실행한 검증 명령과 결과
4. 아직 구현하지 않은 항목
5. 다음 권장 작업
