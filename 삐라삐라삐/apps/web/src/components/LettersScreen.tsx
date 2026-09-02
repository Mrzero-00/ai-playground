import { useState } from 'react';
import type { FoundFlyer, UserFlyer } from '../types';

interface LettersScreenProps { sentFlyers: UserFlyer[]; foundFlyers: FoundFlyer[]; onOpenFound: (flyer: FoundFlyer) => void }

const statusText: Record<UserFlyer['status'], string> = {
  FLYING: '바람을 타고 날아가는 중', LANDED: '선택한 지역에 내려앉음', RELOCATING: '지역 안에서 이동 중',
  CLAIMED: '누군가 발견했어요', EXPIRED: '바람 속으로 사라졌어요', HIDDEN: '운영 검토 중',
};

export function LettersScreen({ sentFlyers, foundFlyers, onOpenFound }: LettersScreenProps) {
  const [tab, setTab] = useState<'sent' | 'found'>('sent');
  return (
    <main className="screen letters-screen">
      <header className="page-header"><p className="eyebrow">나의 기록</p><h1>내 삐라</h1></header>
      <div className="segmented-control" role="tablist">
        <button className={tab === 'sent' ? 'active' : ''} onClick={() => setTab('sent')}>날린 삐라 <span>{sentFlyers.length}</span></button>
        <button className={tab === 'found' ? 'active' : ''} onClick={() => setTab('found')}>주운 삐라 <span>{foundFlyers.length}</span></button>
      </div>
      {tab === 'sent' ? (
        <section className="letter-list">{sentFlyers.length === 0 ? <Empty text="아직 날린 삐라가 없어요" detail="지역을 선택하고 오늘의 마음을 날려보세요." /> : sentFlyers.map((flyer) => (
          <article className="letter-list-item" key={flyer.id}>
            <div className={`status-orb status-orb--${flyer.status.toLowerCase()}`}>▧</div>
            <div className="letter-list-item__content"><div className="letter-list-item__meta"><span className="status-label">{statusText[flyer.status]}</span><time>{formatDate(flyer.createdAt)}</time></div><p>{flyer.bodyPreview}</p><div className="letter-list-item__footer">{flyer.moodTag && <span>#{flyer.moodTag}</span>}<span>{flyer.targetRegionName}</span>{flyer.landingSequence > 1 && <span>{flyer.landingSequence}번째 낙하</span>}</div></div>
          </article>
        ))}</section>
      ) : (
        <section className="letter-list found-list">{foundFlyers.length === 0 ? <Empty text="아직 주운 삐라가 없어요" detail="우리 동네에 내려앉은 누군가의 마음을 찾아보세요." /> : foundFlyers.map((flyer) => (
          <button className="found-letter-card" key={flyer.id} onClick={() => onOpenFound(flyer)}><span className="found-letter-card__seal">▧</span><div><p>{flyer.body.slice(0, 56)}{flyer.body.length > 56 ? '…' : ''}</p><span>{flyer.regionName} · {formatDate(flyer.claimedAt)}</span></div><b>›</b></button>
        ))}</section>
      )}
    </main>
  );
}

function Empty({ text, detail }: { text: string; detail: string }) { return <div className="empty-letters"><div>▧</div><strong>{text}</strong><p>{detail}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value)); }
