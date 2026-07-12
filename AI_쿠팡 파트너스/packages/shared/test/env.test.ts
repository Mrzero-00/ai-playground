import { describe, expect, it } from "vitest";
import { parseClientEnv, parseServerEnv } from "../src/env";

describe("environment validation", () => {
  it("parses valid server environment values", () => {
    const env = parseServerEnv({
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
      DASHBOARD_URL: "http://localhost:3001",
      CONTENT_SITE_URL: "http://localhost:3000",
    });
    expect(env.NODE_ENV).toBe("test");
  });

  it("rejects a client secret with an invalid URL", () => {
    expect(() => parseClientEnv({
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key",
    })).toThrow();
  });
});
