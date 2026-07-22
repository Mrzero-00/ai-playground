"use client";

import { useMemo, useState } from "react";
import { deriveApprovalViewModel, type DecisionContract } from "../lib/view-model";
import { mapApiErrorToUi } from "../lib/error-map";
import { StatusBadge } from "./status-badge";

export function DecisionPanel({ decisionId, contract, approveEndpoint }: { decisionId: string; contract: DecisionContract; approveEndpoint?: string }) {
  const view = useMemo(() => deriveApprovalViewModel(contract), [contract]);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(view.reason);

  async function approve() {
    if (!approveEndpoint || !view.canApprove || !confirmed || submitting) return;
    setSubmitting(true);
    setMessage("서버에서 만료·가격·Portfolio·Risk를 다시 검증하고 있습니다.");
    try {
      const response = await fetch(approveEndpoint, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ decidedAt: new Date().toISOString(), actorId: "current-user" }) });
      const payload = await response.json() as { error?: { code?: string } };
      if (!response.ok) { const error = mapApiErrorToUi(payload.error?.code ?? "UNKNOWN"); setMessage(`${error.title}. ${error.recovery}`); return; }
      setMessage("승인 기록이 저장되었습니다. 자동 주문은 실행되지 않습니다.");
    } catch { setMessage("네트워크 오류입니다. 서버 상태를 다시 확인한 뒤 재시도하세요."); }
    finally { setSubmitting(false); }
  }

  return <section className="decision-panel" aria-labelledby="decision-title">
    <div className="card-heading"><div><p className="eyebrow">DECISION · {decisionId}</p><h2 id="decision-title">사용자 승인</h2></div><StatusBadge status={view.status} tone={view.status === "READY" ? "positive" : view.status === "REVIEW" ? "caution" : "critical"} /></div>
    <p className="decision-message" aria-live="polite">{message}</p>
    <label className="confirm-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={!view.canApprove || submitting} /><span>대상·전략·금액·만료·Risk 상태를 확인했습니다.</span></label>
    <div className="action-row"><button className="button button-primary" disabled={!view.canApprove || !confirmed || submitting || !approveEndpoint} onClick={approve}>{submitting ? "재검증 중…" : "검토한 제안 승인"}</button><button className="button button-secondary" disabled={!view.canReject || submitting}>거부</button></div>
    {!approveEndpoint && <p className="microcopy">개발 Preview에서는 승인 API를 호출하지 않습니다.</p>}
  </section>;
}
