import assert from "node:assert/strict";
import test from "node:test";
import { loadExecutionRuntimeConfig } from "../src/runtime-config.js";

const token = "0123456789abcdef";

test("execution runtime defaults to isolated dry run", () => {
  const config = loadExecutionRuntimeConfig({ EXECUTION_SERVICE_TOKEN: token });
  assert.equal(config.runtimeGate.mode, "DRY_RUN");
  assert.equal(config.runtimeGate.autoTradingEnabled, false);
  assert.equal(config.runtimeGate.killSwitchOpen, false);
  assert.equal(config.host, "127.0.0.1");
});

test("execution runtime rejects missing or weak service authentication", () => {
  assert.throws(() => loadExecutionRuntimeConfig({}), /SERVICE_TOKEN is required/);
  assert.throws(() => loadExecutionRuntimeConfig({ EXECUTION_SERVICE_TOKEN: "short" }), /at least 16/);
});

test("live start fails closed when any independent release gate is missing", () => {
  assert.throws(() => loadExecutionRuntimeConfig({ EXECUTION_SERVICE_TOKEN: token, EXECUTION_MODE: "LIVE" }), /LIVE execution start blocked/);
});

test("R1 foundation hard-blocks live even when environment gates claim ready", () => {
  assert.throws(() => loadExecutionRuntimeConfig({
    EXECUTION_SERVICE_TOKEN: token,
    EXECUTION_MODE: "LIVE",
    AUTO_TRADING_ENABLED: "true",
    LIVE_TRADING_ACK: "I_UNDERSTAND_LIVE_TRADING_RISK",
    EXECUTION_RELEASE_EVIDENCE_VERIFIED: "true",
    EXECUTION_RELEASE_EVIDENCE_ID: "release-1",
    EXECUTION_ALLOWED_ACCOUNTS: "1,2",
    EXECUTION_KILL_SWITCH_OPEN: "false",
    EXECUTION_RECONCILIATION_HEALTHY: "true",
    TOSS_CLIENT_ID: "client",
    TOSS_CLIENT_SECRET: "secret",
    TOSS_ACCOUNT_ID: "broker-account-2",
    TOSS_ACCOUNT_SEQ: "2",
  }), /R1_AUTHORITATIVE_EXECUTION_LEDGER_NOT_AVAILABLE/);
});
