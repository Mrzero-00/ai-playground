import { useState } from 'react';
import { formatRecurrence } from '../domain/date';
import type { Chore, Recurrence, RecurrenceUnit } from '../domain/types';

interface RecommendationReviewProps {
  candidates: Chore[];
  onAccept: (id: string, recurrence: Recurrence) => void;
  onDismiss: (id: string) => void;
  onSnooze: (id: string) => void;
}

function recommendationKind(chore: Chore) {
  if (/(washer|dryer|dishwasher|range-hood|vacuum|air-purifier|air-conditioner|dehumidifier|microwave|fridge-deep|seasonal)/.test(chore.id)) return '가전·설비 관리';
  if (/(cook|ingredient-prep|leftover-storage|meal-plan)/.test(chore.id)) return '요리·식재료 루틴';
  if (chore.category === 'pet') return '반려동물 맞춤';
  if (/(baby|child|toddler|family-toys)/.test(chore.id)) return '아이 맞춤';
  if (/(rent|jeonse|owned)/.test(chore.id)) return '거주 형태 맞춤';
  return '생활 루틴';
}

export function RecommendationReview({ candidates, onAccept, onDismiss, onSnooze }: RecommendationReviewProps) {
  const [recurrences, setRecurrences] = useState<Record<string, Recurrence>>({});
  const [showAll, setShowAll] = useState(false);
  if (!candidates.length) return null;

  const visibleCandidates = showAll ? candidates : candidates.slice(0, 2);
  const hiddenCount = candidates.length - visibleCandidates.length;

  return <section className="recommendation-review">
    <header><div><span>우리 집 맞춤 추천</span><h2>먼저 {candidates.length}가지만 확인해 보세요</h2><p>필요한 일만 추가하면 다음 추천이 이어져요. 제외한 선택은 다시 묻지 않아요.</p></div></header>
    <div className="recommendation-cards">{visibleCandidates.map((chore) => {
      const recurrence = recurrences[chore.id] ?? chore.recurrence;
      return <article key={chore.id}>
        <div className="recommendation-card-head"><span className="recommendation-card-icon" aria-hidden="true">{chore.icon ?? '✨'}</span><div className="recommendation-card-copy"><span className="recommendation-card-kind">{recommendationKind(chore)}</span><strong>{chore.title}</strong><small>추천 주기 {formatRecurrence(chore.recurrence)} · 가이드 포함</small></div></div>
        <label><span>사용할 주기</span><select aria-label={`${chore.title} 주기`} value={`${recurrence.interval}-${recurrence.unit}`} onChange={(event) => { const [interval, unit] = event.target.value.split('-'); setRecurrences((current) => ({ ...current, [chore.id]: { interval: Number(interval), unit: unit as RecurrenceUnit } })); }}><option value="1-day">매일</option><option value="3-day">3일마다</option><option value="1-week">매주</option><option value="2-week">2주마다</option><option value="1-month">매월</option><option value="3-month">3개월마다</option><option value="6-month">6개월마다</option></select></label>
        <footer><button onClick={() => onSnooze(chore.id)} type="button">나중에</button><button onClick={() => onDismiss(chore.id)} type="button">필요 없어요</button><button className="recommendation-accept" onClick={() => onAccept(chore.id, recurrence)} type="button">추가하기</button></footer>
      </article>;
    })}</div>
    {candidates.length > 2 && <button aria-expanded={showAll} className="recommendation-more-button" onClick={() => setShowAll((value) => !value)} type="button">{showAll ? '추천 접기' : `추천 ${hiddenCount}개 더 보기`}</button>}
  </section>;
}
