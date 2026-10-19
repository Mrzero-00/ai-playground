/* 승부예측 대시보드 — 읽기 전용. data/*.json 만 읽는다. */
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const cache = {};
async function load(name) {
  if (cache[name]) return cache[name];
  const r = await fetch(`data/${name}.json?v=${Date.now() >> 16}`);
  if (!r.ok) throw new Error(name);
  return (cache[name] = await r.json());
}
const pct = (x, d = 0) => (x == null ? "-" : (x * 100).toFixed(d) + "%");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pill = (hit) => hit === "1" || hit === true ? '<span class="pill hit">적중</span>' : hit === "0" || hit === false ? '<span class="pill miss">실패</span>' : '<span class="pill wait">대기</span>';
const quadPill = (q) => (q ? `<span class="pill q${esc(q)}">${esc(q)}</span>` : "");
function closeText(c) {
  if (!c) return "";
  const d = new Date(c.replace(" ", "T") + ":00+09:00"); const diff = (d - Date.now()) / 60000;
  const when = c.slice(5, 16).replace("-", "/");
  if (isNaN(diff)) return `구매 마감 ${esc(c)}`;
  if (diff < 0) return `마감 ${when}`;
  const h = Math.floor(diff / 60), m = Math.round(diff % 60);
  return `<b>구매 마감 ${when}</b> (${h > 0 ? h + "시간 " : ""}${m}분 남음)`;
}
function totoCard(t, past) {
  return `<div class="card combo"><div class="chead"><b>${esc(t.round)}회 승무패 · ${esc(t.title)}</b>
    <span class="small">${t.n}경기${t.done ? ` · ${t.hits}/${t.done} 적중` : ""}</span><span class="sp"></span>
    ${t.current ? `<span class="pill wait">진행</span>` : t.scored ? (t.hits >= 13 ? '<span class="pill hit">' : '<span class="pill miss">') + esc(t.result || `${t.hits}/${t.n}`) + "</span>" : '<span class="pill wait">채점 중</span>'}</div>
    <div class="small">${closeText(t.close)}</div>
    <ul class="legs">${t.legs.map((l) => `<li><div class="lhead"><span class="g">${esc(l.no)}. ${esc(l.game)} <span class="m">${esc(l.time.slice(5, 16))}</span></span>
      <span class="pk"><b>${esc(l.pick)}</b>${l.prob ? ` <span class="m">${l.prob}%</span>` : ""}</span><span>${l.result ? esc(l.result) + " " : ""}${l.hit !== "" ? pill(l.hit) : ""}</span></div>
      ${l.why && !past ? `<div class="why"><span class="lbl">근거</span> ${esc(l.why)}</div>` : ""}</li>`).join("")}</ul></div>`;
}

function legRow(l, past) {
  const rv = l.review || {};
  return `<li>
    <div class="lhead"><span class="g">${esc(l.game)} <span class="m">${esc(l.time.slice(5, 16))}</span></span>
      <span class="pk"><b>${esc(l.pick)}</b> <span class="m">${esc(l.type)}</span></span>
      <span class="mono">${l.odds ?? "-"}배${l.prob != null ? ` · ${l.prob}%` : ""}</span>
      <span>${l.result ? esc(l.result) + " " : ""}${past ? pill(l.hit) : ""}</span></div>
    ${l.why ? `<div class="why"><span class="lbl">추천 이유</span> ${esc(l.why)}</div>` : ""}
    ${l.risk && !past ? `<div class="why warn"><span class="lbl">변수</span> ${esc(l.risk)}</div>` : ""}
    ${past && (rv.quad || rv.content || rv.판정 || rv.배울점) ? `<div class="rev">
      <div><span class="lbl">회고</span> ${quadPill(rv.quad)} ${esc(rv.판정 || "")}</div>
      ${rv.내용 || rv.content ? `<div class="m">경기 내용: ${esc(rv.내용 || rv.content)}</div>` : ""}
      ${rv.배울점 ? `<div class="m">배울 점: ${esc(rv.배울점)}</div>` : ""}</div>` : ""}
  </li>`;
}
function comboCard(c, past) {
  return `<div class="card combo">
    <div class="chead"><b>${esc(c.round)}회 · ${esc(c.title)}</b>
      <span class="small">${c.n}폴더 · ${c.odds}배${c.prob ? " · 적중 예상 " + pct(c.prob) : ""}</span>
      <span class="sp"></span>${past ? (c.scored ? pill(c.hit) : '<span class="pill wait">미채점</span>') : '<span class="pill wait">진행</span>'}${c.bought ? ' <span class="pill">실구매</span>' : ""}</div>
    <div class="small">${closeText(c.close)}</div>
    <ul class="legs">${c.legs.map((l) => legRow(l, past)).join("")}</ul></div>`;
}

async function now() {
  const s = await load("summary"), r = await load("recommendations");
  app.innerHTML = `
  <h1>추천 조합</h1><p class="sub">${esc(s.mode)} · 갱신 ${esc(s.updated)}</p>
  <div class="grid">
    <div class="tile"><div class="k">조합 성공률</div><div class="v">${pct(s.combo_rate)}</div><div class="d">${s.combos_hit}/${s.combos_scored} 조합 적중 · 재개 기준 80%</div></div>
    <div class="tile"><div class="k">다리 적중률</div><div class="v">${pct(s.leg_rate)}</div><div class="d">${s.legs_scored}다리 채점</div></div>
    <div class="tile"><div class="k">추천 조합 총계</div><div class="v">${s.combos_total}</div><div class="d">진행 ${r.current.length} · 채점 ${s.combos_scored}</div></div>
    <div class="tile"><div class="k">과정 점수</div><div class="v">${pct(s.process_score)}</div><div class="d">내용이 예측 쪽이었던 비율 · ${s.process_n}경기</div></div>
  </div>
  <h2>현재 진행 중 — 프로토</h2>
  ${r.current.length ? r.current.map((c) => comboCard(c, false)).join("") : '<div class="empty">진행 중인 프로토 추천 조합이 없습니다. 다음 블록 분석 시각에 추가됩니다.</div>'}
  <h2>현재 진행 중 — 승무패</h2>
  ${(r.toto || []).filter((t) => t.current).length ? (r.toto || []).filter((t) => t.current).map((t) => totoCard(t, false)).join("") : '<div class="empty">진행 중인 승무패 마킹이 없습니다. 마감 2시간 전 분석 뒤 올라옵니다.</div>'}`;
}
async function past() {
  const s = await load("summary"), r = await load("recommendations");
  const rounds = [...new Set([...r.past.map((c) => c.round), ...(r.toto || []).map((t) => t.round)])];
  const br = Object.entries(s.by_round);
  app.innerHTML = `<h1>지난 조합</h1><p class="sub">조합 단위 성공/실패와 회고. 회고는 결과만이 아니라 경기 내용(슈팅·xG·실제 선발)이 예측 쪽이었는지로 실력·운·분산·오판을 나눕니다.</p>
  <div class="grid">${br.map(([k, v]) => `<div class="tile"><div class="k">${esc(k)}회</div><div class="v">${v.hit}/${v.n}</div><div class="d">조합 적중</div></div>`).join("")}</div>
  <div class="filters"><select id="f-round"><option value="">전체 회차</option>${rounds.map((x) => `<option>${esc(x)}</option>`).join("")}</select>
  <select id="f-state"><option value="">전체</option><option value="hit">적중</option><option value="miss">실패</option></select></div><div id="list"></div>`;
  const render = () => {
    const fr = $("#f-round").value, fs = $("#f-state").value;
    const xs = r.past.filter((c) => (!fr || c.round === fr) && (!fs || (fs === "hit" ? c.scored && c.hit : c.scored && !c.hit)));
    const ts = (r.toto || []).filter((t) => !t.current && (!fr || t.round === fr) && (!fs || (fs === "hit" ? t.scored && t.hits >= 13 : t.scored && t.hits < 13)));
    $("#list").innerHTML = (xs.length || ts.length) ? xs.map((c) => comboCard(c, true)).join("") + (ts.length ? "<h2>승무패</h2>" + ts.map((t) => totoCard(t, true)).join("") : "") : '<div class="empty">없음</div>';
  };
  $("#f-round").onchange = $("#f-state").onchange = render; render();
}
async function teams(lg, id) {
  const s = await load("summary");
  lg = lg || s.leagues[0].name;
  const d = await load(`teams/${lg}`);
  const tabs = s.leagues.map((l) => `<a class="pill ${l.name === lg ? "hit" : ""}" href="#teams/${l.name}">${esc(l.ko)}</a>`).join("");
  if (id) {
    const t = d.teams.find((x) => String(x.id) === String(id));
    if (!t) { app.innerHTML = '<div class="empty">팀 없음</div>'; return; }
    const sec = (title, items) => items && items.length ? `<h3>${title}</h3><ul class="txt">${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
    app.innerHTML = `<p class="small"><a href="#teams/${lg}">← ${esc(d.ko)}</a></p><h1>${esc(t.name)}${t.ko ? ` <span class="small">${esc(t.ko)}</span>` : ""}</h1>
    <p class="sub">${t.nums ? `승점 ${t.nums.pts} (기대 ${t.nums.xpts}) · 경기당 xG ${t.nums.xg} / xGA ${t.nums.xga}` : ""}${t.formation ? ` · 주 포메이션 ${esc(t.formation)}` : ""}</p>
    <div class="card"><h3>컨디션·폼</h3><p>${esc(t.form) || "자료 없음"}</p>${t.lastxi ? `<p class="small">${esc(t.lastxi)}</p>` : ""}
    ${sec("부상·결장·징계", t.injuries) || "<h3>부상·결장·징계</h3><p class='small'>최근 3주 수집된 결장 정보 없음</p>"}
    ${sec("분위기·심리", t.mood) || ""}
    ${sec("일정·휴식", t.schedule) || ""}
    ${sec("메모", t.memo) || ""}</div>
    <p class="small">출처: 팀노트(조사 기록)·수집 자료(구단 공식·현지 매체, 날짜 표기)·Understat/ESPN 숫자. 선수 통계 나열 대신 상태 요약만 보여 줍니다.</p>`;
    return;
  }
  app.innerHTML = `<h1>팀 상태</h1><p class="sub">지정 리그 팀의 컨디션·부상·분위기 요약. 갱신 ${esc(d.updated)}</p><div class="filters">${tabs}</div>
  <div class="teams">${d.teams.map((t) => `<a class="team" href="#teams/${lg}/${t.id}"><div class="n">${esc(t.name)}${t.ko ? ` <span class="s">${esc(t.ko)}</span>` : ""}</div>
    <div class="s">${t.nums ? `승점 ${t.nums.pts} · 최근 ${esc(t.nums.res)}` : ""}</div>
    <div class="s">${t.injuries && t.injuries.length ? `결장·부상 ${t.injuries.length}건` : "결장 정보 없음"}${t.mood && t.mood.length ? " · 이슈 있음" : ""}</div></a>`).join("")}</div>`;
}
async function route() {
  const h = (location.hash || "#now").slice(1).split("/");
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === h[0]));
  try {
    if (h[0] === "past") await past(); else if (h[0] === "teams") await teams(h[1], h[2]); else await now();
  } catch (e) { app.innerHTML = `<div class="empty">데이터를 불러오지 못했습니다 (${esc(e.message)})</div>`; }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
$("#theme").onclick = () => { const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); document.documentElement.dataset.theme = cur === "dark" ? "light" : "dark"; try { localStorage.setItem("theme", document.documentElement.dataset.theme); } catch (_) {} };
try { const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; } catch (_) {}
route();
