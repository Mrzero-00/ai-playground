import { useEffect, useId, useState, type FormEvent } from "react";

export type HouseholdType = "single" | "couple" | "family" | "shared";

export interface HouseholdProfile {
  householdType: HouseholdType;
  housingTenure: "monthly-rent" | "jeonse" | "owned";
  memberCount: number;
  hasDog: boolean;
  hasCat: boolean;
}

export interface ProfileSetupProps {
  initialValue?: Partial<HouseholdProfile>;
  onSubmit: (profile: HouseholdProfile) => void;
}

const householdOptions: Array<{
  value: HouseholdType;
  icon: string;
  label: string;
  description: string;
}> = [
  { value: "single", icon: "🏠", label: "1인 가구", description: "혼자 살고 있어요" },
  { value: "couple", icon: "👩‍❤️‍👨", label: "2인 가구", description: "둘이 함께 살아요" },
  { value: "family", icon: "👨‍👩‍👧", label: "가족 가구", description: "아이·부모님과 살아요" },
  { value: "shared", icon: "🧑‍🤝‍🧑", label: "공동 가구", description: "룸메이트와 살아요" },
];

export function ProfileSetup({ initialValue, onSubmit }: ProfileSetupProps) {
  const [profile, setProfile] = useState<HouseholdProfile>({
    householdType: initialValue?.householdType ?? "single",
    housingTenure: initialValue?.housingTenure ?? "monthly-rent",
    memberCount: initialValue?.memberCount ?? 1,
    hasDog: initialValue?.hasDog ?? false,
    hasCat: initialValue?.hasCat ?? false,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(profile);
  }

  return (
    <form className="screen profile-screen" onSubmit={submit}>
      <header className="screen-header">
        <span className="step-label">1단계</span>
        <h1>어떤 집에 살고 있나요?</h1>
        <p>우리 집에 꼭 맞는 집안일을 추천해드릴게요.</p>
      </header>

      <fieldset className="field-section">
        <legend>가구 형태</legend>
        <div className="option-grid">
          {householdOptions.map((option) => (
            <label className={`select-card ${profile.householdType === option.value ? "is-selected" : ""}`} key={option.value}>
              <input
                checked={profile.householdType === option.value}
                name="householdType"
                onChange={() => setProfile((current) => ({ ...current, householdType: option.value }))}
                type="radio"
                value={option.value}
              />
              <span className="select-icon" aria-hidden="true">{option.icon}</span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
              <span className="check-mark" aria-hidden="true">✓</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field-section">
        <label className="field-label" htmlFor="member-count">함께 사는 사람</label>
        <div className="stepper">
          <button aria-label="인원 줄이기" disabled={profile.memberCount <= 1} onClick={() => setProfile((value) => ({ ...value, memberCount: Math.max(1, value.memberCount - 1) }))} type="button">−</button>
          <output id="member-count" aria-live="polite"><strong>{profile.memberCount}</strong>명</output>
          <button aria-label="인원 늘리기" onClick={() => setProfile((value) => ({ ...value, memberCount: value.memberCount + 1 }))} type="button">＋</button>
        </div>
      </div>

      <fieldset className="field-section">
        <legend>거주 형태</legend>
        <div className="pet-options tenure-options">
          {([['monthly-rent', '🏢', '월세'], ['jeonse', '🔑', '전세'], ['owned', '🏡', '자가·매매']] as const).map(([value, icon, label]) => <ToggleCard checked={profile.housingTenure === value} icon={icon} key={value} label={label} onChange={() => setProfile((current) => ({ ...current, housingTenure: value }))} />)}
        </div>
      </fieldset>

      <fieldset className="field-section">
        <legend>반려동물</legend>
        <div className="pet-options">
          <ToggleCard icon="🐶" label="강아지" checked={profile.hasDog} onChange={(checked) => setProfile((value) => ({ ...value, hasDog: checked }))} />
          <ToggleCard icon="🐱" label="고양이" checked={profile.hasCat} onChange={(checked) => setProfile((value) => ({ ...value, hasCat: checked }))} />
        </div>
      </fieldset>

      <div className="sticky-action"><button className="primary-button" type="submit">맞춤 집안일 시작하기</button></div>
    </form>
  );
}

function ToggleCard({ checked, icon, label, onChange }: { checked: boolean; icon: string; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className={`toggle-card ${checked ? "is-selected" : ""}`}>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span aria-hidden="true">{icon}</span><strong>{label}</strong><i aria-hidden="true">{checked ? "✓" : "+"}</i>
    </label>
  );
}

export type ChoreFrequency = "daily" | "weekly" | "monthly" | "yearly" | "custom";
export interface Chore {
  id: string;
  title: string;
  category: string;
  icon: string;
  frequency: ChoreFrequency;
  frequencyLabel: string;
  recurrenceGroup?: "daily" | "weekly" | "monthly" | "yearly";
  dueLabel?: string;
  completed: boolean;
  isCustom?: boolean;
  taskKind?: "housework" | "supply-purchase";
}

export interface TodayTasksProps {
  chores: Chore[];
  householdName?: string;
  onToggle: (id: string) => void;
  onAdd?: () => void;
  reminderEnabled?: boolean;
  reminderHour?: number;
  onReminderToggle?: () => void;
  viewMode?: "todo" | "quest";
}

export function TodayTasks({ chores, householdName = "우리 집", onAdd, onToggle, reminderEnabled = false, reminderHour = 9, onReminderToggle, viewMode = "todo" }: TodayTasksProps) {
  const [showReminder, setShowReminder] = useState(false);
  const [celebration, setCelebration] = useState<{ title: string; xp?: number } | null>(null);
  const completed = chores.filter((chore) => chore.completed).length;
  const progress = chores.length ? Math.round((completed / chores.length) * 100) : 0;

  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), 1500);
    return () => window.clearTimeout(timer);
  }, [celebration]);

  function toggleWithFeedback(chore: Chore) {
    if (!chore.completed && chore.taskKind !== 'supply-purchase') {
      const xpByGroup = { daily: 10, weekly: 30, monthly: 60, yearly: 100 } as const;
      const group = chore.recurrenceGroup ?? 'daily';
      setCelebration({ title: chore.title, xp: viewMode === 'quest' ? xpByGroup[group] : undefined });
      navigator.vibrate?.(35);
    }
    onToggle(chore.id);
  }

  return (
    <main className="screen today-screen">
      <header className="home-header">
        <div><span className="eyebrow">{householdName}</span><h1>오늘도 산뜻하게!</h1></div>
        <button className="icon-button" aria-label="알림 설정 보기" aria-expanded={showReminder} onClick={() => setShowReminder((visible) => !visible)} type="button">🔔</button>
      </header>
      {showReminder && <section className="reminder-card" aria-label="알림 설정"><div><strong>{reminderEnabled ? `매일 ${String(reminderHour).padStart(2, "0")}:00에 확인해요` : "집안일 리마인더가 꺼져 있어요"}</strong><p>현재는 앱에 들어왔을 때 해야 할 일을 안내해요.</p></div>{onReminderToggle && <button onClick={onReminderToggle} type="button">{reminderEnabled ? "끄기" : "켜기"}</button>}</section>}
      <section className="progress-card" aria-label={`오늘 집안일 ${progress}% 완료`}>
        <div><span>오늘의 집안일</span><strong>{completed}<small> / {chores.length}개 완료</small></strong></div>
        <div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><span>{progress}%</span></div>
      </section>
      <section className="task-section">
        <div className="section-heading"><h2>할 일</h2><span>{chores.length - completed}개 남았어요</span></div>
        {chores.length === 0 ? <EmptyTasks onAdd={onAdd} /> : viewMode === "quest" ? <QuestBoard chores={chores} onToggle={toggleWithFeedback} /> : <GroupedTodayTasks chores={chores} onToggle={toggleWithFeedback} />}
      </section>
      {celebration && <CompletionFanfare title={celebration.title} xp={celebration.xp} />}
    </main>
  );
}

const recurrenceGroupMeta = {
  daily: { label: "매일·일 단위", icon: "☀️" },
  weekly: { label: "매주·주 단위", icon: "🗓️" },
  monthly: { label: "매월·월 단위", icon: "🌙" },
  yearly: { label: "매년 관리", icon: "🌿" },
} as const;

function GroupedTodayTasks({ chores, onToggle }: { chores: Chore[]; onToggle: (chore: Chore) => void }) {
  const groups = (Object.keys(recurrenceGroupMeta) as Array<keyof typeof recurrenceGroupMeta>)
    .map((group) => ({ group, chores: chores.filter((chore) => (chore.recurrenceGroup ?? chore.frequency) === group) }))
    .filter(({ chores: groupChores }) => groupChores.length > 0);
  return <div className="task-groups">{groups.map(({ group, chores: groupChores }, index) => {
    const completed = groupChores.filter((chore) => chore.completed).length;
    const meta = recurrenceGroupMeta[group];
    return <details className="task-group" key={group} open={index === 0}><summary><span aria-hidden="true">{meta.icon}</span><strong>{meta.label}</strong><small>{completed} / {groupChores.length} 완료</small><i aria-hidden="true">⌄</i></summary><ul className="task-list">{groupChores.map((chore) => chore.taskKind === 'supply-purchase' ? <li className={`supply-purchase-task ${chore.completed ? "is-completed" : ""}`} key={chore.id}><span className="supply-purchase-icon" aria-hidden="true">🛒</span><div className="task-copy"><span className="supply-purchase-badge">생활용품 · 구매 필요</span><strong>{chore.title.replace(/ 구매하기$/, '')}</strong><small>{chore.dueLabel ?? '구매할 시기예요'}</small></div><button aria-pressed={chore.completed} onClick={() => onToggle(chore)} type="button">{chore.completed ? '완료 취소' : '구매 완료'}</button></li> : <li className={chore.completed ? "is-completed" : ""} key={chore.id}><button className="task-check" aria-label={`${chore.title} ${chore.completed ? "완료 취소" : "완료"}`} aria-pressed={chore.completed} onClick={() => onToggle(chore)} type="button">{chore.completed ? "✓" : ""}</button><span className="task-icon" aria-hidden="true">{chore.icon}</span><div className="task-copy"><strong>{chore.title}</strong><small>{chore.dueLabel ?? chore.frequencyLabel} · {chore.category}</small></div></li>)}</ul></details>;
  })}</div>;
}

function QuestBoard({ chores, onToggle }: { chores: Chore[]; onToggle: (chore: Chore) => void }) {
  const order = Object.keys(recurrenceGroupMeta) as Array<keyof typeof recurrenceGroupMeta>;
  const groups = order.map((group) => ({
    group,
    chores: chores.filter((chore) => (chore.recurrenceGroup ?? chore.frequency) === group),
  }));
  const nextIncompleteGroup = groups.find(({ chores: groupChores }) => groupChores.some((chore) => !chore.completed))?.group ?? null;
  const [visibleGroup, setVisibleGroup] = useState<keyof typeof recurrenceGroupMeta | null>(nextIncompleteGroup);
  const visibleGroupData = groups.find(({ group }) => group === visibleGroup);

  useEffect(() => {
    if (!visibleGroupData) {
      if (visibleGroup !== nextIncompleteGroup) setVisibleGroup(nextIncompleteGroup);
      return;
    }
    if (visibleGroupData.chores.some((chore) => !chore.completed)) return;
    const timer = window.setTimeout(() => setVisibleGroup(nextIncompleteGroup), 1350);
    return () => window.clearTimeout(timer);
  }, [nextIncompleteGroup, visibleGroup, visibleGroupData]);

  const activeIndex = groups.findIndex(({ group }) => group === visibleGroup);
  const active = activeIndex >= 0 ? groups[activeIndex] : null;
  const questXp = { daily: 10, weekly: 30, monthly: 60, yearly: 100 } as const;
  const prefix = { daily: 'DAY', weekly: 'WEEK', monthly: 'MONTH', yearly: 'YEAR' } as const;

  return <div className="quest-board">
    <div className="quest-stage-track" aria-label="퀘스트 진행 단계">{groups.map(({ group, chores: groupChores }, index) => {
      const hasQuests = groupChores.length > 0;
      const isComplete = hasQuests && groupChores.every((chore) => chore.completed);
      const isActive = index === activeIndex;
      return <div className={`${isComplete ? 'is-complete' : ''} ${isActive ? 'is-active' : ''} ${!hasQuests ? 'is-empty' : ''}`} key={group}><span>{isComplete ? '✓' : index + 1}</span><small>{recurrenceGroupMeta[group].label.split('·')[0]}</small></div>;
    })}</div>
    {!active ? <section className="quest-victory"><span aria-hidden="true">🏆</span><strong>오늘의 모든 퀘스트 완료!</strong><p>우리 집을 위한 멋진 하루였어요.</p></section> : <>
      <header className="quest-chapter"><div><span>CHAPTER {activeIndex + 1}</span><h3>{recurrenceGroupMeta[active.group].icon} {recurrenceGroupMeta[active.group].label} 퀘스트</h3></div><small>{active.chores.filter((chore) => chore.completed).length}/{active.chores.length}</small></header>
      <div className="quest-cards">{active.chores.map((chore, index) => <article className={`quest-ticket ${chore.taskKind === 'supply-purchase' ? 'is-supply-purchase' : ''} ${chore.completed ? 'is-completed' : ''}`} key={chore.id}><header><span>{chore.taskKind === 'supply-purchase' ? 'SHOPPING' : `${prefix[active.group]}-${String(index + 1).padStart(2, '0')}`}</span><b>{chore.completed ? '완료' : chore.taskKind === 'supply-purchase' ? '구매 필요' : '진행 가능'}</b></header><div className="quest-ticket-body"><span className="quest-ticket-icon" aria-hidden="true">{chore.taskKind === 'supply-purchase' ? '🛒' : chore.icon}</span><div><strong>{chore.taskKind === 'supply-purchase' ? chore.title.replace(/ 구매하기$/, '') : chore.title}</strong><p>{chore.taskKind === 'supply-purchase' ? '생활용품 구매 업무' : `${chore.category} · ${chore.frequencyLabel}`}</p></div></div><footer><span>{chore.taskKind === 'supply-purchase' ? '구매하면 다음 시기를 계산해요' : <>보상 <b>+{questXp[active.group]} XP</b></>}</span><button aria-pressed={chore.completed} onClick={() => onToggle(chore)} type="button">{chore.completed ? '완료 취소' : chore.taskKind === 'supply-purchase' ? '구매 완료' : '퀘스트 완료'}</button></footer></article>)}</div>
      {activeIndex < groups.length - 1 && <p className="quest-unlock-note">🔒 현재 퀘스트를 모두 완료하면 다음 단계가 열려요.</p>}
    </>}
  </div>;
}

function CompletionFanfare({ title, xp }: { title: string; xp?: number }) {
  return <div className="completion-fanfare" role="status" aria-live="polite"><div className="confetti" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index} style={{ '--confetti-drift': `${(index - 7) * 7}px`, '--confetti-rotation': `${index * 29}deg`, animationDelay: `${index * 18}ms`, backgroundColor: `hsl(${index * 47} 85% 60%)`, left: `${4 + index * 7}%` } as React.CSSProperties} />)}</div><div className="fanfare-burst" aria-hidden="true">✦</div><section><span aria-hidden="true">🎉</span><div><strong>{xp ? `퀘스트 완료! +${xp} XP` : '오늘의 집안일 완료!'}</strong><small>{title}</small></div></section></div>;
}

function EmptyTasks({ onAdd }: { onAdd?: () => void }) {
  return <div className="empty-state"><span aria-hidden="true">✨</span><strong>오늘 할 일을 모두 마쳤어요</strong><p>새로운 집안일을 직접 추가할 수도 있어요.</p>{onAdd && <button className="text-button" onClick={onAdd} type="button">집안일 추가</button>}</div>;
}

export interface ChoreManagerProps {
  chores: Chore[];
  onAdd: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (chore: Chore) => void;
  onDismissRecommendation?: (id: string) => void;
  onChangeFrequency?: (id: string, frequency: ChoreFrequency) => void;
  embedded?: boolean;
}

export function ChoreManager({ chores, onAdd, onDelete, onEdit, onDismissRecommendation, onChangeFrequency, embedded = false }: ChoreManagerProps) {
  const [filter, setFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('all');
  const [openChoreId, setOpenChoreId] = useState<string | null>(null);
  const visibleChores = filter === 'all' ? chores : chores.filter((chore) => chore.recurrenceGroup === filter);
  const content = <>
      <button className="add-card" onClick={onAdd} type="button"><span aria-hidden="true">＋</span><div><strong>새 집안일 추가</strong><small>반복 주기와 알림을 설정할 수 있어요</small></div><i aria-hidden="true">›</i></button>
      <div className="section-heading chore-list-heading"><div><h2>사용 중인 집안일</h2><p>항목을 누르면 주기와 사용 여부를 관리할 수 있어요.</p></div><span>총 {chores.length}개</span></div>
      <div className="chore-filter-tabs">{([['all', '전체'], ['daily', '매일'], ['weekly', '매주'], ['monthly', '매월'], ['yearly', '매년']] as const).map(([value, label]) => <button aria-pressed={filter === value} className={filter === value ? 'is-active' : ''} key={value} onClick={() => setFilter(value)} type="button">{label}</button>)}</div>
      <ul className="manage-list">
        {visibleChores.map((chore) => <li className={openChoreId === chore.id ? 'is-open' : ''} key={chore.id}><div className="manage-row"><span className="task-icon" aria-hidden="true">{chore.icon}</span><button aria-expanded={openChoreId === chore.id} className="manage-copy" onClick={() => { setOpenChoreId((id) => id === chore.id ? null : chore.id); onEdit?.(chore); }} type="button"><strong>{chore.title}{chore.isCustom && <em>직접 추가</em>}</strong><small><b>{chore.frequencyLabel}</b> · {chore.category}</small></button><span className="manage-chevron" aria-hidden="true">⌄</span></div>{openChoreId === chore.id && <div className="manage-panel"><label><span>반복 주기</span>{!chore.isCustom && onChangeFrequency ? <select aria-label={`${chore.title} 주기 변경`} onChange={(event) => onChangeFrequency(chore.id, event.target.value as ChoreFrequency)} value={chore.frequency === 'custom' ? 'weekly' : chore.frequency}><option value="daily">매일</option><option value="weekly">매주</option><option value="monthly">매월</option><option value="yearly">매년</option></select> : <strong>{chore.frequencyLabel}</strong>}</label>{!chore.isCustom && onDismissRecommendation && <button onClick={() => onDismissRecommendation(chore.id)} type="button">이 집안일 사용하지 않기</button>}{onDelete && chore.isCustom && <button className="is-danger" onClick={() => onDelete(chore.id)} type="button">직접 추가한 집안일 삭제</button>}</div>}</li>)}
      </ul>
      {!visibleChores.length && <div className="report-empty">이 주기에 등록된 집안일이 없어요.</div>}
    </>;
  return embedded ? <section className="manage-screen">{content}</section> : <main className="screen manage-screen"><header className="screen-header compact"><h1>집안일 관리</h1><p>우리 집에 필요한 일을 관리해보세요.</p></header>{content}</main>;
}

export interface CustomChoreInput {
  title: string;
  category: string;
  icon: string;
  frequency: ChoreFrequency;
  interval: number;
  notificationEnabled: boolean;
  notificationTime: string;
}

export interface CustomChoreModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (chore: CustomChoreInput) => void;
}

export function SupplyPurchaseModal({ open, itemName, unit, initialQuantity, onClose, onSubmit }: { open: boolean; itemName: string; unit: string; initialQuantity: number; onClose: () => void; onSubmit: (quantity: number) => void }) {
  const titleId = useId();
  const [quantity, setQuantity] = useState(String(initialQuantity));
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="bottom-sheet supply-purchase-sheet" aria-labelledby={titleId} aria-modal="true" role="dialog"><header><button aria-label="구매 입력 닫기" onClick={onClose} type="button">×</button><h2 id={titleId}>구매 완료 기록</h2><span /></header><form onSubmit={(event) => { event.preventDefault(); onSubmit(Math.max(1, Number(quantity))); }}><div className="purchase-product-summary"><span aria-hidden="true">🛒</span><div><small>구매한 생활용품</small><strong>{itemName}</strong></div></div><label className="purchase-quantity-field"><span>실제로 몇 {unit} 구매했나요?</span><div><input autoFocus inputMode="numeric" min="1" onChange={(event) => setQuantity(event.target.value)} onFocus={(event) => event.currentTarget.select()} required step="1" type="number" value={quantity} /><strong>{unit}</strong></div><small>입력한 수량을 기준으로 다음 구매 시기를 계산해요.</small></label><div className="purchase-modal-actions"><button onClick={onClose} type="button">취소</button><button type="submit">구매 완료</button></div></form></section></div>;
}

export function CustomChoreModal({ open, onClose, onSubmit }: CustomChoreModalProps) {
  const titleId = useId();
  const [form, setForm] = useState<CustomChoreInput>({ title: "", category: "기타", icon: "✨", frequency: "weekly", interval: 1, notificationEnabled: true, notificationTime: "09:00" });
  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onSubmit(form); }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="bottom-sheet" aria-labelledby={titleId} aria-modal="true" role="dialog">
        <header><button aria-label="닫기" onClick={onClose} type="button">×</button><h2 id={titleId}>집안일 추가</h2><span /></header>
        <form onSubmit={submit}>
          <label className="form-field"><span>집안일 이름</span><input autoFocus maxLength={30} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="예: 침구 먼지 털기" required value={form.title} /></label>
          <div className="form-row"><label className="form-field"><span>카테고리</span><select value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))}><option>청소</option><option>세탁</option><option>주방</option><option>반려동물</option><option>정리</option><option>기타</option></select></label><label className="form-field icon-field"><span>아이콘</span><select value={form.icon} onChange={(event) => setForm((value) => ({ ...value, icon: event.target.value }))}><option>✨</option><option>🧹</option><option>🧺</option><option>🧽</option><option>🐾</option><option>🌿</option></select></label></div>
          <fieldset className="form-field"><legend>반복 주기</legend><div className="frequency-tabs">{(["daily", "weekly", "monthly", "yearly", "custom"] as ChoreFrequency[]).map((frequency) => <label key={frequency}><input checked={form.frequency === frequency} name="frequency" onChange={() => setForm((value) => ({ ...value, frequency }))} type="radio" /><span>{{ daily: "매일", weekly: "매주", monthly: "매월", yearly: "매년", custom: "직접" }[frequency]}</span></label>)}</div></fieldset>
          {form.frequency === "custom" && <label className="form-field"><span>반복 간격</span><div className="inline-input"><span>매</span><input min={1} onChange={(event) => setForm((value) => ({ ...value, interval: Number(event.target.value) }))} type="number" value={form.interval} /><span>일마다</span></div></label>}
          <div className="notification-box"><label><div><strong>알림 받기</strong><small>해야 할 시간에 알려드려요</small></div><input checked={form.notificationEnabled} onChange={(event) => setForm((value) => ({ ...value, notificationEnabled: event.target.checked }))} role="switch" type="checkbox" /></label>{form.notificationEnabled && <input aria-label="알림 시간" onChange={(event) => setForm((value) => ({ ...value, notificationTime: event.target.value }))} type="time" value={form.notificationTime} />}</div>
          <button className="primary-button" type="submit">추가하기</button>
        </form>
      </section>
    </div>
  );
}

export type NavigationTab = "today" | "schedule" | "manage" | "report" | "profile";
export function BottomNavigation({ active, onChange }: { active: NavigationTab; onChange: (tab: NavigationTab) => void }) {
  const tabs: Array<{ id: NavigationTab; icon: string; label: string }> = [{ id: "today", icon: "✓", label: "오늘" }, { id: "schedule", icon: "▦", label: "일정" }, { id: "manage", icon: "☷", label: "집안일" }, { id: "report", icon: "▥", label: "리포트" }, { id: "profile", icon: "♙", label: "내 정보" }];
  return <nav className="bottom-nav" aria-label="주요 메뉴">{tabs.map((tab) => <button className={active === tab.id ? "is-active" : ""} aria-current={active === tab.id ? "page" : undefined} key={tab.id} onClick={() => onChange(tab.id)} type="button"><span aria-hidden="true">{tab.icon}</span>{tab.label}</button>)}</nav>;
}
