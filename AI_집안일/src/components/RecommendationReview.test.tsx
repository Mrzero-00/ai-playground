import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Chore } from '../domain/types';
import { RecommendationReview } from './RecommendationReview';

function candidate(id: string, title: string): Chore {
  return {
    id,
    title,
    category: 'cleaning',
    icon: '🧹',
    recurrence: { interval: 1, unit: 'week' },
    createdAt: '2026-08-11T00:00:00.000Z',
    nextDueDate: '2026-08-11',
    isCustom: false,
    enabled: false,
  };
}

describe('RecommendationReview', () => {
  it('처음에는 추천 두 개만 보여주고 나머지는 더 보기로 접어둔다', () => {
    const html = renderToStaticMarkup(<RecommendationReview
      candidates={[
        candidate('first', '첫 번째 추천'),
        candidate('second', '두 번째 추천'),
        candidate('third', '세 번째 추천'),
      ]}
      onAccept={vi.fn()}
      onDismiss={vi.fn()}
      onSnooze={vi.fn()}
    />);

    expect(html).toContain('첫 번째 추천');
    expect(html).toContain('두 번째 추천');
    expect(html).not.toContain('세 번째 추천');
    expect(html).toContain('추천 1개 더 보기');
  });
});
