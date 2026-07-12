import { z } from "zod";

const optionalSecret = z.string().min(1).optional();

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url(),
  DASHBOARD_URL: z.url(),
  CONTENT_SITE_URL: z.url(),
  DATABASE_URL: optionalSecret,
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  TRIGGER_SECRET_KEY: optionalSecret,
  TRIGGER_PROJECT_ID: optionalSecret,
  OPENAI_API_KEY: optionalSecret,
  AI_MARKET_RESEARCH_MODEL: optionalSecret,
  AI_PRODUCT_SCORING_MODEL: optionalSecret,
  AI_CONTENT_MODEL: optionalSecret,
  AI_COMPLIANCE_MODEL: optionalSecret,
  COUPANG_PARTNERS_ACCESS_KEY: optionalSecret,
  COUPANG_PARTNERS_SECRET_KEY: optionalSecret,
  COUPANG_PARTNERS_SUB_ID: optionalSecret,
  INSTAGRAM_ACCESS_TOKEN: optionalSecret,
  INSTAGRAM_BUSINESS_ACCOUNT_ID: optionalSecret,
  META_APP_ID: optionalSecret,
  META_APP_SECRET: optionalSecret,
  SENTRY_DSN: z.url().optional(),
  LANGFUSE_PUBLIC_KEY: optionalSecret,
  LANGFUSE_SECRET_KEY: optionalSecret,
  LANGFUSE_BASE_URL: z.url().optional(),
  AFFILIATE_REDIRECT_SIGNING_SECRET: optionalSecret,
  CRON_SIGNING_SECRET: optionalSecret,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseClientEnv(input: unknown): ClientEnv {
  return clientEnvSchema.parse(input);
}

export function parseServerEnv(input: unknown): ServerEnv {
  return serverEnvSchema.parse(input);
}
