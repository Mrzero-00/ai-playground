# Provider Interfaces

외부 공급자를 교체할 수 있도록 인터페이스를 먼저 정의한다.

```ts
export interface MarketDataProvider {
  scanMarket(asOf: Date): Promise<MarketCandidate[]>;
  getQuote(symbol: string, asOf: Date): Promise<unknown>;
  getBars(symbol: string, asOf: Date): Promise<unknown[]>;
}

export interface NewsProvider {
  getRecentNews(symbol: string, asOf: Date): Promise<EvidenceRecord[]>;
}

export interface FilingProvider {
  getRecentFilings(symbol: string, asOf: Date): Promise<EvidenceRecord[]>;
}

export interface FundamentalsProvider {
  getSnapshot(symbol: string, asOf: Date): Promise<Record<string, unknown>>;
}

export interface OptionsProvider {
  getOptionsActivity(symbol: string, asOf: Date): Promise<Record<string, unknown>>;
}

export interface BrokerProvider {
  submitOrder(input: unknown): Promise<unknown>;
  cancelOrder(orderId: string): Promise<void>;
  getOrder(orderId: string): Promise<unknown>;
  getPositions(): Promise<unknown[]>;
}
```

Phase 1에서는 모두 Mock Provider로 구현한다.
실제 공급자별 변환 코드는 각 Adapter 내부에만 존재해야 한다.
