import { useState } from 'react';
import type { FoundLetter, UserLetter } from '../types';

interface LettersScreenProps {
  sentLetters: UserLetter[];
  foundLetters: FoundLetter[];
  onOpenFound: (letter: FoundLetter) => void;
}

const statusText: Record<UserLetter['status'], string> = {
  DRIFTING: '한강을 따라 표류 중',
  LANDED: '공원에 도착',
  RELOCATING: '다른 공원으로 이동 중',
  CLAIMED: '누군가 발견했어요',
  EXPIRED: '한강으로 돌아갔어요',
  HIDDEN: '운영 검토 중',
};

export function LettersScreen({ sentLetters, foundLetters, onOpenFound }: LettersScreenProps) {
  const [tab, setTab] = useState<'sent' | 'found'>('sent');

  return (
    <main className="screen letters-screen">
      <header className="page-header">
        <p className="eyebrow">나의 기록</p>
        <h1>내 편지</h1>
      </header>
      <div className="segmented-control" role="tablist">
        <button className={tab === 'sent' ? 'active' : ''} onClick={() => setTab('sent')}>띄운 편지 <span>{sentLetters.length}</span></button>
        <button className={tab === 'found' ? 'active' : ''} onClick={() => setTab('found')}>주운 편지 <span>{foundLetters.length}</span></button>
      </div>

      {tab === 'sent' ? (
        <section className="letter-list">
          {sentLetters.length === 0 ? (
            <EmptyLetters text="아직 띄운 편지가 없어요" detail="마음을 적어 한강에 천천히 흘려보내 보세요." />
          ) : sentLetters.map((letter) => (
            <article className="letter-list-item" key={letter.id}>
              <div className={`status-orb status-orb--${letter.status.toLowerCase()}`}>✉</div>
              <div className="letter-list-item__content">
                <div className="letter-list-item__meta">
                  <span className="status-label">{statusText[letter.status]}</span>
                  <time>{formatDate(letter.createdAt)}</time>
                </div>
                <p>{letter.bodyPreview}</p>
                <div className="letter-list-item__footer">
                  {letter.moodTag && <span>#{letter.moodTag}</span>}
                  {letter.parkName && <span>{letter.parkName}</span>}
                  {letter.landingSequence > 1 && <span>{letter.landingSequence}번째 공원</span>}
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="letter-list found-list">
          {foundLetters.length === 0 ? (
            <EmptyLetters text="아직 주운 편지가 없어요" detail="한강공원에서 낯선 누군가의 마음을 발견해 보세요." />
          ) : foundLetters.map((letter) => (
            <button className="found-letter-card" key={letter.id} onClick={() => onOpenFound(letter)}>
              <span className="found-letter-card__seal">✉</span>
              <div>
                <p>{letter.body.slice(0, 56)}{letter.body.length > 56 ? '…' : ''}</p>
                <span>{letter.parkName} · {formatDate(letter.claimedAt)}</span>
              </div>
              <b>›</b>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}

function EmptyLetters({ text, detail }: { text: string; detail: string }) {
  return <div className="empty-letters"><div>✉</div><strong>{text}</strong><p>{detail}</p></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value));
}
