import { toScoreViewModel, type ScoreContract } from "../lib/view-model";
import { StatusBadge } from "./status-badge";

export function ScoreCard({ title, score, strategy }: { title: string; score: ScoreContract; strategy: "long-term" | "momentum" }) {
  const view = toScoreViewModel(score);
  const tone = view.status === "SCORED" ? "positive" : view.status === "BLOCKED" ? "critical" : "caution";
  return <article className={`score-card strategy-${strategy}`}>
    <div className="card-heading"><div><p className="eyebrow">{strategy === "long-term" ? "LONG-TERM" : "MOMENTUM"}</p><h3>{title}</h3></div><StatusBadge status={view.status} tone={tone} /></div>
    <div className="score-grid">
      <div><span className="metric-label">Score</span><strong>{view.scoreLabel}</strong>{view.rangeLabel && <small>Range {view.rangeLabel}</small>}</div>
      <div><span className="metric-label">Confidence</span><strong className="confidence">{view.confidenceLabel}</strong><small>Score와 별도 평가</small></div>
    </div>
    {view.blockerCodes.length > 0 && <ul className="reason-list">{view.blockerCodes.map((code) => <li key={code}>{code}</li>)}</ul>}
  </article>;
}
