export type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "PARTIAL" | "CANCELLED";

export type JobFailure = { component: string; code: string; retryable: boolean };

export type AnalysisJob = {
  id: string;
  type: "DATA_INGESTION" | "LONG_TERM_REVIEW" | "MOMENTUM_SCAN" | "REPORT" | "REPLAY";
  correlationId: string;
  idempotencyKey: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  failures: JobFailure[];
  attempt: number;
};

export function startJob(job: AnalysisJob, at: string): AnalysisJob {
  if (job.status !== "PENDING") throw new Error("only pending jobs can start");
  return { ...job, status: "RUNNING", startedAt: at, attempt: job.attempt + 1 };
}

export function finishJob(job: AnalysisJob, input: { at: string; failures?: JobFailure[] }): AnalysisJob {
  if (job.status !== "RUNNING") throw new Error("only running jobs can finish");
  const failures = input.failures ?? [];
  return {
    ...job,
    status: failures.length === 0 ? "SUCCEEDED" : "PARTIAL",
    finishedAt: input.at,
    failures: structuredClone(failures),
  };
}

export function failJob(job: AnalysisJob, at: string, failure: JobFailure): AnalysisJob {
  if (job.status !== "RUNNING") throw new Error("only running jobs can fail");
  return { ...job, status: "FAILED", finishedAt: at, failures: [structuredClone(failure)] };
}

export function resolveIdempotentJob(candidate: AnalysisJob, existing: AnalysisJob[]): { job: AnalysisJob; reused: boolean } {
  if (!candidate.idempotencyKey.trim() || !candidate.correlationId.trim()) throw new Error("job correlationId and idempotencyKey are required");
  const match = existing.find((job) => job.idempotencyKey === candidate.idempotencyKey);
  if (!match) return { job: candidate, reused: false };
  if (match.type !== candidate.type) throw new Error("idempotency key conflicts with another job type");
  if (match.status === "SUCCEEDED" || match.status === "RUNNING" || match.status === "PENDING") return { job: match, reused: true };
  return { job: candidate, reused: false };
}
