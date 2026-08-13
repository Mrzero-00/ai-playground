import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TodayTasks, type Chore } from './HouseworkUI';

function chore(overrides: Partial<Chore> = {}): Chore {
  return {
    id: 'chore-1',
    title: '세탁기 청소',
    category: '세탁',
    icon: '🧺',
    frequency: 'monthly',
    frequencyLabel: '매월',
    recurrenceGroup: 'monthly',
    completed: false,
    ...overrides,
  };
}

function render(choreValue: Chore): string {
  return renderToStaticMarkup(
    <TodayTasks chores={[choreValue]} onClaim={vi.fn()} onToggle={vi.fn()} />,
  );
}

describe('오늘 할 일 담당 지정', () => {
  it('미완료·미지정 카드에서만 내가 담당하기를 노출한다', () => {
    expect(render(chore())).toContain('세탁기 청소 내가 담당하기');
    expect(render(chore({ assigneeMembershipId: 'member-1', assigneeName: '나' }))).not.toContain('내가 담당하기');
    expect(render(chore({ completed: true, completedByName: '나' }))).not.toContain('내가 담당하기');
  });

  it('담당자 이름이 잠시 없어도 멤버십 ID가 있으면 담당 중으로 보여준다', () => {
    const html = render(chore({ assigneeMembershipId: 'member-1' }));
    expect(html).toContain('담당 구성원');
    expect(html).not.toContain('담당자 없음');
  });
});
