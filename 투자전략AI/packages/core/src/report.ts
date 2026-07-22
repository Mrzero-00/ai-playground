export type ReportInput = {
  id: string;
  type: "DAILY_MOMENTUM" | "WEEKLY_OS" | "MONTHLY_ALLOCATION" | "QUARTERLY_LONG_TERM" | "TRADE_REVIEW" | "MODEL_EVOLUTION";
  generatedAt: string;
  title: string;
  sections: Array<{ heading: string; body: string; evidenceIds: string[] }>;
  modelVersionIds: string[];
};

export type GeneratedReport = ReportInput & { markdown: string };

export function generateMarkdownReport(input: ReportInput): GeneratedReport {
  if (input.sections.length === 0) throw new Error("report requires at least one section");
  const sections = input.sections.map((section) => {
    const evidence = section.evidenceIds.length ? `\n\nEvidence: ${section.evidenceIds.map((id) => `\`${id}\``).join(", ")}` : "";
    return `## ${section.heading}\n\n${section.body}${evidence}`;
  });
  const markdown = `# ${input.title}\n\nGenerated: ${input.generatedAt}\n\n${sections.join("\n\n")}`;
  return { ...input, markdown };
}

export type DecisionReportInput = {
  id: string;
  type: ReportInput["type"];
  generatedAt: string;
  dataAsOf: string;
  title: string;
  conclusion: string;
  changes: string[];
  facts: string[];
  estimates: string[];
  interpretations: string[];
  recommendation: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  counterEvidence: string[];
  risks: string[];
  actions: string[];
  nextReviewConditions: string[];
  evidenceIds: string[];
  modelVersionIds: string[];
};

export type GeneratedDecisionReport = DecisionReportInput & { markdown: string };

export function generateDecisionReport(input: DecisionReportInput): GeneratedDecisionReport {
  if (!input.id.trim() || !input.title.trim() || !input.conclusion.trim() || !input.recommendation.trim()) {
    throw new Error("decision report requires identity, title, conclusion and one recommendation");
  }
  const generatedAt = new Date(input.generatedAt).getTime();
  const dataAsOf = new Date(input.dataAsOf).getTime();
  if (!Number.isFinite(generatedAt) || !Number.isFinite(dataAsOf) || dataAsOf > generatedAt) {
    throw new Error("decision report requires valid point-in-time dates");
  }
  if (input.facts.length === 0 || input.counterEvidence.length === 0 || input.risks.length === 0) {
    throw new Error("decision report requires facts, counter evidence and risks");
  }
  if (input.actions.length === 0 || input.nextReviewConditions.length === 0) {
    throw new Error("decision report requires actions and next review conditions");
  }
  if (input.evidenceIds.length === 0 || input.modelVersionIds.length === 0) {
    throw new Error("decision report requires evidence and model versions");
  }
  const section = (heading: string, values: string[]) => `## ${heading}\n\n${values.map((value) => `- ${value}`).join("\n")}`;
  const markdown = [
    `# ${input.title}`,
    `Generated: ${input.generatedAt}\nData as of: ${input.dataAsOf}\nConfidence: ${input.confidence}`,
    section("Conclusion", [input.conclusion]),
    section("Changes", input.changes.length ? input.changes : ["No material change"]),
    section("Facts", input.facts),
    section("Estimates", input.estimates.length ? input.estimates : ["None"]),
    section("Interpretations", input.interpretations.length ? input.interpretations : ["None"]),
    section("Counter Evidence", input.counterEvidence),
    section("Risks", input.risks),
    section("Priority Recommendation", [input.recommendation]),
    section("Actions", input.actions),
    section("Next Review", input.nextReviewConditions),
    section("Evidence", input.evidenceIds.map((id) => `\`${id}\``)),
    section("Model Versions", input.modelVersionIds.map((id) => `\`${id}\``)),
  ].join("\n\n");
  return { ...structuredClone(input), markdown };
}
