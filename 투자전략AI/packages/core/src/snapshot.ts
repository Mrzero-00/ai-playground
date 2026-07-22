export type DataConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";

export type DataSnapshot<T = unknown> = {
  id: string;
  companyId: string;
  kind: "MARKET" | "FINANCIAL" | "NEWS" | "INDUSTRY";
  asOf: string;
  collectedAt: string;
  sourceId: string;
  sourceUrl?: string;
  confidence: DataConfidence;
  complete: boolean;
  anomalyFlags: string[];
  data: T;
};

export type SnapshotInspection = {
  confidence: DataConfidence;
  staleData: boolean;
  complete: boolean;
  anomalyFlags: string[];
  asOf: string;
  collectedAt: string;
  sourceId: string;
  sourceUrl?: string;
  ageMinutes: number;
};

export function inspectSnapshot(snapshot: DataSnapshot, now: string, maxAgeMinutes: number): SnapshotInspection {
  const age = new Date(now).getTime() - new Date(snapshot.asOf).getTime();
  if (!Number.isFinite(age) || age < 0) throw new Error("snapshot dates are invalid");
  const ageMinutes = age / 60_000;
  return {
    confidence: snapshot.confidence,
    staleData: ageMinutes > maxAgeMinutes,
    complete: snapshot.complete,
    anomalyFlags: [...snapshot.anomalyFlags],
    asOf: snapshot.asOf,
    collectedAt: snapshot.collectedAt,
    sourceId: snapshot.sourceId,
    ...(snapshot.sourceUrl === undefined ? {} : { sourceUrl: snapshot.sourceUrl }),
    ageMinutes,
  };
}
