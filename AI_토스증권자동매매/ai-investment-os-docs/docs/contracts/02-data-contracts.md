# Data Contracts

모든 구현은 아래 개념을 TypeScript 타입과 Zod 스키마로 정의해야 한다.

```ts
export type StrategyType = 'core' | 'momentum' | 'event';

export type SourceTier = 1 | 2 | 3 | 4;

export interface EvidenceRecord {
  id: string;
  symbol: string | null;
  sourceType:
    | 'sec'
    | 'ir'
    | 'news'
    | 'market'
    | 'options'
    | 'short_interest'
    | 'macro'
    | 'social';
  sourceTier: SourceTier;
  sourceUrl: string | null;
  publishedAt: string;
  receivedAt: string;
  validFrom: string;
  rawContentRef: string;
  contentHash: string;
  sourceReliability: number;
}

export interface MarketCandidate {
  symbol: string;
  observedAt: string;
  price: number;
  changePercent: number;
  relativeVolume: number;
  dollarVolume: number;
  marketCap: number | null;
  floatShares: number | null;
  spreadPercent: number | null;
  premarketGapPercent: number | null;
  discoveryReasons: string[];
}

export interface EvidenceBundle {
  symbol: string;
  asOf: string;
  evidence: EvidenceRecord[];
  marketSnapshot: Record<string, unknown>;
  fundamentals: Record<string, unknown>;
  riskSignals: string[];
}

export interface InvestmentThesis {
  symbol: string;
  strategy: StrategyType;
  thesisScore: number;
  confidence: number;
  futureValueDrivers: string[];
  assumptions: string[];
  invalidationConditions: string[];
  dilutionRisks: string[];
  hiddenRisks: string[];
  impactWindow: 'intraday' | 'days' | 'weeks' | 'months' | 'years';
}

export interface CommitteeResult {
  bullScore: number;
  bearScore: number;
  marketScore: number;
  evidenceQuality: number;
  agreementScore: number;
  uncertaintyScore: number;
  unresolvedConflicts: string[];
}

export interface EntryPlan {
  symbol: string;
  entryType:
    | 'limit_pullback'
    | 'breakout'
    | 'vwap_reclaim'
    | 'opening_range'
    | 'no_entry';
  entryMin: number | null;
  entryMax: number | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
  timeStopMinutes: number | null;
  expiresAt: string;
}

export interface RiskDecision {
  approved: boolean;
  maxPositionSize: number;
  maxLossAmount: number;
  rejectionReasons: string[];
}

export interface TradeEvaluation {
  tradeId: string;
  profitable: boolean;
  thesisCorrect: boolean;
  executionCorrect: boolean;
  riskControlCorrect: boolean;
  thesisQuality: number;
  timingQuality: number;
  executionQuality: number;
  riskQuality: number;
  outcomeType:
    | 'good_thesis_good_execution'
    | 'good_thesis_bad_execution'
    | 'bad_thesis_good_execution'
    | 'bad_thesis_lucky_profit'
    | 'good_process_bad_outcome'
    | 'bad_process_good_outcome';
  lessons: string[];
}
```

## 계약 원칙

- 날짜는 ISO 8601 UTC 문자열
- 점수 범위는 Zod로 검증
- 외부 API 원본은 정규화 전에 보존
- `asOf` 이후 공개된 자료를 Bundle에 넣지 않음
- 금액 단위와 통화를 명시
- nullable 값과 누락 값을 구분
