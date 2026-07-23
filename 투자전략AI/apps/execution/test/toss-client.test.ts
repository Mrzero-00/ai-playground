import assert from "node:assert/strict";
import test from "node:test";
import type { BrokerOrderRequestV1 } from "@investment-os/core";
import { TossApiError, TossBrokerClientV1, TossOutcomeUnknownError } from "../src/toss-client.js";

const order: BrokerOrderRequestV1 = {
  accountId: "broker-account-7",
  clientOrderId: "io-12345678901234567890123456789012",
  symbol: "005930",
  side: "BUY",
  orderType: "LIMIT",
  timeInForce: "DAY",
  quantity: "1",
  price: "70000",
  confirmHighValueOrder: false,
};

function client(fetchImpl: typeof fetch): TossBrokerClientV1 {
  return new TossBrokerClientV1({ clientId: "client", clientSecret: "secret", accountId: "broker-account-7", accountSeq: "7", fetchImpl, now: () => 1_000 });
}

test("Toss client uses OAuth, account header and official idempotency field", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    if (String(input).endsWith("/oauth2/token")) return response({ access_token: "token", token_type: "Bearer", expires_in: 3600 });
    return response({ result: { orderId: "order-1", clientOrderId: order.clientOrderId } });
  };
  const result = await client(fetchImpl).createOrder(order);
  assert.equal(result.brokerOrderId, "order-1");
  assert.equal(calls.length, 2);
  const headers = new Headers(calls[1]!.init.headers);
  assert.equal(headers.get("authorization"), "Bearer token");
  assert.equal(headers.get("X-Tossinvest-Account"), "7");
  assert.equal(JSON.parse(String(calls[1]!.init.body)).clientOrderId, order.clientOrderId);
});

test("Toss token issuance is single-flight and cached", async () => {
  let tokenCalls = 0;
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).endsWith("/oauth2/token")) { tokenCalls += 1; return response({ access_token: "token", token_type: "Bearer", expires_in: 3600 }); }
    return response({ result: { currency: "KRW", cashBuyingPower: "100000" } });
  };
  const instance = client(fetchImpl);
  await Promise.all([instance.getBuyingPower("KRW"), instance.getBuyingPower("KRW")]);
  assert.equal(tokenCalls, 1);
});

test("Toss rate-limit error preserves normalized code, request id and retry delay", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).endsWith("/oauth2/token")) return response({ access_token: "token", token_type: "Bearer", expires_in: 3600 });
    return response({ error: { code: "rate-limit-exceeded", message: "slow down", requestId: "req-1" } }, 429, { "Retry-After": "2" });
  };
  await assert.rejects(client(fetchImpl).getBuyingPower("KRW"), (error: unknown) => {
    assert.ok(error instanceof TossApiError);
    assert.equal(error.code, "rate-limit-exceeded");
    assert.equal(error.requestId, "req-1");
    assert.equal(error.retryAfterSeconds, 2);
    return true;
  });
});

test("network, 5xx and unverifiable success during an order mutation are classified as unknown", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).endsWith("/oauth2/token")) return response({ access_token: "token", token_type: "Bearer", expires_in: 3600 });
    throw new Error("socket reset");
  };
  await assert.rejects(client(fetchImpl).createOrder(order), TossOutcomeUnknownError);

  const serverFailure: typeof fetch = async (input) => String(input).endsWith("/oauth2/token")
    ? response({ access_token: "token", token_type: "Bearer", expires_in: 3600 })
    : response({ error: { code: "internal-error" } }, 503);
  await assert.rejects(client(serverFailure).createOrder(order), TossOutcomeUnknownError);

  const invalidSuccess: typeof fetch = async (input) => String(input).endsWith("/oauth2/token")
    ? response({ access_token: "token", token_type: "Bearer", expires_in: 3600 })
    : new Response("not-json", { status: 200 });
  await assert.rejects(client(invalidSuccess).createOrder(order), TossOutcomeUnknownError);

  const missingOrderId: typeof fetch = async (input) => String(input).endsWith("/oauth2/token")
    ? response({ access_token: "token", token_type: "Bearer", expires_in: 3600 })
    : response({ result: {} });
  await assert.rejects(client(missingOrderId).createOrder(order), TossOutcomeUnknownError);
});

test("Toss preflight collector reads price, regular session, warnings, open orders and cash", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/oauth2/token") return response({ access_token: "token", token_type: "Bearer", expires_in: 3600 });
    if (url.pathname === "/api/v1/prices") return response({ result: [{ symbol: "005930", timestamp: "2026-07-23T00:04:59Z", lastPrice: "70100", currency: "KRW" }] });
    if (url.pathname === "/api/v1/market-calendar/KR") return response({ result: { today: { integrated: { regularMarket: { startTime: "2026-07-23T00:00:00Z", endTime: "2026-07-23T08:00:00Z" } } } } });
    if (url.pathname.endsWith("/warnings")) return response({ result: [] });
    if (url.pathname === "/api/v1/orders") return response({ result: { orders: [{ orderId: "open-1", symbol: "005930", side: "SELL", status: "PENDING" }], nextCursor: null, hasNext: false } });
    if (url.pathname === "/api/v1/buying-power") return response({ result: { currency: "KRW", cashBuyingPower: "500000" } });
    throw new Error(`unexpected ${url}`);
  };
  const instance = client(fetchImpl);
  const observation = await instance.collectPreflight({
    id: "intent", userId: "user", portfolioId: "portfolio", accountId: "broker-account-7", decisionId: "decision", proposalId: "proposal",
    riskDecisionId: "risk", portfolioSnapshotId: "snapshot", decisionStatus: "APPROVED", riskStatus: "ALLOW", approvedBy: "user",
    approvedAt: "2026-07-23T00:00:00Z", createdAt: "2026-07-23T00:01:00Z", expiresAt: "2026-07-23T01:00:00Z", dataAsOf: "2026-07-23T00:00:00Z",
    strategy: "CORE", symbol: "005930", market: "KR", side: "BUY", orderType: "LIMIT", timeInForce: "DAY", quantity: "1",
    limitPrice: "70000", approvedReferencePrice: "70000", approvedNotional: "70000", currency: "KRW", snapshotIds: ["snapshot"],
    policyVersionIds: ["policy"], status: "CREATED", idempotencyKey: "key", clientOrderId: "client-order", resultHash: "hash",
  }, "2026-07-23T00:05:00Z", true);
  assert.equal(observation.currentPrice, "70100");
  assert.equal(observation.priceAsOf, "2026-07-23T00:04:59Z");
  assert.equal(observation.marketOpen, true);
  assert.equal(observation.buyingPower, "500000");
  assert.equal(observation.existingOppositeOrder, true);
});

function response(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}
