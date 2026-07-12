# Environment Variables

`.env.example`에 아래 변수를 정의합니다.

```bash
# Application
NODE_ENV=development
APP_URL=http://localhost:3000
DASHBOARD_URL=http://localhost:3001
CONTENT_SITE_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

# Trigger.dev
TRIGGER_SECRET_KEY=
TRIGGER_PROJECT_ID=

# OpenAI
OPENAI_API_KEY=
AI_MARKET_RESEARCH_MODEL=
AI_PRODUCT_SCORING_MODEL=
AI_CONTENT_MODEL=
AI_COMPLIANCE_MODEL=

# Coupang Partners
COUPANG_PARTNERS_ACCESS_KEY=
COUPANG_PARTNERS_SECRET_KEY=
COUPANG_PARTNERS_SUB_ID=

# Instagram
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
META_APP_ID=
META_APP_SECRET=

# Monitoring
SENTRY_DSN=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=

# Security
AFFILIATE_REDIRECT_SIGNING_SECRET=
CRON_SIGNING_SECRET=
```

---

## Validation

환경변수는 앱 시작 시 Zod로 검증합니다.

```ts
import { z } from 'zod';

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
```

Client 환경변수와 Server 환경변수를 분리합니다.

`SUPABASE_SERVICE_ROLE_KEY`, API Secret, Access Token은 절대 Client Bundle에 포함하지 않습니다.
