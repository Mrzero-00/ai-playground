import { useMemo, useState, type FormEvent } from 'react';
import type { Chore, HomeMember, LaborAssessment } from '../domain/types';

const questions = [
  { kind: 'planning', text: '필요한 생필품과 교체 시기를 주로 내가 기억한다.' },
  { kind: 'execution', text: '청소·세탁·정리 같은 일을 직접 하는 편이다.' },
  { kind: 'planning', text: '집안일의 우선순위와 일정을 주로 내가 정한다.' },
  { kind: 'execution', text: '부탁받은 집안일을 실제로 마무리하는 편이다.' },
  { kind: 'planning', text: '누가 무엇을 했는지 확인하고 다시 알려주는 편이다.' },
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
  onAssign: (choreId: string, plannerMemberId?: string, executorMemberId?: string) => void;
  onSaveAssessment: (assessment: { planningScore: number; executionScore: number; answers: number[] }) => void;
  assignmentMode: 'shared' | 'auto';
  onAutoAssign: () => void;
  onUseSharedList: () => void;
}

export function LaborBalance({ assessments, chores, currentUserId, members, onAssign, onSaveAssessment, assignmentMode, onAutoAssign, onUseSharedList }: LaborBalanceProps) {
  const previous = assessments.find((item) => item.userId === currentUserId);
  const [testing, setTesting] = useState(false);
  const [answers, setAnswers] = useState<number[]>(previous?.answers ?? Array(questions.length).fill(3));
  const assessedMembers = useMemo(() => assessments.map((item) => ({ ...item, member: members.find((member) => member.userId === item.userId) })), [assessments, members]);
  const homePlanningLoad = assessments.length ? Math.round(assessments.reduce((sum, item) => sum + item.planningScore, 0) / assessments.length) : 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    onSaveAssessment({ planningScore: score(answers, 'planning'), executionScore: score(answers, 'execution'), answers });
    setTesting(false);
  }

  return <>
    <section className="report-section labor-balance">
      <div className="section-heading"><h2>기획노동 균형</h2><span>{assessments.length}/{members.length}명 참여</span></div>
      <div className="labor-score-card"><div><span>우리 집 기획 부담 지수</span><strong>{homePlanningLoad}</strong><small>진단 참여자의 체감 평균</small></div><div className="labor-score-ring" style={{ '--labor-score': `${homePlanningLoad * 3.6}deg` } as React.CSSProperties} aria-label={`100점 중 ${homePlanningLoad}점`} /></div>
      {!assessments.length ? <p className="report-empty">각자 진단하면 보이지 않던 계획·확인 부담을 함께 볼 수 있어요.</p> : <ul className="labor-member-list">{assessedMembers.map((item) => <li key={item.userId}><span aria-hidden="true">{item.userId === currentUserId ? '🙂' : '👤'}</span><div><strong>{item.member?.displayName ?? '구성원'}</strong><small>{tendency(item)}</small></div><b>기획 {item.planningScore} · 실행 {item.executionScore}</b></li>)}</ul>}
      <button className="secondary-button labor-test-button" type="button" onClick={() => setTesting(true)}>{previous ? '내 진단 다시 하기' : '기획노동 테스트 시작'}</button>
      <p className="report-note">이 수치는 능력이나 기여도의 순위가 아니라, 현재 누가 어떤 부담을 체감하는지 대화하기 위한 지표예요.</p>
    </section>

    <section className="report-section labor-assignments">
      <div className="section-heading"><h2>역할 나누기</h2><span>기획 / 실행</span></div>
      <p className="labor-intro">일을 기억하고 챙기는 사람과 직접 수행하는 사람을 따로 정할 수 있어요.</p>
      <div className="assignment-mode-card"><div><strong>{assignmentMode === 'auto' ? '✨ 자동 분배 사용 중' : '👥 전체 목록 함께 보기'}</strong><small>{assignmentMode === 'auto' ? '각자 오늘 화면에서 담당 업무를 확인해요.' : '모든 구성원에게 같은 목록이 보여요.'}</small></div><button type="button" onClick={assignmentMode === 'auto' ? onUseSharedList : onAutoAssign}>{assignmentMode === 'auto' ? '함께 보기로 변경' : '스타일로 자동 분배'}</button>{assignmentMode === 'auto' && <button className="text-button" type="button" onClick={onAutoAssign}>다시 자동 분배</button>}</div>
      <ul>{chores.map((chore) => <li key={chore.id}><strong>{chore.title}</strong><div><label>🧠 계획<select aria-label={`${chore.title} 계획 담당`} value={chore.plannerMemberId ?? ''} onChange={(event) => onAssign(chore.id, event.target.value || undefined, chore.executorMemberId)}><option value="">함께 정하기</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label><label>🧹 실행<select aria-label={`${chore.title} 실행 담당`} value={chore.executorMemberId ?? ''} onChange={(event) => onAssign(chore.id, chore.plannerMemberId, event.target.value || undefined)}><option value="">함께 하기</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label></div></li>)}</ul>
    </section>

    {testing && <div className="modal-backdrop" role="presentation"><section className="bottom-sheet labor-test-sheet" role="dialog" aria-modal="true" aria-labelledby="labor-test-title"><header><button type="button" aria-label="닫기" onClick={() => setTesting(false)}>×</button><h2 id="labor-test-title">기획노동 테스트</h2><span /></header><form onSubmit={submit}><p>최근 한 달의 우리 집 생활을 떠올리며 답해주세요.</p>{questions.map((question, index) => <fieldset key={question.text}><legend>{index + 1}. {question.text}</legend><div>{[1, 2, 3, 4, 5].map((value) => <label key={value}><input checked={answers[index] === value} name={`labor-${index}`} onChange={() => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? value : answer))} type="radio" /><span>{value}</span></label>)}</div><small><span>전혀 아님</span><span>매우 그럼</span></small></fieldset>)}<button className="primary-button" type="submit">결과 저장하기</button></form></section></div>}
  </>;
}
