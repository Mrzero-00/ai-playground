export function StatusBadge({ status, tone = "info" }: { status: string; tone?: "positive" | "caution" | "critical" | "info" }) {
  return <span className={`status-badge status-${tone}`} aria-label={`상태: ${status}`}><span aria-hidden="true" className="status-dot" />{status}</span>;
}
