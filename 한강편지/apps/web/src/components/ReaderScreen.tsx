import { useState } from 'react';
import type { FoundLetter } from '../types';

interface ReaderScreenProps {
  letter: FoundLetter;
  onBack: () => void;
  onReport: (letterId: string, reason: string) => Promise<void>;
}

export function ReaderScreen({ letter, onBack, onReport }: ReaderScreenProps) {
  const [reporting, setReporting] = useState(false);

  const report = async () => {
    const reason = window.prompt('신고 사유를 간단히 적어 주세요.');
    if (!reason) return;
    setReporting(true);
    try {
      await onReport(letter.id, reason);
    } finally {
      setReporting(false);
    }
  };

  return (
    <main className="screen reader-screen">
      <header className="top-bar">
        <button className="back-button" onClick={onBack} aria-label="뒤로 가기">‹</button>
        <h1>주운 편지</h1>
        <button className="text-button" disabled={reporting} onClick={() => void report()}>신고</button>
      </header>
      <section className="reader-arrival">
        <div className="reader-seal">✉</div>
        <p>{letter.parkName}에서</p>
        <strong>당신에게 도착한 편지예요</strong>
        <time>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(new Date(letter.claimedAt))}</time>
      </section>
      <article className="opened-letter">
        <div className="opened-letter__tape" />
        {letter.moodTag && <span className="opened-letter__mood">#{letter.moodTag}</span>}
        <p>{letter.body}</p>
        <footer>한강을 따라 온, 이름 모를 누군가로부터</footer>
      </article>
      <aside className="no-reply-note"><span>↝</span><div><strong>지금은 답장을 보낼 수 없어요</strong><p>이 편지는 한 번의 우연한 만남으로 완성돼요.</p></div></aside>
      <button className="primary-button" onClick={onBack}>편지를 간직하기</button>
    </main>
  );
}
