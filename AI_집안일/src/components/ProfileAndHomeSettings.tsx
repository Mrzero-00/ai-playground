import { useMemo, useState, type FormEvent } from 'react';
import type { Home, HomeProfile, HouseholdType, HousingTenure, LocalUser, PetType } from '../domain/types';

interface HomeSettingsProps {
  home: Home;
  onCancel: () => void;
  onSave: (name: string, emoji: string, profile: HomeProfile, taskViewMode: 'todo' | 'quest') => void;
}

const householdLabels: Record<HouseholdType, string> = {
  single: '1인 가구',
  couple: '2인 가구',
  family: '가족 가구',
  shared: '공동 가구',
};
const tenureLabels: Record<HousingTenure, string> = { 'monthly-rent': '월세', jeonse: '전세', owned: '자가·매매' };
const petMeta: Record<PetType, string> = { dog: '🐶 강아지', cat: '🐱 고양이', fish: '🐠 물고기', bird: '🐦 새', 'small-animal': '🐹 소동물', reptile: '🦎 파충류', other: '🐾 기타' };

export function HomeSettings({ home, onCancel, onSave }: HomeSettingsProps) {
  const current = home.profile;
  const [name, setName] = useState(home.name);
  const [emoji, setEmoji] = useState(home.emoji);
  const [householdType, setHouseholdType] = useState<HouseholdType>(current?.householdType ?? 'single');
  const [housingTenure, setHousingTenure] = useState<HousingTenure>(current?.housingTenure ?? 'monthly-rent');
  const [memberCount, setMemberCount] = useState(current?.memberCount ?? 1);
  const [roomCount, setRoomCount] = useState(current?.roomCount ?? 1);
  const [bathroomCount, setBathroomCount] = useState(current?.bathroomCount ?? 1);
  const [childAges, setChildAges] = useState<number[]>(current?.childAges ?? []);
  const [petCounts, setPetCounts] = useState<Partial<Record<PetType, number>>>(() => current?.petCounts ?? Object.fromEntries((current?.petTypes ?? []).map((type) => [type, 1])));
  const [taskViewMode, setTaskViewMode] = useState<'todo' | 'quest'>(home.taskViewMode ?? 'todo');

  const petTypes = (Object.keys(petMeta) as PetType[]).filter((type) => (petCounts[type] ?? 0) > 0);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(name, emoji, {
      householdType,
      housingTenure,
      memberCount,
      roomCount,
      bathroomCount,
      hasPets: petTypes.length > 0,
      petTypes,
      petCounts,
      childAges,
      completed: true,
    }, taskViewMode);
  }

  return (
    <main className="screen home-settings-screen">
      <header className="settings-header"><button onClick={onCancel} type="button" aria-label="집 설정 닫기">‹</button><div><span className="step-label">현재 집 관리</span><h1>집 설정</h1></div><span /></header>
      <form onSubmit={submit}>
        <section className="settings-card">
          <h2>기본 정보</h2>
          <div className="form-row"><label className="form-field"><span>집 이름</span><input maxLength={20} required value={name} onChange={(event) => setName(event.target.value)} /></label><label className="form-field icon-field"><span>아이콘</span><select value={emoji} onChange={(event) => setEmoji(event.target.value)}><option>🏠</option><option>🏡</option><option>🏢</option><option>🏘️</option></select></label></div>
        </section>
        <section className="settings-card">
          <h2>집안일 표시 방식</h2>
          <div className="view-mode-grid"><label className={taskViewMode === 'todo' ? 'is-selected' : ''}><input checked={taskViewMode === 'todo'} name="viewMode" onChange={() => setTaskViewMode('todo')} type="radio" /><span aria-hidden="true">☑️</span><strong>Todo형</strong><small>목록에서 빠르게 확인해요</small></label><label className={taskViewMode === 'quest' ? 'is-selected' : ''}><input checked={taskViewMode === 'quest'} name="viewMode" onChange={() => setTaskViewMode('quest')} type="radio" /><span aria-hidden="true">🎯</span><strong>퀘스트형</strong><small>티켓을 단계별로 완료해요</small></label></div>
        </section>
        <section className="settings-card">
          <h2>거주 형태</h2>
          <div className="settings-choice-grid tenure-grid">{(Object.keys(tenureLabels) as HousingTenure[]).map((type) => <label className={housingTenure === type ? 'is-selected' : ''} key={type}><input checked={housingTenure === type} name="tenure" onChange={() => setHousingTenure(type)} type="radio" /><span>{tenureLabels[type]}</span></label>)}</div>
          <p className="settings-card-note">계약 일정, 집 상태 기록, 수선 점검처럼 거주 형태별 관리 항목을 추천해요.</p>
        </section>
        <section className="settings-card">
          <h2>가구 형태</h2>
          <div className="settings-choice-grid">{(Object.keys(householdLabels) as HouseholdType[]).map((type) => <label className={householdType === type ? 'is-selected' : ''} key={type}><input checked={householdType === type} name="household" onChange={() => setHouseholdType(type)} type="radio" /><span>{householdLabels[type]}</span></label>)}</div>
          <NumberSetting label="함께 사는 사람" value={memberCount} suffix="명" onChange={setMemberCount} />
          <div className="settings-number-row"><NumberSetting label="방" value={roomCount} suffix="개" onChange={setRoomCount} /><NumberSetting label="화장실" value={bathroomCount} suffix="개" onChange={setBathroomCount} /></div>
        </section>
        <section className="settings-card">
          <div className="settings-title-row"><div><h2>아이</h2><p>아이마다 현재 만 나이를 입력해 주세요.</p></div><button onClick={() => setChildAges((ages) => [...ages, 0])} type="button">＋ 아이 추가</button></div>
          {childAges.length === 0 ? <p className="settings-empty-detail">등록된 아이가 없어요.</p> : <div className="detail-list">{childAges.map((age, index) => <div className="detail-row" key={index}><strong>아이 {index + 1}</strong><label><span className="sr-only">아이 {index + 1} 만 나이</span><input aria-label={`아이 ${index + 1} 만 나이`} max="18" min="0" onChange={(event) => setChildAges((ages) => ages.map((item, itemIndex) => itemIndex === index ? Math.min(18, Math.max(0, Number(event.target.value))) : item))} type="number" value={age} /><span>세</span></label><button aria-label={`아이 ${index + 1} 삭제`} onClick={() => setChildAges((ages) => ages.filter((_, itemIndex) => itemIndex !== index))} type="button">삭제</button></div>)}</div>}
        </section>
        <section className="settings-card">
          <h2>반려동물 종류와 마릿수</h2>
          <div className="pet-count-list">{(Object.keys(petMeta) as PetType[]).map((type) => <NumberSetting key={type} label={petMeta[type]} min={0} value={petCounts[type] ?? 0} suffix="마리" onChange={(count) => setPetCounts((counts) => ({ ...counts, [type]: count }))} />)}</div>
        </section>
        <p className="settings-help">설정을 바꾸면 기존 기록은 유지되고, 새 환경에 맞는 추천 집안일만 추가돼요.</p>
        <button className="primary-button" type="submit">집 설정 저장하기</button>
      </form>
    </main>
  );
}

function NumberSetting({ label, value, suffix, min = 1, onChange }: { label: string; value: number; suffix: string; min?: number; onChange: (value: number) => void }) {
  return <div className="number-setting"><span>{label}</span><div><button disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} type="button">−</button><output>{value}{suffix}</output><button onClick={() => onChange(value + 1)} type="button">＋</button></div></div>;
}

interface PersonalProfileProps {
  user: LocalUser;
  homes: Home[];
  onSaveName: (name: string) => void;
}

export function PersonalProfile({ user, homes, onSaveName }: PersonalProfileProps) {
  const [name, setName] = useState(user.displayName);
  const personalCompletions = useMemo(
    () => homes.flatMap((home) => home.history).filter((entry) => entry.action === 'completed' && entry.performedByUserId === user.id).length,
    [homes, user.id],
  );
  const level = Math.floor(personalCompletions / 10) + 1;
  const progress = (personalCompletions % 10) * 10;
  const levelName = level >= 10 ? '살림 마스터' : level >= 5 ? '생활 루틴 전문가' : level >= 3 ? '부지런한 살림러' : '집안일 새싹';

  function submit(event: FormEvent) {
    event.preventDefault();
    onSaveName(name);
  }

  return (
    <main className="screen personal-profile-screen">
      <header className="screen-header compact"><span className="step-label">개인 계정</span><h1>내 정보</h1><p>내 활동과 집안일 성장을 확인하세요.</p></header>
      <section className="profile-identity"><span aria-hidden="true">🙂</span><form onSubmit={submit}><label htmlFor="profile-name">표시 이름</label><div><input id="profile-name" maxLength={15} required value={name} onChange={(event) => setName(event.target.value)} /><button type="submit">저장</button></div></form></section>
      <section className="level-card"><div className="level-badge"><span>LV.</span><strong>{level}</strong></div><div className="level-copy"><span>{levelName}</span><strong>나의 집안일 레벨</strong><div><i style={{ width: `${progress}%` }} /></div><small>다음 레벨까지 {10 - (personalCompletions % 10)}번 남았어요</small></div></section>
      <section className="personal-summary"><article><strong>{homes.length}</strong><span>참여 중인 집</span></article><article><strong>{personalCompletions}</strong><span>완료한 집안일</span></article></section>
      <section className="my-homes"><div className="section-heading"><h2>내가 참여한 집</h2><span>{homes.length}개</span></div>{homes.length ? <ul>{homes.map((home) => <li key={home.id}><span aria-hidden="true">{home.emoji}</span><div><strong>{home.name}</strong><small>{home.members.length}명 · {home.members.find((member) => member.userId === user.id)?.role === 'owner' ? '소유자' : '구성원'}</small></div></li>)}</ul> : <div className="report-empty">아직 참여한 집이 없어요.</div>}</section>
      <p className="level-policy">레벨은 내가 완료한 집안일 횟수를 기반으로 한 개인 성장 지표이며, 다른 사람과의 우열을 의미하지 않아요.</p>
    </main>
  );
}
