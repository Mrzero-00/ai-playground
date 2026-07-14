import { useId, useState, type FormEvent } from "react";

export type HouseholdType = "single" | "couple" | "family" | "shared";

export interface HouseholdProfile {
  householdType: HouseholdType;
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
  dueLabel?: string;
  completed: boolean;
  isCustom?: boolean;
}

export interface TodayTasksProps {
  chores: Chore[];
  householdName?: string;
  onToggle: (id: string) => void;
  onAdd?: () => void;
  reminderEnabled?: boolean;
  reminderHour?: number;
  onReminderToggle?: () => void;
}

export function TodayTasks({ chores, householdName = "우리 집", onAdd, onToggle, reminderEnabled = false, reminderHour = 9, onReminderToggle }: TodayTasksProps) {
  const [showReminder, setShowReminder] = useState(false);
  const completed = chores.filter((chore) => chore.completed).length;
  const progress = chores.length ? Math.round((completed / chores.length) * 100) : 0;

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
        {chores.length === 0 ? <EmptyTasks onAdd={onAdd} /> : (
          <ul className="task-list">
            {chores.map((chore) => (
              <li className={chore.completed ? "is-completed" : ""} key={chore.id}>
                <button className="task-check" aria-label={`${chore.title} ${chore.completed ? "완료 취소" : "완료"}`} aria-pressed={chore.completed} onClick={() => onToggle(chore.id)} type="button">{chore.completed ? "✓" : ""}</button>
                <span className="task-icon" aria-hidden="true">{chore.icon}</span>
                <div className="task-copy"><strong>{chore.title}</strong><small>{chore.dueLabel ?? chore.frequencyLabel} · {chore.category}</small></div>
                <span className="task-chevron" aria-hidden="true">›</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function EmptyTasks({ onAdd }: { onAdd?: () => void }) {
  return <div className="empty-state"><span aria-hidden="true">✨</span><strong>오늘 할 일을 모두 마쳤어요</strong><p>새로운 집안일을 직접 추가할 수도 있어요.</p>{onAdd && <button className="text-button" onClick={onAdd} type="button">집안일 추가</button>}</div>;
}

export interface ChoreManagerProps {
  chores: Chore[];
  onAdd: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (chore: Chore) => void;
}

export function ChoreManager({ chores, onAdd, onDelete, onEdit }: ChoreManagerProps) {
  return (
    <main className="screen manage-screen">
      <header className="screen-header compact"><h1>집안일 관리</h1><p>우리 집에 필요한 일을 관리해보세요.</p></header>
      <button className="add-card" onClick={onAdd} type="button"><span aria-hidden="true">＋</span><div><strong>새 집안일 추가</strong><small>반복 주기와 알림을 설정할 수 있어요</small></div><i aria-hidden="true">›</i></button>
      <div className="section-heading"><h2>등록된 집안일</h2><span>총 {chores.length}개</span></div>
      <ul className="manage-list">
        {chores.map((chore) => <li key={chore.id}><span className="task-icon" aria-hidden="true">{chore.icon}</span><button className="manage-copy" onClick={() => onEdit?.(chore)} type="button"><strong>{chore.title}{chore.isCustom && <em>직접 추가</em>}</strong><small>{chore.frequencyLabel} · {chore.category}</small></button>{onDelete && chore.isCustom && <button className="more-button" aria-label={`${chore.title} 삭제`} onClick={() => onDelete(chore.id)} type="button">×</button>}</li>)}
      </ul>
    </main>
  );
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

export type NavigationTab = "today" | "manage" | "profile";
export function BottomNavigation({ active, onChange }: { active: NavigationTab; onChange: (tab: NavigationTab) => void }) {
  const tabs: Array<{ id: NavigationTab; icon: string; label: string }> = [{ id: "today", icon: "✓", label: "오늘" }, { id: "manage", icon: "☷", label: "집안일" }, { id: "profile", icon: "♙", label: "내 정보" }];
  return <nav className="bottom-nav" aria-label="주요 메뉴">{tabs.map((tab) => <button className={active === tab.id ? "is-active" : ""} aria-current={active === tab.id ? "page" : undefined} key={tab.id} onClick={() => onChange(tab.id)} type="button"><span aria-hidden="true">{tab.icon}</span>{tab.label}</button>)}</nav>;
}
