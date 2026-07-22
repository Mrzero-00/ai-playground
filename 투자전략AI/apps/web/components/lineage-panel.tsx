export function LineagePanel({ dataAsOf, snapshots, models, resultHash }: { dataAsOf: string; snapshots: string[]; models: string[]; resultHash: string }) {
  return <aside className="lineage-panel" aria-labelledby="lineage-title">
    <div className="card-heading"><div><p className="eyebrow">TRACEABILITY</p><h2 id="lineage-title">데이터 계보</h2></div><span className="live-mark">Point-in-time</span></div>
    <dl className="lineage-list"><div><dt>Data as of</dt><dd>{dataAsOf}</dd></div><div><dt>Snapshots</dt><dd>{snapshots.join(", ")}</dd></div><div><dt>Models</dt><dd>{models.join(", ")}</dd></div><div><dt>Result hash</dt><dd className="hash">{resultHash}</dd></div></dl>
  </aside>;
}
