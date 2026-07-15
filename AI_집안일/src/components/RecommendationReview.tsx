import { useState } from 'react';
import { formatRecurrence } from '../domain/date';
import type { Chore, Recurrence, RecurrenceUnit } from '../domain/types';

interface RecommendationReviewProps {
  candidates: Chore[];
  onAccept: (id: string, recurrence: Recurrence) => void;
  onDismiss: (id: string) => void;
  onSnooze: (id: string) => void;
}

export function RecommendationReview({ candidates, onAccept, onDismiss, onSnooze }: RecommendationReviewProps) {
  const [recurrences, setRecurrences] = useState<Record<string, Recurrence>>({});
  if (!candidates.length) return null;

  return <section className="recommendation-review">
    <header><div><span>우리 집 맞춤 추천</span><h2>{candidates.length}가지 일을 확인해 보세요</h2><p>필요한 일만 추가하면 돼요. 제외한 선택은 다음에도 기억할게요.</p></div></header>
    <div className="recommendation-cards">{candidates.map((chore) => {
      const recurrence = recurrences[chore.id] ?? chore.recurrence;
      return <article key={chore.id}>
        <div><span aria-hidden="true">✨</span><div><strong>{chore.title}</strong><small>추천 주기: {formatRecurrence(chore.recurrence)}</small></div></div>
        <label><span>사용할 주기</span><select aria-label={`${chore.title} 주기`} value={`${recurrence.interval}-${recurrence.unit}`} onChange={(event) => { const [interval, unit] = event.target.value.split('-'); setRecurrences((current) => ({ ...current, [chore.id]: { interval: Number(interval), unit: unit as RecurrenceUnit } })); }}><option value="1-day">매일</option><option value="3-day">3일마다</option><option value="1-week">매주</option><option value="2-week">2주마다</option><option value="1-month">매월</option><option value="3-month">3개월마다</option><option value="6-month">6개월마다</option></select></label>
        <footer><button onClick={() => onSnooze(chore.id)} type="button">나중에</button><button onClick={() => onDismiss(chore.id)} type="button">필요 없어요</button><button className="recommendation-accept" onClick={() => onAccept(chore.id, recurrence)} type="button">추가하기</button></footer>
      </article>;
    })}</div>
  </section>;
}
