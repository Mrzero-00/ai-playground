import { useMemo } from 'react';
import { calculateHomeAnalytics } from '../domain/analytics';
import type { Chore, ChoreCategory, ChoreHistory, HomeMember } from '../domain/types';
import type { LaborAssessment } from '../domain/types';
import { LaborBalance } from './LaborBalance';
import { SupplyPlanner } from './SupplyPlanner';
import type { SupplyItem } from '../domain/types';

interface HouseholdReportProps {
  homeName: string;
  chores: Chore[];
  history: ChoreHistory[];
  members: HomeMember[];
  assessments: LaborAssessment[];
  currentUserId: string;
  onAssign: (choreId: string, executorMemberId?: string) => void;
  onSaveAssessment: (assessment: { planningScore: number; executionScore: number; answers: number[] }) => void;
  assignmentMode: 'shared' | 'auto';
  onAutoAssign: () => void;
  onUseSharedList: () => void;
  supplies: SupplyItem[];
  onAddSupply: (item: Omit<SupplyItem, 'id' | 'updatedAt'>) => void;
  onPurchaseSupply: (itemId: string, purchaseDate: string, purchaseQuantity: number) => void;
  onRemoveSupply: (itemId: string) => void;
}

const categoryLabels: Record<ChoreCategory, { label: string; icon: string }> = {
  cleaning: { label: '청소', icon: '🧹' },
  kitchen: { label: '주방', icon: '🧽' },
  laundry: { label: '세탁', icon: '🧺' },
  pet: { label: '반려동물', icon: '🐾' },
  living: { label: '생활', icon: '🏠' },
  etc: { label: '기타', icon: '✨' },
};

export function HouseholdReport({ homeName, chores, history, members, assessments, currentUserId, onAssign, onSaveAssessment, assignmentMode, onAutoAssign, onUseSharedList, supplies, onAddSupply, onPurchaseSupply, onRemoveSupply }: HouseholdReportProps) {
  const analytics = useMemo(
    () => calculateHomeAnalytics(chores, history, members),
    [chores, history, members],
  );

  return (
    <main className="screen report-screen">
      <header className="screen-header compact">
        <span className="step-label">{homeName}</span>
        <h1>집안일 리포트</h1>
        <p>비교보다는 우리 집의 꾸준한 변화를 확인해보세요.</p>
      </header>

      <section className="report-hero" aria-label={`이번 달 완료율 ${analytics.monthCompletionRate}%`}>
        <div><span>이번 달 완료율</span><strong>{analytics.monthCompletionRate}%</strong><small>{analytics.completedThisMonth}건 완료</small></div>
        <div className="report-progress" style={{ '--report-progress': `${analytics.monthCompletionRate}%` } as React.CSSProperties}><i /></div>
      </section>

      <section className="report-metrics" aria-label="이번 달 요약">
        <article><span aria-hidden="true">✅</span><strong>{analytics.completedThisMonth}</strong><small>완료한 일</small></article>
        <article><span aria-hidden="true">📅</span><strong>{analytics.scheduledUntilToday}</strong><small>예정된 일</small></article>
        <article><span aria-hidden="true">🔥</span><strong>{analytics.currentStreak}일</strong><small>연속 100%</small></article>
      </section>

      <section className="report-section">
        <div className="section-heading"><h2>함께한 사람</h2><span>이번 달 수행 기준</span></div>
        {!analytics.memberContributions.length ? <ReportEmpty text="완료 기록이 쌓이면 구성원별 활동을 볼 수 있어요." /> : (
          <ul className="contribution-list">
            {analytics.memberContributions.map((member) => <li key={member.userId}><span className="member-avatar" aria-hidden="true">🙂</span><div><strong>{member.name}</strong><span><i style={{ width: `${member.share}%` }} /></span></div><b>{member.count}건</b></li>)}
          </ul>
        )}
        <p className="report-note">수행 건수는 역할이나 관계의 기여도를 평가하는 순위가 아니에요.</p>
      </section>

      <LaborBalance assessments={assessments} assignmentMode={assignmentMode} chores={chores} currentUserId={currentUserId} members={members} onAssign={onAssign} onAutoAssign={onAutoAssign} onSaveAssessment={onSaveAssessment} onUseSharedList={onUseSharedList} />
      <SupplyPlanner items={supplies} onAdd={onAddSupply} onPurchase={onPurchaseSupply} onRemove={onRemoveSupply} />

      <section className="report-section">
        <div className="section-heading"><h2>어떤 일을 했나요?</h2><span>카테고리별</span></div>
        {!analytics.categoryContributions.length ? <ReportEmpty text="아직 집계할 완료 기록이 없어요." /> : (
          <div className="category-stats">
            {analytics.categoryContributions.map(({ category, count }) => <article key={category}><span aria-hidden="true">{categoryLabels[category].icon}</span><div><strong>{categoryLabels[category].label}</strong><small>{count}건 완료</small></div></article>)}
          </div>
        )}
      </section>

      <section className="report-section">
        <div className="section-heading"><h2>최근 히스토리</h2><span>최근 30건</span></div>
        {!analytics.recentHistory.length ? <ReportEmpty text="집안일을 완료하면 여기에 기록돼요." /> : (
          <ol className="history-list">
            {analytics.recentHistory.map((entry) => <li key={entry.id}><span aria-hidden="true">✓</span><div><strong>{entry.choreTitle}</strong><small>{entry.performedByName} · {new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(entry.performedAt))}</small></div></li>)}
          </ol>
        )}
      </section>
    </main>
  );
}

function ReportEmpty({ text }: { text: string }) {
  return <div className="report-empty">{text}</div>;
}
