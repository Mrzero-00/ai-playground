import { useMemo, useState } from 'react';
import { FlyerIcon } from './FlyerIcon';
import type { MoodTag, Region, Wallet } from '../types';

interface ComposeScreenProps {
  regions: Region[];
  wallet: Wallet | null;
  submitting: boolean;
  onBack: () => void;
  onNeedCredits: () => void;
  onSubmit: (body: string, mood: MoodTag | null, regionId: string) => Promise<void>;
}

const moods: Array<{ value: MoodTag; emoji: string }> = [
  { value: '위로', emoji: '☱' }, { value: '응원', emoji: '✦' }, { value: '고민', emoji: '…' },
  { value: '감사', emoji: '♡' }, { value: '일상', emoji: '☀' },
];

export function ComposeScreen({ regions, wallet, submitting, onBack, onNeedCredits, onSubmit }: ComposeScreenProps) {
  const cities = useMemo(() => [...new Set(regions.map((region) => region.city))], [regions]);
  const [city, setCity] = useState(cities[0] ?? '');
  const availableRegions = regions.filter((region) => region.city === city);
  const [regionId, setRegionId] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<MoodTag | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [sent, setSent] = useState(false);
  const region = regions.find((item) => item.id === regionId);

  const handleSubmit = async () => {
    if (!wallet?.availableTotal) return onNeedCredits();
    await onSubmit(body, mood, regionId);
    setSent(true);
  };

  if (sent) {
    return (
      <main className="screen compose-success ppira-success">
        <div className="wind-trails"><i /><i /><i /></div>
        <FlyerIcon size={170} flying />
        <p className="eyebrow">삐라를 날렸어요</p>
        <h1>{region?.district}를 향해<br />바람을 타고 있어요</h1>
        <p>지역 안의 안전한 공공장소에 무작위로 내려앉아요.<br />누군가 발견하면 내 삐라에서 확인할 수 있어요.</p>
        <button className="primary-button" onClick={onBack}>내 삐라 기다리기</button>
      </main>
    );
  }

  return (
    <main className="screen compose-screen ppira-compose">
      <header className="top-bar"><button className="back-button" onClick={onBack}>‹</button><h1>삐라 날리기</h1><span /></header>

      <section className="credit-strip">
        <span>P</span><div><small>사용 가능</small><strong>{wallet?.availableTotal ?? 0}장</strong></div>
        <button onClick={onNeedCredits}>{wallet?.dailyFreeRemaining ? '오늘의 무료 1장' : '300원에 추가하기'}</button>
      </section>

      <section className="form-section">
        <label className="form-label">어느 지역으로 날릴까요?</label>
        <div className="region-selects">
          <label><span>시·도</span><select value={city} onChange={(event) => { setCity(event.target.value); setRegionId(''); }}><option value="" disabled>선택</option>{cities.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>시·군·구</span><select value={regionId} onChange={(event) => setRegionId(event.target.value)}><option value="" disabled>선택</option>{availableRegions.map((item) => <option value={item.id} key={item.id}>{item.district}</option>)}</select></label>
        </div>
        {region && <p className="destination-note">◉ {region.displayName} 안의 무작위 공공장소로 날아가요.</p>}
      </section>

      <section className="form-section">
        <label className="form-label">이 삐라의 마음은? <span>선택</span></label>
        <div className="mood-list">{moods.map((item) => <button key={item.value} type="button" className={mood === item.value ? 'mood-chip mood-chip--selected' : 'mood-chip'} onClick={() => setMood(mood === item.value ? null : item.value)}><span>{item.emoji}</span>{item.value}</button>)}</div>
      </section>

      <section className="form-section">
        <label className="form-label" htmlFor="flyer-body">삐라 내용</label>
        <div className="flyer-paper-input">
          <span className="paper-pin">●</span>
          <textarea id="flyer-body" value={body} maxLength={500} placeholder={'이 동네의 누군가에게\n전하고 싶은 마음을 적어보세요.'} onChange={(event) => setBody(event.target.value)} />
          <span className="character-count">{body.length} / 500</span>
        </div>
      </section>

      <aside className="content-guide"><strong>이런 내용은 날릴 수 없어요</strong><p>연락처·SNS·정확한 주소, 협박·혐오, 정치 선전, 광고·거래·만남 유도</p></aside>
      <label className="agreement"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /><span className="checkmark">✓</span><span>익명 공개와 삐라 운영정책을 확인했어요.</span></label>
      <button className="primary-button compose-submit" disabled={!body.trim() || !regionId || !agreed || submitting} onClick={() => void handleSubmit()}>
        {submitting ? '바람에 싣는 중…' : wallet?.availableTotal ? `${region?.district ?? '지역'}로 삐라 날리기` : '삐라 1장 구매하기'}
      </button>
    </main>
  );
}
