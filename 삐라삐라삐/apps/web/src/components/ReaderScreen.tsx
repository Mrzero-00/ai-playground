import { useState } from 'react';
import type { FoundFlyer } from '../types';

interface ReaderScreenProps { flyer: FoundFlyer; onBack: () => void; onReport: (flyerId: string, reason: string) => Promise<void> }

export function ReaderScreen({ flyer, onBack, onReport }: ReaderScreenProps) {
  const [reporting, setReporting] = useState(false);
  const report = async () => {
    const reason = window.prompt('신고 사유를 간단히 적어 주세요.');
    if (!reason) return;
    setReporting(true);
    try { await onReport(flyer.id, reason); } finally { setReporting(false); }
  };
  return (
    <main className="screen reader-screen ppira-reader">
      <header className="top-bar"><button className="back-button" onClick={onBack}>‹</button><h1>주운 삐라</h1><button className="text-button" disabled={reporting} onClick={() => void report()}>신고</button></header>
      <section className="reader-arrival"><div className="reader-seal">▧</div><p>{flyer.regionName}에서</p><strong>당신이 발견한 익명 편지예요</strong><time>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(new Date(flyer.claimedAt))}</time></section>
      <article className="opened-letter ppira-opened"><div className="opened-letter__tape" />{flyer.moodTag && <span className="opened-letter__mood">#{flyer.moodTag}</span>}<p>{flyer.body}</p><footer>{flyer.regionName}로 날려 보낸, 이름 모를 누군가로부터</footer></article>
      <aside className="no-reply-note"><span>↝</span><div><strong>지금은 답장을 보낼 수 없어요</strong><p>이 삐라는 한 번의 우연한 만남으로 완성돼요.</p></div></aside>
      <button className="primary-button" onClick={onBack}>삐라를 간직하기</button>
    </main>
  );
}
