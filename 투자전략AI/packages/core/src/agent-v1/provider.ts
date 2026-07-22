import type { AgentOutputV1, AgentRunManifestV1 } from "./types.js";

export type AgentProviderRequestV1 = {
  manifest: AgentRunManifestV1;
  systemPolicy: string;
  task: string;
  evidence: Array<{ evidenceId: string; contentHash: string; payload: unknown }>;
  outputSchema: Record<string, unknown>;
};

export type AgentProviderResponseV1 = {
  providerRequestId: string;
  rawOutput: string;
  inputTokens?: number;
  outputTokens?: number;
  costMicros?: number;
  finishedAt: string;
};

export interface AgentProviderV1 {
  readonly id: string;
  readonly version: string;
  execute(input: AgentProviderRequestV1): Promise<AgentProviderResponseV1>;
}

export class ScriptedAgentProviderV1 implements AgentProviderV1 {
  readonly id = "scripted";
  readonly version = "1";
  constructor(private readonly output: AgentOutputV1, private readonly finishedAt: string) {}
  async execute(input: AgentProviderRequestV1): Promise<AgentProviderResponseV1> {
    if (input.manifest.providerId !== this.id || input.manifest.providerVersion !== this.version) throw new Error("Agent Provider Manifest conflict");
    return { providerRequestId: `scripted:${input.manifest.id}`, rawOutput: JSON.stringify(this.output), finishedAt: this.finishedAt };
  }
}

export function parseAgentProviderOutputV1(response: AgentProviderResponseV1, maximumBytes = 1_000_000): AgentOutputV1 {
  if (!response.providerRequestId.trim() || !Number.isFinite(new Date(response.finishedAt).getTime())) throw new Error("Agent Provider response metadata is invalid");
  if (Buffer.byteLength(response.rawOutput, "utf8") > maximumBytes) throw new Error("Agent Provider output exceeds maximum bytes");
  let parsed: unknown;
  try { parsed = JSON.parse(response.rawOutput); } catch { throw new Error("Agent Provider output is not valid JSON"); }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Agent Provider output must be a JSON object");
  return structuredClone(parsed as AgentOutputV1);
}
