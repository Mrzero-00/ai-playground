import { useMemo, useState, type FormEvent } from 'react';
import type { Chore, HomeMember, LaborAssessment } from '../domain/types';

const questions = [
  { kind: 'planning', text: '샴푸, 휴지, 세제 같은 생필품이 얼마나 남았는지 신경 쓴다.' },
  { kind: 'execution', text: '필요한 생필품을 직접 사거나 주문하는 편이다.' },
  { kind: 'planning', text: '무엇을 어디서 사야 하는지 제품과 구매처를 기억한다.' },
  { kind: 'execution', text: '택배를 정리하고 새 제품을 제자리에 채워 넣는다.' },
  { kind: 'planning', text: '집안일이 필요한 시점과 반복 주기를 먼저 떠올린다.' },
  { kind: 'execution', text: '정해진 청소, 세탁, 설거지를 직접 수행하는 편이다.' },
  { kind: 'planning', text: '가족이나 동거인의 일정을 고려해 집안일 시점을 조정한다.' },
  { kind: 'execution', text: '일정이 바뀌어도 필요한 집안일을 실제로 마무리한다.' },
  { kind: 'planning', text: '계절이 바뀌기 전에 침구, 옷, 냉난방 준비를 생각한다.' },
  { kind: 'execution', text: '계절용품을 꺼내고 세탁하거나 보관하는 일을 한다.' },
  { kind: 'planning', text: '필터, 배터리, 소모품의 교체 시기를 기억한다.' },
  { kind: 'execution', text: '필터나 소모품을 직접 교체하고 뒤처리한다.' },
  { kind: 'planning', text: '관리비, 계약, 예약, 예방접종 같은 날짜를 챙긴다.' },
  { kind: 'execution', text: '필요한 결제, 예약, 방문 업무를 직접 처리한다.' },
  { kind: 'planning', text: '냉장고나 수납장을 보고 곧 필요한 것을 미리 파악한다.' },
  { kind: 'execution', text: '장을 본 뒤 식재료와 물건을 정리하고 보관한다.' },
  { kind: 'planning', text: '집안일의 우선순위를 정하고 누구에게 부탁할지 생각한다.' },
  { kind: 'execution', text: '부탁받은 업무를 추가 설명 없이 끝까지 처리하는 편이다.' },
  { kind: 'planning', text: '하지 않은 집안일을 발견하고 다시 알려주는 역할을 한다.' },
  { kind: 'execution', text: '누가 알려주지 않아도 눈에 보이는 일을 바로 처리한다.' },
  { kind: 'planning', text: '가족이나 동거인마다 필요한 생활용품과 선호를 기억한다.' },
  { kind: 'execution', text: '다른 구성원에게 필요한 물건이나 환경을 직접 준비한다.' },
  { kind: 'planning', text: '집이 원활히 돌아가는지 전반적으로 계속 신경 쓰는 편이다.' },
  { kind: 'execution', text: '예상하지 못한 집안일이 생기면 먼저 몸을 움직인다.' },
] as const;

function score(answers: number[], kind: 'planning' | 'execution') {
  const values = answers.filter((_, index) => questions[index].kind === kind);
  return Math.round(((values.reduce((sum, value) => sum + value, 0) - values.length) / (values.length * 4)) * 100);
}

function tendency(item: LaborAssessment) {
  const delta = item.planningScore - item.executionScore;
  if (delta >= 15) return '기획 부담형';
  if (delta <= -15) return '가사 실행형';
  return '균형 참여형';
}

interface LaborBalanceProps {
  assessments: LaborAssessment[];
  chores: Chore[];
  currentUserId: string;
  members: HomeMember[];
  onAssign: (choreId: string, executorMemberId?: string) => void;
  onSaveAssessment: (assessment: { planningScore: number; executionScore: number; answers: number[] }) => void;
  assignmentMode: 'shared' | 'auto';
  onAutoAssign: () => void;
  onUseSharedList: () => void;
  view?: 'summary' | 'assignments';
  onOpenAssignments?: () => void;
}

export function LaborBalance({ assessments, chores, currentUserId, members, onAssign, onSaveAssessment, assignmentMode, onAutoAssign, onUseSharedList, view = 'summary', onOpenAssignments }: LaborBalanceProps) {
  const previous = assessments.find((item) => item.userId === currentUserId);
  const [testing, setTesting] = useState(false);
  const [answers, setAnswers] = useState<number[]>(previous?.answers.length === questions.length ? previous.answers : Array(questions.length).fill(3));
  const [questionIndex, setQuestionIndex] = useState(0);
  const assessedMembers = useMemo(() => assessments.map((item) => ({ ...item, member: members.find((member) => member.userId === item.userId) })), [assessments, members]);
  const homePlanningLoad = assessments.length ? Math.round(assessments.reduce((sum, item) => sum + item.planningScore, 0) / assessments.length) : 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    onSaveAssessment({ planningScore: score(answers, 'planning'), executionScore: score(answers, 'execution'), answers });
    setTesting(false);
  }

  if (view === 'assignments') return <section className="labor-assignments labor-detail-section">
    <div className="assignment-mode-card"><div><strong>{assignmentMode === 'auto' ? '✨ 자동 분배 사용 중' : '👥 전체 목록 함께 보기'}</strong><small>{assignmentMode === 'auto' ? '각자 오늘 화면에서 담당 업무를 확인해요.' : '모든 구성원에게 같은 목록이 보여요.'}</small></div><button type="button" onClick={assignmentMode === 'auto' ? onUseSharedList : onAutoAssign}>{assignmentMode === 'auto' ? '함께 보기로 변경' : '스타일로 자동 분배'}</button>{assignmentMode === 'auto' && <button className="text-button" type="button" onClick={onAutoAssign}>다시 자동 분배</button>}</div>
    <div className="detail-list-heading"><strong>등록된 실행 업무</strong><span>{chores.length}개</span></div>
    <ul>{chores.map((chore) => <li key={chore.id}><strong>{chore.title}</strong><div><label>실행 담당<select aria-label={`${chore.title} 실행 담당`} value={chore.executorMemberId ?? ''} onChange={(event) => onAssign(chore.id, event.target.value || undefined)}><option value="">모두에게 표시</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label></div></li>)}</ul>
  </section>;

  return <>
    <section className="report-section labor-balance">
      <div className="section-heading"><h2>기획노동 균형</h2><span>{assessments.length}/{members.length}명 참여</span></div>
      <div className="labor-score-card"><div><span>우리 집 기획 부담 지수</span><strong>{homePlanningLoad}</strong><small>진단 참여자의 체감 평균</small></div><div className="labor-score-ring" style={{ '--labor-score': `${homePlanningLoad * 3.6}deg` } as React.CSSProperties} aria-label={`100점 중 ${homePlanningLoad}점`} /></div>
      {!assessments.length ? <p className="report-empty">각자 진단하면 보이지 않던 계획·확인 부담을 함께 볼 수 있어요.</p> : <ul className="labor-member-list">{assessedMembers.map((item) => <li key={item.userId}><span aria-hidden="true">{item.userId === currentUserId ? '🙂' : '👤'}</span><div><strong>{item.member?.displayName ?? '구성원'}</strong><small>{tendency(item)}</small></div><b>기획 {item.planningScore} · 실행 {item.executionScore}</b></li>)}</ul>}
      <button className="secondary-button labor-test-button" type="button" onClick={() => { setQuestionIndex(0); setTesting(true); }}><span aria-hidden="true">🧭</span>{previous ? '내 진단 다시 하기' : '24문항 기획노동 테스트'}<i aria-hidden="true">›</i></button>
      <p className="report-note">이 수치는 능력이나 기여도의 순위가 아니라, 현재 누가 어떤 부담을 체감하는지 대화하기 위한 지표예요.</p>
    </section>

    <button className="report-link-card" type="button" onClick={onOpenAssignments}><span aria-hidden="true">🧹</span><div><strong>실행 업무 나누기</strong><small>{assignmentMode === 'auto' ? `자동 분배 중 · ${chores.length}개 업무` : `${chores.length}개 업무의 담당자를 관리해요`}</small></div><i aria-hidden="true">›</i></button>

    {testing && <div className="modal-backdrop" role="presentation"><section className="bottom-sheet labor-test-sheet" role="dialog" aria-modal="true" aria-labelledby="labor-test-title">
      <header><button type="button" aria-label="테스트 닫기" onClick={() => setTesting(false)}>×</button><div><small>24문항 진단</small><h2 id="labor-test-title">보이지 않는 노동 테스트</h2></div><span>{questionIndex + 1}<small> / {questions.length}</small></span></header>
      <form onSubmit={submit}>
        <div className="labor-test-progress" aria-label={`${questions.length}문항 중 ${questionIndex + 1}번째`}><i style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div>
        <p>최근 한 달의 우리 집 생활을 떠올리며 답해주세요. 정답은 없어요.</p>
        <fieldset><div className="labor-question-meta"><span>{questions[questionIndex].kind === 'planning' ? '생각하고 챙기는 일' : '직접 실행하는 일'}</span><small>문항 {String(questionIndex + 1).padStart(2, '0')}</small></div><legend>{questions[questionIndex].text}</legend><div className="labor-scale">{[1, 2, 3, 4, 5].map((value) => <label key={value}><input checked={answers[questionIndex] === value} name={`labor-${questionIndex}`} onChange={() => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === questionIndex ? value : answer))} type="radio" /><span>{value}</span></label>)}</div><div className="labor-scale-labels"><span>전혀<br />그렇지 않다</span><span>보통이다</span><span>매우<br />그렇다</span></div></fieldset>
        <div className="labor-test-actions"><button className="labor-back-button" disabled={questionIndex === 0} type="button" onClick={() => setQuestionIndex((value) => value - 1)}>‹ 이전</button>{questionIndex < questions.length - 1 ? <button className="labor-next-button" type="button" onClick={() => setQuestionIndex((value) => value + 1)}>다음 문항 <span aria-hidden="true">›</span></button> : <button className="labor-next-button" type="submit">결과 확인하기</button>}</div>
      </form>
    </section></div>}
  </>;
}
