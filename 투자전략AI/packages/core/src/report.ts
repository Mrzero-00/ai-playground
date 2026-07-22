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
