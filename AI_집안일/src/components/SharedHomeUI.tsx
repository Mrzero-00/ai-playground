import { useId, useState, type CSSProperties, type FormEvent } from "react";

export interface SharedHomeMember {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  isCurrentUser?: boolean;
}

export interface SharedHome {
  id: string;
  name: string;
  emoji?: string;
  inviteCode?: string;
  memberCount: number;
  members?: SharedHomeMember[];
}

export interface CreateSharedHomeInput { name: string; emoji: string }

export interface SharedHomeUIProps {
  homes: SharedHome[];
  activeHomeId: string;
  onSelectHome: (homeId: string) => void;
  onCreateHome: (input: CreateSharedHomeInput) => void | Promise<void>;
  onJoinHome: (inviteCode: string) => void | Promise<void>;
  onOpenSettings?: () => void;
  disabled?: boolean;
}

type Panel = "list" | "create" | "join";

const ui: Record<string, CSSProperties> = {
  bar: { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", border: 0, borderRadius: 14, background: "#f4f6f8", color: "#191f28", textAlign: "left", cursor: "pointer" },
  dim: { position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.42)" },
  sheet: { width: "min(100%, 520px)", maxHeight: "86dvh", overflowY: "auto", padding: "10px 20px max(24px, env(safe-area-inset-bottom))", borderRadius: "24px 24px 0 0", background: "#fff", color: "#191f28" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 52 },
  list: { display: "grid", gap: 8, padding: 0, margin: "10px 0 18px", listStyle: "none" },
  home: { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: 14, border: "1px solid #e5e8eb", borderRadius: 14, background: "#fff", color: "inherit", textAlign: "left" },
  action: { width: "100%", minHeight: 50, border: 0, borderRadius: 14, background: "#3182f6", color: "#fff", fontWeight: 700 },
  secondary: { width: "100%", minHeight: 50, border: "1px solid #d1d6db", borderRadius: 14, background: "#fff", color: "#333d4b", fontWeight: 700 },
  field: { display: "grid", gap: 8, margin: "18px 0", fontWeight: 600 },
  input: { boxSizing: "border-box", width: "100%", minHeight: 50, padding: "0 14px", border: "1px solid #d1d6db", borderRadius: 12, font: "inherit" },
};

export function SharedHomeUI({ homes, activeHomeId, onSelectHome, onCreateHome, onJoinHome, onOpenSettings, disabled = false }: SharedHomeUIProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("list");
  const activeHome = homes.find((home) => home.id === activeHomeId) ?? homes[0];

  function close() { setOpen(false); setPanel("list"); }
  function select(id: string) { onSelectHome(id); close(); }

  return <section className="shared-home-ui" aria-label="현재 집">
    <button className="shared-home-ui__switcher" style={ui.bar} type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span aria-hidden="true" style={{ fontSize: 24 }}>{activeHome?.emoji ?? "🏠"}</span>
      <span style={{ flex: 1 }}><strong style={{ display: "block" }}>{activeHome?.name ?? "집을 만들어주세요"}</strong><small>{activeHome ? `${activeHome.memberCount}명이 함께하는 집` : "집을 만들거나 초대 코드로 참여해요"}</small></span>
      <span aria-hidden="true">⌄</span>
    </button>
    {open && <div className="shared-home-ui__backdrop" style={ui.dim} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="shared-home-ui__sheet" style={ui.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header style={ui.header}>
          {panel === "list" ? <span /> : <button type="button" aria-label="집 목록으로 돌아가기" onClick={() => setPanel("list")}>←</button>}
          <h2 id={titleId} style={{ margin: 0, fontSize: 20 }}>{panel === "list" ? "집 선택" : panel === "create" ? "새 집 만들기" : "초대 코드로 참여"}</h2>
          <button type="button" aria-label="닫기" onClick={close}>✕</button>
        </header>
        {panel === "list" && <HomeList homes={homes} activeHomeId={activeHomeId} onSelect={select} onCreate={() => setPanel("create")} onJoin={() => setPanel("join")} onSettings={onOpenSettings ? () => { close(); onOpenSettings(); } : undefined} />}
        {panel === "create" && <CreateHomeForm onSubmit={async (input) => { await onCreateHome(input); close(); }} />}
        {panel === "join" && <JoinHomeForm onSubmit={async (code) => { await onJoinHome(code); close(); }} />}
      </section>
    </div>}
  </section>;
}

function HomeList({ homes, activeHomeId, onSelect, onCreate, onJoin, onSettings }: { homes: SharedHome[]; activeHomeId: string; onSelect: (id: string) => void; onCreate: () => void; onJoin: () => void; onSettings?: () => void }) {
  return <>
    {homes.length === 0 ? <p role="status">아직 참여한 집이 없어요. 첫 번째 집을 만들어보세요.</p> : <ul style={ui.list}>
      {homes.map((home) => <li key={home.id}><button style={{ ...ui.home, borderColor: home.id === activeHomeId ? "#3182f6" : "#e5e8eb" }} type="button" aria-pressed={home.id === activeHomeId} onClick={() => onSelect(home.id)}>
        <span aria-hidden="true" style={{ fontSize: 28 }}>{home.emoji ?? "🏠"}</span><span style={{ flex: 1 }}><strong>{home.name}</strong><small style={{ display: "block" }}>구성원 {home.memberCount}명</small></span>{home.id === activeHomeId && <span aria-label="현재 선택됨">✓</span>}
      </button></li>)}
    </ul>}
    <MemberAvatars members={homes.find((home) => home.id === activeHomeId)?.members ?? []} />
    {homes.find((home) => home.id === activeHomeId)?.inviteCode && <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "#f4f6f8", textAlign: "center" }}><small style={{ display: "block", marginBottom: 5, color: "#6b7684" }}>함께 살 사람에게 알려줄 초대 코드</small><strong style={{ letterSpacing: 2 }}>{homes.find((home) => home.id === activeHomeId)?.inviteCode}</strong></div>}
    <div style={{ display: "grid", gap: 10, marginTop: 18 }}>{onSettings && homes.length > 0 && <button style={ui.secondary} type="button" onClick={onSettings}>⚙ 현재 집 설정 변경</button>}<button style={ui.action} type="button" onClick={onCreate}>＋ 새 집 만들기</button><button style={ui.secondary} type="button" onClick={onJoin}>초대 코드로 참여하기</button></div>
  </>;
}

export function MemberAvatars({ members, max = 5 }: { members: SharedHomeMember[]; max?: number }) {
  if (!members.length) return null;
  const visible = members.slice(0, max);
  return <section aria-label="집 구성원"><h3 style={{ fontSize: 15 }}>함께 사는 사람</h3><ul style={{ display: "flex", gap: 12, padding: 0, listStyle: "none", overflowX: "auto" }}>
    {visible.map((member) => <li key={member.id} style={{ minWidth: 54, textAlign: "center" }}><span title={member.name} style={{ display: "grid", placeItems: "center", width: 44, height: 44, margin: "auto", overflow: "hidden", borderRadius: "50%", background: "#e8f3ff", fontSize: 22 }}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" width="44" height="44" /> : <span aria-hidden="true">{member.avatarEmoji ?? "🙂"}</span>}</span><small>{member.isCurrentUser ? "나" : member.name}</small></li>)}
    {members.length > max && <li aria-label={`그 외 ${members.length - max}명`} style={{ alignSelf: "center" }}>+{members.length - max}</li>}
  </ul></section>;
}

function CreateHomeForm({ onSubmit }: { onSubmit: (input: CreateSharedHomeInput) => void | Promise<void> }) {
  const [name, setName] = useState(""); const [emoji, setEmoji] = useState("🏠"); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { await onSubmit({ name: name.trim(), emoji }); } finally { setBusy(false); } }
  return <form onSubmit={submit}><label style={ui.field}>집 이름<input style={ui.input} value={name} maxLength={20} required autoFocus placeholder="예: 행복한 우리 집" onChange={(e) => setName(e.target.value)} /></label><label style={ui.field}>집 아이콘<select style={ui.input} value={emoji} onChange={(e) => setEmoji(e.target.value)}><option>🏠</option><option>🏡</option><option>🏢</option><option>🏘️</option></select></label><button style={ui.action} disabled={busy || !name.trim()} type="submit">{busy ? "만드는 중…" : "집 만들기"}</button></form>;
}

function JoinHomeForm({ onSubmit }: { onSubmit: (code: string) => void | Promise<void> }) {
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { await onSubmit(code.trim().toUpperCase()); } finally { setBusy(false); } }
  return <form onSubmit={submit}><p>집을 만든 사람에게 받은 초대 코드를 입력해주세요.</p><label style={ui.field}>초대 코드<input style={{ ...ui.input, textTransform: "uppercase", letterSpacing: 2 }} value={code} minLength={4} maxLength={20} required autoFocus autoCapitalize="characters" autoComplete="off" placeholder="예: HOME1234" onChange={(e) => setCode(e.target.value)} /></label><button style={ui.action} disabled={busy || code.trim().length < 4} type="submit">{busy ? "참여하는 중…" : "집에 참여하기"}</button></form>;
}
