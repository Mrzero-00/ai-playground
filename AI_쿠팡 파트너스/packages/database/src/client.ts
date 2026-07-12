import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const configSchema = z.object({ url: z.url(), serviceRoleKey: z.string().min(1) });
interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type DatabaseClient = SupabaseClient<Database>;

export function createDatabaseClient(input: unknown): DatabaseClient {
  const config = configSchema.parse(input);
  return createClient<Database>(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
