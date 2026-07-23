import type {
  AutomatedExecutionIntentV1,
  BrokerOrderRequestV1,
  BrokerOrderV1,
  BrokerPortV1,
  ExecutionPreflightObservationV1,
} from "@investment-os/core";

const TOSS_BASE_URL = "https://openapi.tossinvest.com";

type TossEnvelope<T> = { result: T };
type TossToken = { access_token: string; token_type: string; expires_in: number };
type TossOrder = {
  orderId: string;
  clientOrderId?: string | null;
  symbol: string;
  side: string;
  status: string;
  [key: string]: unknown;
};
type TossOrderPage = { orders: TossOrder[]; nextCursor: string | null; hasNext: boolean };
type TossPrice = { symbol: string; timestamp?: string | null; lastPrice: string; currency: string };
type TossSession = { startTime: string; endTime: string };
type TossCalendar = { today?: { integrated?: { regularMarket?: TossSession | null } | null; regularMarket?: TossSession | null } | null };
type TossWarning = { warningType: string; [key: string]: unknown };

export class TossApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId: string | undefined,
    readonly retryAfterSeconds: number | undefined,
  ) { super(message); this.name = "TossApiError"; }
}

export class TossOutcomeUnknownError extends Error {
  readonly outcomeUnknown = true;

  constructor(message: string) {
    super(message);
    this.name = "TossOutcomeUnknownError";
  }
}

export class TossBrokerClientV1 implements BrokerPortV1 {
  private token: { value: string; expiresAt: number } | undefined;
  private tokenRequest: Promise<string> | undefined;

  constructor(private readonly options: {
    clientId: string;
    clientSecret: string;
    accountId: string;
    accountSeq: string;
    fetchImpl?: typeof fetch;
    now?: () => number;
  }) {
    if (!options.clientId.trim() || !options.clientSecret.trim() || !options.accountId.trim() || !options.accountSeq.trim()) throw new Error("Toss credentials, accountId and accountSeq are required");
  }

  async createOrder(order: BrokerOrderRequestV1): Promise<BrokerOrderV1> {
    this.assertAccount(order.accountId);
    const body = {
      clientOrderId: order.clientOrderId,
      symbol: order.symbol,
      side: order.side,
      orderType: order.orderType,
      timeInForce: order.timeInForce,
      ...(order.quantity === undefined ? {} : { quantity: order.quantity }),
      ...(order.orderAmount === undefined ? {} : { orderAmount: order.orderAmount }),
      ...(order.price === undefined ? {} : { price: order.price }),
      confirmHighValueOrder: order.confirmHighValueOrder,
    };
    const response = await this.request<TossEnvelope<{ orderId: string; clientOrderId?: string | null }>>(
      "/api/v1/orders", { method: "POST", body: JSON.stringify(body) }, true, true,
    );
    const orderId = response.result?.orderId;
    if (!orderId?.trim()) throw new TossOutcomeUnknownError("Toss accepted an order request without a verifiable orderId");
    return normalizeOrder(orderId, response.result.clientOrderId ?? undefined, "PENDING", response.result);
  }

  async getOrder(accountId: string, brokerOrderId: string): Promise<BrokerOrderV1> {
    this.assertAccount(accountId);
    const response = await this.request<TossEnvelope<TossOrder>>(`/api/v1/orders/${encodeURIComponent(brokerOrderId)}`, {}, true, false);
    return normalizeOrder(response.result.orderId, response.result.clientOrderId ?? undefined, response.result.status, response.result);
  }

  async cancelOrder(accountId: string, brokerOrderId: string): Promise<BrokerOrderV1> {
    this.assertAccount(accountId);
    const response = await this.request<TossEnvelope<{ orderId: string }>>(
      `/api/v1/orders/${encodeURIComponent(brokerOrderId)}/cancel`, { method: "POST", body: "{}" }, true, true,
    );
    const orderId = response.result?.orderId;
    if (!orderId?.trim()) throw new TossOutcomeUnknownError("Toss accepted a cancel request without a verifiable orderId");
    return normalizeOrder(orderId, undefined, "PENDING_CANCEL", response.result);
  }

  async modifyOrder(accountId: string, brokerOrderId: string, change: { price?: string; quantity?: string }): Promise<BrokerOrderV1> {
    this.assertAccount(accountId);
    const response = await this.request<TossEnvelope<{ orderId: string }>>(
      `/api/v1/orders/${encodeURIComponent(brokerOrderId)}/modify`, { method: "POST", body: JSON.stringify(change) }, true, true,
    );
    const orderId = response.result?.orderId;
    if (!orderId?.trim()) throw new TossOutcomeUnknownError("Toss accepted a modify request without a verifiable orderId");
    return normalizeOrder(orderId, undefined, "PENDING_REPLACE", response.result);
  }

  async getAccounts(): Promise<unknown[]> {
    return (await this.request<TossEnvelope<unknown[]>>("/api/v1/accounts", {}, false, false)).result;
  }

  async getHoldings(accountId = this.options.accountId): Promise<unknown> {
    this.assertAccount(accountId);
    return (await this.request<TossEnvelope<unknown>>("/api/v1/holdings", {}, true, false)).result;
  }

  async getCurrentPrice(symbol: string): Promise<TossPrice> {
    const response = await this.request<TossEnvelope<TossPrice[]>>(`/api/v1/prices?symbols=${encodeURIComponent(symbol)}`, {}, false, false);
    const price = response.result.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase());
    if (!price) throw new Error(`Toss price missing for ${symbol}`);
    return price;
  }

  async getBuyingPower(currency: "KRW" | "USD"): Promise<string> {
    const response = await this.request<TossEnvelope<{ currency: string; cashBuyingPower: string }>>(
      `/api/v1/buying-power?currency=${currency}`, {}, true, false,
    );
    return response.result.cashBuyingPower;
  }

  async getSellableQuantity(symbol: string): Promise<string> {
    const response = await this.request<TossEnvelope<{ sellableQuantity: string }>>(
      `/api/v1/sellable-quantity?symbol=${encodeURIComponent(symbol)}`, {}, true, false,
    );
    return response.result.sellableQuantity;
  }

  async getOpenOrders(symbol?: string): Promise<TossOrder[]> {
    const query = new URLSearchParams({ status: "OPEN" });
    if (symbol) query.set("symbol", symbol);
    return (await this.request<TossEnvelope<TossOrderPage>>(`/api/v1/orders?${query}`, {}, true, false)).result.orders;
  }

  async getStockWarnings(symbol: string): Promise<TossWarning[]> {
    return (await this.request<TossEnvelope<TossWarning[]>>(`/api/v1/stocks/${encodeURIComponent(symbol)}/warnings`, {}, false, false)).result;
  }

  async isRegularMarketOpen(market: "KR" | "US", checkedAt: string): Promise<boolean> {
    const date = marketDate(market, checkedAt);
    const response = await this.request<TossEnvelope<TossCalendar>>(`/api/v1/market-calendar/${market}?date=${date}`, {}, false, false);
    const session = market === "KR" ? response.result.today?.integrated?.regularMarket : response.result.today?.regularMarket;
    if (!session) return false;
    const now = Date.parse(checkedAt);
    const start = Date.parse(session.startTime);
    const end = Date.parse(session.endTime);
    return Number.isFinite(now) && Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
  }

  async collectPreflight(
    intent: AutomatedExecutionIntentV1,
    checkedAt: string,
    reconciliationHealthy: boolean,
  ): Promise<ExecutionPreflightObservationV1> {
    this.assertAccount(intent.accountId);
    const [price, marketOpen, warnings, openOrders, capacity] = await Promise.all([
      this.getCurrentPrice(intent.symbol),
      this.isRegularMarketOpen(intent.market, checkedAt),
      this.getStockWarnings(intent.symbol),
      this.getOpenOrders(intent.symbol),
      intent.side === "BUY" ? this.getBuyingPower(intent.currency as "KRW" | "USD") : this.getSellableQuantity(intent.symbol),
    ]);
    const existingOppositeOrder = openOrders.some((order) => order.symbol.toUpperCase() === intent.symbol && order.side.toUpperCase() !== intent.side);
    if (!price.timestamp) throw new Error(`Toss price timestamp missing for ${intent.symbol}`);
    if (price.currency !== intent.currency) throw new Error(`Toss price currency mismatch for ${intent.symbol}`);
    return {
      checkedAt,
      currentPrice: price.lastPrice,
      priceAsOf: price.timestamp,
      marketOpen,
      stockRestricted: warnings.length > 0,
      ...(intent.side === "BUY" ? { buyingPower: capacity } : { sellableQuantity: capacity }),
      existingOppositeOrder,
      reconciliationHealthy,
    };
  }

  private async request<T>(path: string, init: RequestInit, account: boolean, outcomeSensitive: boolean, refreshed = false): Promise<T> {
    const token = await this.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    headers.set("authorization", `Bearer ${token}`);
    if (account) headers.set("X-Tossinvest-Account", this.options.accountSeq);
    if (init.body !== undefined) headers.set("content-type", "application/json");
    let response: Response;
    try { response = await this.fetchImpl()(new URL(path, TOSS_BASE_URL), { ...init, headers }); }
    catch (error) {
      if (outcomeSensitive) throw new TossOutcomeUnknownError(`Toss order outcome is unknown: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
    if (response.status === 401 && !refreshed) {
      this.token = undefined;
      return this.request<T>(path, init, account, outcomeSensitive, true);
    }
    let payload: unknown;
    try { payload = await parseJson(response); }
    catch (error) {
      if (outcomeSensitive && (response.ok || response.status === 408 || response.status >= 500)) {
        throw new TossOutcomeUnknownError(`Toss mutation response could not be verified: ${error instanceof Error ? error.message : String(error)}`);
      }
      throw error;
    }
    if (!response.ok) {
      if (outcomeSensitive && (response.status === 408 || response.status >= 500)) {
        throw new TossOutcomeUnknownError(`Toss mutation returned an uncertain HTTP ${response.status} outcome`);
      }
      const envelope = payload as { error?: { code?: string; message?: string; requestId?: string } };
      throw new TossApiError(
        envelope.error?.message ?? `Toss API request failed with ${response.status}`,
        response.status,
        envelope.error?.code ?? "unknown-error",
        envelope.error?.requestId ?? response.headers.get("X-Request-Id") ?? undefined,
        parseRetryAfter(response.headers.get("Retry-After")),
      );
    }
    return payload as T;
  }

  private async getAccessToken(): Promise<string> {
    const now = this.now()();
    if (this.token && this.token.expiresAt - 30_000 > now) return this.token.value;
    if (this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = this.issueToken();
    try { return await this.tokenRequest; }
    finally { this.tokenRequest = undefined; }
  }

  private async issueToken(): Promise<string> {
    const body = new URLSearchParams({ grant_type: "client_credentials", client_id: this.options.clientId, client_secret: this.options.clientSecret });
    const response = await this.fetchImpl()(new URL("/oauth2/token", TOSS_BASE_URL), {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body,
    });
    const payload = await parseJson(response);
    if (!response.ok) throw new TossApiError(`Toss OAuth failed with ${response.status}`, response.status, "oauth-failed", undefined, undefined);
    const token = payload as TossToken;
    if (!token.access_token || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new Error("Toss OAuth response is invalid");
    this.token = { value: token.access_token, expiresAt: this.now()() + token.expires_in * 1_000 };
    return token.access_token;
  }

  private assertAccount(accountId: string): void {
    if (accountId !== this.options.accountId) throw new Error("Toss account is not allowed for this client");
  }

  private fetchImpl(): typeof fetch { return this.options.fetchImpl ?? fetch; }
  private now(): () => number { return this.options.now ?? Date.now; }
}

function normalizeOrder(brokerOrderId: string, clientOrderId: string | undefined, status: string, raw: unknown): BrokerOrderV1 {
  if (!brokerOrderId?.trim()) throw new Error("Toss order response is missing orderId");
  return { brokerOrderId, ...(clientOrderId === undefined ? {} : { clientOrderId }), status, raw };
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { throw new Error(`Toss API returned invalid JSON (${response.status})`); }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function marketDate(market: "KR" | "US", checkedAt: string): string {
  const date = new Date(checkedAt);
  if (!Number.isFinite(date.getTime())) throw new Error("Toss market calendar checkedAt is invalid");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: market === "KR" ? "Asia/Seoul" : "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
