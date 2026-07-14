import { useMemo, useState } from 'react';
import { startOfMonthKey, toDateKey, todayKey } from '../domain/date';
import { buildSchedule, type ScheduledChore } from '../domain/schedule';
import type { Chore, ChoreHistory } from '../domain/types';
import { formatRecurrence } from '../domain/date';

interface ScheduleCalendarProps {
  chores: Chore[];
  history: ChoreHistory[];
}

const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
const scheduleGroupMeta = {
  day: { label: '매일·일 단위', icon: '☀️' },
  week: { label: '매주·주 단위', icon: '🗓️' },
  month: { label: '매월·월 단위', icon: '🌙' },
  year: { label: '매년 관리', icon: '🌿' },
} as const;

function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function ScheduleCalendar({ chores, history }: ScheduleCalendarProps) {
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const days = useMemo(() => monthGrid(month), [month]);
  const rangeStart = toDateKey(days[0]);
  const rangeEnd = toDateKey(days[days.length - 1]);
  const schedule = useMemo(
    () => buildSchedule(chores, history, rangeStart, rangeEnd),
    [chores, history, rangeStart, rangeEnd],
  );
  const selected = schedule.get(selectedDate);
  const today = todayKey();

  function moveMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedDate(offset === 0 ? today : startOfMonthKey(next));
  }

  return (
    <main className="screen schedule-screen">
      <header className="screen-header compact">
        <span className="step-label">우리 집 스케줄</span>
        <h1>집안일 달력</h1>
        <p>지난 기록과 앞으로 해야 할 일을 한눈에 확인하세요.</p>
      </header>

      <section className="calendar-card" aria-label="월간 집안일 달력">
        <header className="calendar-toolbar">
          <button aria-label="이전 달" onClick={() => moveMonth(-1)} type="button">‹</button>
          <strong>{month.getFullYear()}년 {month.getMonth() + 1}월</strong>
          <button aria-label="다음 달" onClick={() => moveMonth(1)} type="button">›</button>
        </header>
        <div className="calendar-weekdays" aria-hidden="true">
          {weekDays.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-grid">
          {days.map((date) => {
            const key = toDateKey(date);
            const day = schedule.get(key);
            const isCurrentMonth = date.getMonth() === month.getMonth();
            const isPastOrToday = key <= today;
            const label = day?.totalCount
              ? isPastOrToday
                ? `${day.completionRate}% 완료`
                : `예정 ${day.totalCount}개`
              : '일정 없음';
            return (
              <button
                aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일, ${label}`}
                aria-pressed={selectedDate === key}
                className={`${isCurrentMonth ? '' : 'is-outside'} ${key === today ? 'is-today' : ''} ${selectedDate === key ? 'is-selected' : ''}`}
                key={key}
                onClick={() => setSelectedDate(key)}
                type="button"
              >
                <span>{date.getDate()}</span>
                {day?.totalCount ? (
                  isPastOrToday
                    ? <small className={(day.completionRate ?? 0) === 100 ? 'is-complete' : ''}>{day.completionRate}%</small>
                    : <small>{day.totalCount}개</small>
                ) : <i />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="selected-schedule">
        <div className="section-heading">
          <h2>{new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${selectedDate}T12:00:00`))}</h2>
          {selected?.completionRate !== null && selected?.completionRate !== undefined && <span>{selected.completionRate}% 완료</span>}
        </div>
        {!selected?.items.length ? (
          <div className="empty-state compact"><span aria-hidden="true">🌿</span><strong>예정된 집안일이 없어요</strong><p>잠시 쉬어가는 날이에요.</p></div>
        ) : <GroupedScheduleItems items={selected.items} selectedDate={selectedDate} today={today} />}
      </section>
    </main>
  );
}

function GroupedScheduleItems({ items, selectedDate, today }: { items: ScheduledChore[]; selectedDate: string; today: string }) {
  const groups = (Object.keys(scheduleGroupMeta) as Array<keyof typeof scheduleGroupMeta>)
    .map((unit) => ({ unit, items: items.filter(({ chore }) => chore.recurrence.unit === unit) }))
    .filter((group) => group.items.length > 0);
  return <div className="schedule-groups">{groups.map(({ unit, items: groupItems }, index) => {
    const completedCount = groupItems.filter((item) => item.completed).length;
    const meta = scheduleGroupMeta[unit];
    return <details className="task-group schedule-group" key={unit} open={index === 0}><summary><span aria-hidden="true">{meta.icon}</span><strong>{meta.label}</strong><small>{selectedDate <= today ? `${completedCount} / ${groupItems.length} 완료` : `${groupItems.length}개 예정`}</small><i aria-hidden="true">⌄</i></summary><ul className="schedule-list">{groupItems.map(({ chore, completed }) => <li key={`${selectedDate}-${chore.id}`}><span className={`schedule-status ${completed ? 'is-complete' : ''}`} aria-hidden="true">{completed ? '✓' : '·'}</span><div><strong>{chore.title}</strong><small>{formatRecurrence(chore.recurrence)} · {selectedDate < today ? completed ? '완료' : '미완료' : selectedDate === today ? '오늘' : '예정'}</small></div></li>)}</ul></details>;
  })}</div>;
}
