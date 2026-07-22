import { StatusBadge } from "./status-badge";

type ReportSection = { kind: string; heading: string; statements: Array<{ id: string; kind: string; text: string; sourceIds: string[] }> };

export function ReportView({ title, status, recommendation, sections, dataAsOf }: { title: string; status: "READY" | "BLOCKED"; recommendation: string; sections: ReportSection[]; dataAsOf: string }) {
  return <article className="report-card" aria-labelledby="report-title">
    <div className="card-heading"><div><p className="eyebrow">CANONICAL REPORT · {dataAsOf}</p><h2 id="report-title">{title}</h2></div><StatusBadge status={status} tone={status === "READY" ? "positive" : "critical"} /></div>
    <div className="recommendation"><span>Priority recommendation</span><strong>{recommendation}</strong></div>
    {sections.map((section) => <section className="report-section" key={section.kind}><h3>{section.heading}</h3>{section.statements.length === 0 ? <p>없음</p> : <ul>{section.statements.map((statement) => <li key={statement.id}><span className="statement-kind">{statement.kind}</span>{statement.text}{statement.sourceIds.length > 0 && <small>Sources · {statement.sourceIds.join(", ")}</small>}</li>)}</ul>}</section>)}
  </article>;
}
