import type { ExecutionModeV1, ExecutionRuntimeGateV1 } from "@investment-os/core";

const LIVE_ACK = "I_UNDERSTAND_LIVE_TRADING_RISK";
const R1_LIVE_HARD_BLOCKER = "R1_AUTHORITATIVE_EXECUTION_LEDGER_NOT_AVAILABLE";

export type ExecutionRuntimeConfig = {
  host: string;
  port: number;
  serviceToken: string;
  runtimeGate: ExecutionRuntimeGateV1;
  allowedAccounts: string[];
  reconciliationHealthy: boolean;
  toss?: {
    clientId: string;
    clientSecret: string;
    accountId: string;
    accountSeq: string;
  };
};

export function loadExecutionRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ExecutionRuntimeConfig {
  const mode = parseMode(env.EXECUTION_MODE);
  const allowedAccounts = splitCsv(env.EXECUTION_ALLOWED_ACCOUNTS);
  const accountSeq = env.TOSS_ACCOUNT_SEQ?.trim() ?? "";
  const accountId = env.TOSS_ACCOUNT_ID?.trim() ?? "";
  const runtimeGate: ExecutionRuntimeGateV1 = {
    mode,
    autoTradingEnabled: env.AUTO_TRADING_ENABLED === "true",
    liveTradingAcknowledged: env.LIVE_TRADING_ACK === LIVE_ACK,
    releaseEvidenceVerified: env.EXECUTION_RELEASE_EVIDENCE_VERIFIED === "true" && Boolean(env.EXECUTION_RELEASE_EVIDENCE_ID?.trim()),
    accountAllowed: accountSeq.length > 0 && allowedAccounts.includes(accountSeq),
    killSwitchOpen: mode === "LIVE" ? env.EXECUTION_KILL_SWITCH_OPEN !== "false" : env.EXECUTION_KILL_SWITCH_OPEN === "true",
    maxSingleOrderNotional: env.EXECUTION_MAX_SINGLE_ORDER_NOTIONAL?.trim() || "100000",
    maxPriceDriftBps: parseInteger(env.EXECUTION_MAX_PRICE_DRIFT_BPS, 50, "EXECUTION_MAX_PRICE_DRIFT_BPS"),
    maxDataAgeSeconds: parseInteger(env.EXECUTION_MAX_DATA_AGE_SECONDS, 300, "EXECUTION_MAX_DATA_AGE_SECONDS"),
  };
  const config: ExecutionRuntimeConfig = {
    host: env.EXECUTION_HOST?.trim() || "127.0.0.1",
    port: parseInteger(env.EXECUTION_PORT, 4100, "EXECUTION_PORT"),
    serviceToken: env.EXECUTION_SERVICE_TOKEN?.trim() ?? "",
    runtimeGate,
    allowedAccounts,
    reconciliationHealthy: env.EXECUTION_RECONCILIATION_HEALTHY === "true",
    ...((env.TOSS_CLIENT_ID?.trim() && env.TOSS_CLIENT_SECRET?.trim() && accountId && accountSeq)
      ? { toss: { clientId: env.TOSS_CLIENT_ID.trim(), clientSecret: env.TOSS_CLIENT_SECRET.trim(), accountId, accountSeq } }
      : {}),
  };
  validateConfig(config);
  return config;
}

function validateConfig(config: ExecutionRuntimeConfig): void {
  if (!config.serviceToken) throw new Error("EXECUTION_SERVICE_TOKEN is required");
  if (config.serviceToken.length < 16) throw new Error("EXECUTION_SERVICE_TOKEN must be at least 16 characters");
  if (config.runtimeGate.mode !== "LIVE") return;
  const missing: string[] = [];
  if (!config.runtimeGate.autoTradingEnabled) missing.push("AUTO_TRADING_ENABLED");
  if (!config.runtimeGate.liveTradingAcknowledged) missing.push("LIVE_TRADING_ACK");
  if (!config.runtimeGate.releaseEvidenceVerified) missing.push("EXECUTION_RELEASE_EVIDENCE");
  if (!config.runtimeGate.accountAllowed) missing.push("EXECUTION_ALLOWED_ACCOUNTS");
  if (config.runtimeGate.killSwitchOpen) missing.push("EXECUTION_KILL_SWITCH_OPEN=false");
  if (!config.reconciliationHealthy) missing.push("EXECUTION_RECONCILIATION_HEALTHY");
  if (!config.toss) missing.push("TOSS_CREDENTIALS");
  missing.push(R1_LIVE_HARD_BLOCKER);
  if (missing.length > 0) throw new Error(`LIVE execution start blocked: ${missing.join(",")}`);
}

function parseMode(value: string | undefined): ExecutionModeV1 {
  const mode = value?.trim().toUpperCase() || "DRY_RUN";
  if (!(["OFF", "DRY_RUN", "PAPER", "LIVE"] as string[]).includes(mode)) throw new Error(`Invalid EXECUTION_MODE: ${mode}`);
  return mode as ExecutionModeV1;
}

function splitCsv(value: string | undefined): string[] {
  return [...new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean))].sort();
}

function parseInteger(value: string | undefined, fallback: number, name: string): number {
  const parsed = value === undefined || value.trim() === "" ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}
