import type { Chore, HomeMember, LaborAssessment } from './types';

export function automaticallyAllocateChores(chores: Chore[], members: HomeMember[], assessments: LaborAssessment[]): Chore[] {
  if (!members.length) return chores;
  const assessmentByUser = new Map(assessments.map((item) => [item.userId, item]));
  const planningCounts = new Map(members.map((member) => [member.id, 0]));
  const executionCounts = new Map(members.map((member) => [member.id, 0]));

  function pick(kind: 'planning' | 'execution') {
    const counts = kind === 'planning' ? planningCounts : executionCounts;
    return [...members].sort((a, b) => {
      const aScore = assessmentByUser.get(a.userId)?.[`${kind}Score`] ?? 50;
      const bScore = assessmentByUser.get(b.userId)?.[`${kind}Score`] ?? 50;
      const aLoad = counts.get(a.id) ?? 0;
      const bLoad = counts.get(b.id) ?? 0;
      return (bScore - bLoad * 20) - (aScore - aLoad * 20) || a.joinedAt.localeCompare(b.joinedAt);
    })[0];
  }

  return chores.map((chore) => {
    const planner = pick('planning');
    if (planner) planningCounts.set(planner.id, (planningCounts.get(planner.id) ?? 0) + 1);
    const executor = pick('execution');
    if (executor) executionCounts.set(executor.id, (executionCounts.get(executor.id) ?? 0) + 1);
    return { ...chore, plannerMemberId: planner?.id, executorMemberId: executor?.id };
  });
}
