import { useState } from 'react';
import { BottleIcon } from './BottleIcon';
import type { MoodTag } from '../types';

interface ComposeScreenProps {
  submitting: boolean;
  onBack: () => void;
  onSubmit: (body: string, mood: MoodTag | null) => Promise<void>;
}

const moods: Array<{ value: MoodTag; emoji: string }> = [
  { value: '위로', emoji: '☁' },
  { value: '응원', emoji: '✦' },
  { value: '고민', emoji: '…' },
  { value: '감사', emoji: '♡' },
  { value: '일상', emoji: '☀' },
];

export function ComposeScreen({ submitting, onBack, onSubmit }: ComposeScreenProps) {
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<MoodTag | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    await onSubmit(body, mood);
    setSent(true);
  };

  if (sent) {
    return (
      <main className="screen compose-success">
        <div className="success-ripples"><i /><i /><i /></div>
        <BottleIcon size={150} glowing />
        <p className="eyebrow">편지를 띄웠어요</p>
        <h1>이제 한강을 따라<br />천천히 흘러갈 거예요</h1>
        <p>잠시 표류한 뒤 무작위 한강공원에 도착해요.<br />누군가 발견하면 내 편지에서 확인할 수 있어요.</p>
        <button className="primary-button" onClick={onBack}>내 편지 기다리기</button>
      </main>
    );
  }

  return (
    <main className="screen compose-screen">
      <header className="top-bar">
        <button className="back-button" onClick={onBack} aria-label="뒤로 가기">‹</button>
        <h1>편지 띄우기</h1>
        <span />
      </header>

      <section className="compose-intro">
        <span className="mini-bottle">✉</span>
        <div><strong>단 한 사람에게 도착하는 편지</strong><p>답장을 기대하지 않고 지금의 마음을 가볍게 적어보세요.</p></div>
      </section>

      <section className="form-section">
        <label className="form-label">이 편지의 마음은 어떤가요? <span>선택</span></label>
        <div className="mood-list">
          {moods.map((item) => (
            <button
              key={item.value}
              type="button"
              className={mood === item.value ? 'mood-chip mood-chip--selected' : 'mood-chip'}
              onClick={() => setMood(mood === item.value ? null : item.value)}
            >
              <span>{item.emoji}</span>{item.value}
            </button>
          ))}
        </div>
      </section>

      <section className="form-section">
        <label className="form-label" htmlFor="letter-body">편지 내용</label>
        <div className="letter-paper">
          <textarea
            id="letter-body"
            value={body}
            maxLength={500}
            placeholder={'오늘의 마음을 적어보세요.\n이름이나 연락처는 쓰지 않아도 괜찮아요.'}
            onChange={(event) => setBody(event.target.value)}
          />
          <span>{body.length} / 500</span>
        </div>
      </section>

      <aside className="content-guide">
        <strong>이런 내용은 담을 수 없어요</strong>
        <p>전화번호·SNS·링크, 만남이나 거래 유도, 괴롭힘·불법·선정적인 내용</p>
      </aside>

      <label className="agreement">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
        <span className="checkmark">✓</span>
        <span>익명 공개와 콘텐츠 운영정책을 확인했어요.</span>
      </label>

      <button
        className="primary-button compose-submit"
        disabled={!body.trim() || !agreed || submitting}
        onClick={() => void handleSubmit()}
      >
        {submitting ? '한강에 띄우는 중…' : '한강에 편지 띄우기'}
      </button>
    </main>
  );
}
