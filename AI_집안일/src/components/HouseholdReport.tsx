import { useMemo, useState } from 'react';
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
  const [detail, setDetail] = useState<'assignments' | 'supplies' | 'history' | null>(null);
  const analytics = useMemo(
    () => calculateHomeAnalytics(chores, history, members),
    [chores, history, members],
  );

  if (detail) return <main className="screen report-detail-screen">
    <header className="detail-screen-header"><button aria-label="리포트로 돌아가기" onClick={() => setDetail(null)} type="button">‹</button><div><span>{homeName}</span><h1>{{ assignments: '실행 업무 나누기', supplies: '생활용품 관리', history: '집안일 히스토리' }[detail]}</h1></div><span /></header>
    {detail === 'assignments' && <><p className="detail-screen-intro">담당 방식을 정하고 각 집안일의 실행 담당자를 관리하세요.</p><LaborBalance assessments={assessments} assignmentMode={assignmentMode} chores={chores} currentUserId={currentUserId} members={members} onAssign={onAssign} onAutoAssign={onAutoAssign} onSaveAssessment={onSaveAssessment} onUseSharedList={onUseSharedList} view="assignments" /></>}
    {detail === 'supplies' && <><p className="detail-screen-intro">구매 수량과 사용 속도를 기록하면 다음 확인 시점을 계산해요.</p><SupplyPlanner items={supplies} onAdd={onAddSupply} onPurchase={onPurchaseSupply} onRemove={onRemoveSupply} /></>}
    {detail === 'history' && <><div className="detail-list-heading"><strong>최근 완료 기록</strong><span>{analytics.recentHistory.length}건</span></div>{!analytics.recentHistory.length ? <ReportEmpty text="집안일을 완료하면 여기에 기록돼요." /> : <HistoryList entries={analytics.recentHistory} />}</>}
  </main>;

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

      <LaborBalance assessments={assessments} assignmentMode={assignmentMode} chores={chores} currentUserId={currentUserId} members={members} onAssign={onAssign} onAutoAssign={onAutoAssign} onOpenAssignments={() => setDetail('assignments')} onSaveAssessment={onSaveAssessment} onUseSharedList={onUseSharedList} />
      <SupplyPlanner compact items={supplies} onAdd={onAddSupply} onOpen={() => setDetail('supplies')} onPurchase={onPurchaseSupply} onRemove={onRemoveSupply} />

      <section className="report-section">
        <div className="section-heading"><h2>어떤 일을 했나요?</h2><span>카테고리별</span></div>
        {!analytics.categoryContributions.length ? <ReportEmpty text="아직 집계할 완료 기록이 없어요." /> : (
          <div className="category-stats">
            {analytics.categoryContributions.map(({ category, count }) => <article key={category}><span aria-hidden="true">{categoryLabels[category].icon}</span><div><strong>{categoryLabels[category].label}</strong><small>{count}건 완료</small></div></article>)}
          </div>
        )}
      </section>

      <section className="report-section">
        <div className="section-heading"><h2>최근 히스토리</h2><button className="section-more-button" onClick={() => setDetail('history')} type="button">전체 보기 ›</button></div>
        {!analytics.recentHistory.length ? <ReportEmpty text="집안일을 완료하면 여기에 기록돼요." /> : (
          <HistoryList entries={analytics.recentHistory.slice(0, 3)} />
        )}
      </section>
    </main>
  );
}

function HistoryList({ entries }: { entries: ChoreHistory[] }) {
  return <ol className="history-list">{entries.map((entry) => <li key={entry.id}><span aria-hidden="true">✓</span><div><strong>{entry.choreTitle}</strong><small>{entry.performedByName} · {new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(entry.performedAt))}</small></div></li>)}</ol>;
}

function ReportEmpty({ text }: { text: string }) {
  return <div className="report-empty">{text}</div>;
}
