import { useMemo, useState, type FormEvent } from 'react';
import type { Home, HomeProfile, HouseholdType, LocalUser, PetType } from '../domain/types';

interface HomeSettingsProps {
  home: Home;
  onCancel: () => void;
  onSave: (name: string, emoji: string, profile: HomeProfile) => void;
}

const householdLabels: Record<HouseholdType, string> = {
  single: '1인 가구',
  couple: '2인 가구',
  family: '가족 가구',
  shared: '공동 가구',
};

export function HomeSettings({ home, onCancel, onSave }: HomeSettingsProps) {
  const current = home.profile;
  const [name, setName] = useState(home.name);
  const [emoji, setEmoji] = useState(home.emoji);
  const [householdType, setHouseholdType] = useState<HouseholdType>(current?.householdType ?? 'single');
  const [memberCount, setMemberCount] = useState(current?.memberCount ?? 1);
  const [roomCount, setRoomCount] = useState(current?.roomCount ?? 1);
  const [bathroomCount, setBathroomCount] = useState(current?.bathroomCount ?? 1);
  const [petTypes, setPetTypes] = useState<PetType[]>(current?.petTypes ?? []);

  function togglePet(pet: PetType) {
    setPetTypes((types) => types.includes(pet) ? types.filter((type) => type !== pet) : [...types, pet]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(name, emoji, {
      householdType,
      memberCount,
      roomCount,
      bathroomCount,
      hasPets: petTypes.length > 0,
      petTypes,
      completed: true,
    });
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
          <h2>가구 형태</h2>
          <div className="settings-choice-grid">{(Object.keys(householdLabels) as HouseholdType[]).map((type) => <label className={householdType === type ? 'is-selected' : ''} key={type}><input checked={householdType === type} name="household" onChange={() => setHouseholdType(type)} type="radio" /><span>{householdLabels[type]}</span></label>)}</div>
          <NumberSetting label="함께 사는 사람" value={memberCount} suffix="명" onChange={setMemberCount} />
          <div className="settings-number-row"><NumberSetting label="방" value={roomCount} suffix="개" onChange={setRoomCount} /><NumberSetting label="화장실" value={bathroomCount} suffix="개" onChange={setBathroomCount} /></div>
        </section>
        <section className="settings-card">
          <h2>반려동물</h2>
          <div className="settings-choice-grid pet-grid"><label className={petTypes.includes('dog') ? 'is-selected' : ''}><input checked={petTypes.includes('dog')} onChange={() => togglePet('dog')} type="checkbox" /><span>🐶 강아지</span></label><label className={petTypes.includes('cat') ? 'is-selected' : ''}><input checked={petTypes.includes('cat')} onChange={() => togglePet('cat')} type="checkbox" /><span>🐱 고양이</span></label><label className={petTypes.includes('other') ? 'is-selected' : ''}><input checked={petTypes.includes('other')} onChange={() => togglePet('other')} type="checkbox" /><span>🐾 기타</span></label></div>
        </section>
        <p className="settings-help">설정을 바꾸면 기존 기록은 유지되고, 새 환경에 맞는 추천 집안일만 추가돼요.</p>
        <button className="primary-button" type="submit">집 설정 저장하기</button>
      </form>
    </main>
  );
}

function NumberSetting({ label, value, suffix, onChange }: { label: string; value: number; suffix: string; onChange: (value: number) => void }) {
  return <div className="number-setting"><span>{label}</span><div><button disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))} type="button">−</button><output>{value}{suffix}</output><button onClick={() => onChange(value + 1)} type="button">＋</button></div></div>;
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
