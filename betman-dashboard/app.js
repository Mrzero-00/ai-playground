/* 승부예측 대시보드 — 읽기 전용 SPA. data/*.json 만 읽는다. */
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const cache = {};
async function load(name) {
  if (cache[name]) return cache[name];
  const r = await fetch(`data/${name}.json?v=${Date.now() >> 16}`);
  if (!r.ok) throw new Error(name);
  return (cache[name] = await r.json());
}
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const pct = (x, d = 0) => (x == null ? "-" : (x * 100).toFixed(d) + "%");
const won = (x) => (x == null ? "-" : Math.round(x).toLocaleString("ko-KR") + "원");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pill = (hit) => hit === "1" || hit === true ? '<span class="pill hit">적중</span>' : hit === "0" || hit === false ? '<span class="pill miss">실패</span>' : '<span class="pill wait">대기</span>';
let charts = [];
function chart(canvas, cfg) { const c = new Chart(canvas, cfg); charts.push(c); return c; }
function reset() { charts.forEach((c) => c.destroy()); charts = []; }
Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
function themeChart() { Chart.defaults.color = css("--muted"); Chart.defaults.borderColor = css("--line"); }

// ---------- 홈
async function home() {
  const s = await load("summary"), rec = await load("recommendations");
  const rounds = Object.entries(s.by_round);
  const up = rec.upcoming.slice(0, 6);
  const latest = rec.combos.filter((c) => !c.scored).slice(0, 6);
  app.innerHTML = `
  <h1>승부예측 대시보드</h1><p class="sub">${esc(s.mode)} · 갱신 ${esc(s.updated)}</p>
  <div class="grid">
    <div class="tile"><div class="k">추천 다리 적중률</div><div class="v">${pct(s.leg_rate)}</div><div class="d">채점 ${s.legs_scored}다리 · 목표 85%</div></div>
    <div class="tile"><div class="k">조합 성공률(2폴더+)</div><div class="v">${pct(s.combo_rate)}</div><div class="d">채점 ${s.combos_scored}조합 · 실투자 재개 기준 80%</div></div>
    <div class="tile"><div class="k">실투자 누적</div><div class="v">${won(s.payout - s.stake)}</div><div class="d">투입 ${won(s.stake)} → 회수 ${won(s.payout)}</div></div>
    <div class="tile"><div class="k">과정 점수(내용 적중)</div><div class="v">${s.process.total ? pct((s.process.quad["실력"] + s.process.quad["분산"]) / s.process.total) : "-"}</div><div class="d">실력 ${s.process.quad["실력"] || 0} · 운 ${s.process.quad["운"] || 0} · 분산 ${s.process.quad["분산"] || 0} · 오판 ${s.process.quad["오판"] || 0}</div></div>
  </div>
  <h2>회차별 추천 다리 적중</h2><div class="card"><div class="chart"><canvas id="c1"></canvas></div></div>
  <h2>진행 중·예정 추천</h2>
  ${latest.length || up.length ? "" : '<div class="empty">진행 중인 추천이 없습니다.</div>'}
  ${latest.map(comboCard).join("")}
  ${up.map((u) => `<div class="card"><b>${esc(u.round)}회 ${esc(u.combo)}</b> <span class="pill wait">${esc(u.status)}</span><div class="small">${esc(u.legs)} · 마감 ${esc(u.close)} · 점검 ${esc(u.check)}</div></div>`).join("")}
  <h2>현행 최우선 규칙</h2><div class="card"><ul class="small" style="margin:0;padding-left:18px">${s.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>`;
  themeChart();
  chart($("#c1"), { type: "bar", data: { labels: rounds.map(([k]) => k), datasets: [
    { label: "적중", data: rounds.map(([, v]) => v.hit), backgroundColor: css("--s3"), borderRadius: 4, barPercentage: 0.6 },
    { label: "실패", data: rounds.map(([, v]) => v.legs - v.pending - v.hit), backgroundColor: css("--s8"), borderRadius: 4, barPercentage: 0.6 },
    { label: "대기", data: rounds.map(([, v]) => v.pending), backgroundColor: css("--line"), borderRadius: 4, barPercentage: 0.6 }] },
    options: { maintainAspectRatio: false, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { precision: 0 } } }, plugins: { legend: { position: "bottom" } } } });
}
function comboCard(c) {
  const n = c.legs.length;
  const prob = c.legs.every((l) => l.prob != null) ? c.legs.reduce((a, l) => a * l.prob / 100, 1) : null;
  return `<div class="card"><div><b>${esc(c.round)}회 · ${esc(c.title)}</b> ${c.scored ? pill(c.hit) : '<span class="pill wait">진행</span>'} ${c.bought ? '<span class="pill">실구매</span>' : '<span class="pill">가상</span>'}
   <span class="small"> · ${n}폴더 ${c.odds}배${prob ? " · 적중 예상 " + pct(prob) : ""}</span></div>
   <ul class="legs">${c.legs.map((l) => `<li><span class="g">${esc(l.game)} <span class="m">${esc(l.time.slice(5, 16))}</span></span><span><b>${esc(l.pick)}</b> ${esc(l.type)}</span><span class="mono">${l.odds ?? "-"}배</span><span class="mono">${l.prob != null ? l.prob + "%" : ""}</span><span>${l.result ? esc(l.result) + " " : ""}${pill(l.hit)}</span></li>`).join("")}</ul></div>`;
}
// ---------- 추천
async function recs() {
  const r = await load("recommendations");
  const rounds = [...new Set(r.combos.map((c) => c.round))];
  app.innerHTML = `<h1>추천 조합</h1><p class="sub">가상·실구매 포함, 다리 단위 채점. 2폴더 이상 조합 성공률이 핵심 지표.</p>
  <div class="filters"><select id="f-round"><option value="">전체 회차</option>${rounds.map((x) => `<option>${esc(x)}</option>`).join("")}</select>
  <select id="f-state"><option value="">전체</option><option value="hit">적중</option><option value="miss">실패</option><option value="open">진행</option></select></div><div id="list"></div>`;
  const render = () => {
    const fr = $("#f-round").value, fs = $("#f-state").value;
    const xs = r.combos.filter((c) => (!fr || c.round === fr) && (!fs || (fs === "open" ? !c.scored : fs === "hit" ? c.scored && c.hit : c.scored && !c.hit)));
    $("#list").innerHTML = xs.length ? xs.map(comboCard).join("") : '<div class="empty">없음</div>';
  };
  $("#f-round").onchange = $("#f-state").onchange = render; render();
}
// ---------- 티켓
async function tickets() {
  const t = await load("tickets");
  const stake = t.reduce((a, x) => a + (x.stake || 0), 0), pay = t.reduce((a, x) => a + (x.payout || 0), 0);
  app.innerHTML = `<h1>티켓</h1><p class="sub">실제 구매 기록. 합계 투입 ${won(stake)} · 회수 ${won(pay)} · 손익 <b>${won(pay - stake)}</b></p>
  <div class="card"><div class="chart"><canvas id="c2"></canvas></div></div>
  <div class="tbl"><table><thead><tr><th>날짜</th><th>회차</th><th>티켓</th><th>구성</th><th class="num">배당</th><th class="num">금액</th><th>다리</th><th>결과</th><th class="num">회수</th></tr></thead>
  <tbody>${[...t].reverse().map((x) => `<tr><td>${esc(x.date)}</td><td>${esc(x.round)}</td><td>${esc(x.ticket)}</td><td>${esc(x.legs)}</td><td class="num">${esc(x.odds)}</td><td class="num">${won(x.stake)}</td><td>${esc(x.legs_hit)}</td><td>${x.result ? (x.result.includes("적중") || /등/.test(x.result) ? '<span class="pill hit">' : '<span class="pill miss">') + esc(x.result) + "</span>" : '<span class="pill wait">대기</span>'}</td><td class="num">${won(x.payout)}</td></tr>`).join("")}</tbody></table></div>`;
  themeChart();
  let cum = 0; const pts = t.filter((x) => x.stake).map((x) => { cum += (x.payout || 0) - (x.stake || 0); return { x: `${x.date.slice(5)} ${x.ticket}`, y: cum }; });
  chart($("#c2"), { type: "line", data: { labels: pts.map((p) => p.x), datasets: [{ label: "누적 손익(원)", data: pts.map((p) => p.y), borderColor: css("--s1"), backgroundColor: css("--s1"), borderWidth: 2, pointRadius: 3, tension: 0.2 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => won(c.parsed.y) } } }, scales: { x: { ticks: { maxRotation: 0, autoSkip: true } }, y: { ticks: { callback: (v) => (v / 10000).toFixed(0) + "만" } } } } });
}
// ---------- 과정 회고
async function process() {
  const p = await load("process"), s = await load("summary");
  const rounds = Object.keys(s.process.by_round);
  app.innerHTML = `<h1>과정 회고</h1><p class="sub">결과만이 아니라 경기 내용(xG·유효슈팅 우위)이 예측 쪽이었는지 본다. 실력(결과O 내용O) · 운(결과O 내용X) · 분산(결과X 내용O) · 오판(결과X 내용X)</p>
  <div class="card"><div class="chart"><canvas id="c3"></canvas></div></div>
  <div class="filters"><select id="f-r"><option value="">전체 회차</option>${rounds.map((x) => `<option>${esc(x)}</option>`).join("")}</select><select id="f-q"><option value="">4분면 전체</option>${["실력", "운", "분산", "오판"].map((x) => `<option>${x}</option>`).join("")}</select></div>
  <div class="tbl" id="pt"></div>`;
  themeChart();
  const q = ["실력", "운", "분산", "오판"], col = [css("--s3"), css("--s4"), css("--s1"), css("--s8")];
  chart($("#c3"), { type: "bar", data: { labels: rounds, datasets: q.map((k, i) => ({ label: k, data: rounds.map((r) => s.process.by_round[r][k] || 0), backgroundColor: col[i], borderRadius: 4, barPercentage: 0.6 })) },
    options: { maintainAspectRatio: false, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { precision: 0 } } }, plugins: { legend: { position: "bottom" } } } });
  const render = () => {
    const fr = $("#f-r").value, fq = $("#f-q").value;
    const xs = p.filter((x) => (!fr || x["회차"] === fr) && (!fq || x["4분면"] === fq));
    $("#pt").innerHTML = `<table><thead><tr><th>회차</th><th>경기</th><th>예측</th><th>결과</th><th>내용</th><th>4분면</th><th>요인검증</th><th>정합성</th></tr></thead><tbody>${xs.map((x) => `<tr><td>${esc(x["회차"])}</td><td>${esc(x["경기"])}</td><td>${esc(x["예측"])} ${esc(x["확률"])}%</td><td>${esc(x["결과"])} ${esc(x["점수"])}</td><td>${esc(x["지배"])} ${esc(x["내용근거"])}</td><td><span class="pill q${esc(x["4분면"])}">${esc(x["4분면"])}</span></td><td>${esc(x["요인검증"])}</td><td>${esc(x["정합성"])}</td></tr>`).join("")}</tbody></table>`;
  };
  $("#f-r").onchange = $("#f-q").onchange = render; render();
}
// ---------- 리그·팀
const LG_KO = { EPL: "프리미어리그", La_liga: "라리가", Serie_A: "세리에A", Bundesliga: "분데스리가", Ligue_1: "리그1" };
async function leagues(lg) {
  const s = await load("summary");
  lg = lg || s.leagues[0].name;
  const d = await load(`teams/${lg}`);
  app.innerHTML = `<h1>리그 · 팀</h1><p class="sub">지정 리그 팀 기록(Understat xG·ESPN 선발/슈팅). 갱신 ${esc(d.updated)}</p>
  <div class="filters">${s.leagues.map((l) => `<a class="pill ${l.name === lg ? "hit" : ""}" href="#league/${l.name}">${LG_KO[l.name] || l.name}</a>`).join("")}</div>
  <div class="tbl"><table><thead><tr><th>#</th><th>팀</th><th class="num">경기</th><th class="num">승점</th><th class="num">xPts</th><th class="num">xG</th><th class="num">xGA</th><th class="num">npxGD</th><th>운</th></tr></thead>
  <tbody>${d.teams.map((t, i) => `<tr><td>${i + 1}</td><td><a href="#team/${lg}/${t.id}">${esc(t.name)}</a></td><td class="num">${t.games}</td><td class="num">${t.pts}</td><td class="num">${t.xpts}</td><td class="num">${t.xg}</td><td class="num">${t.xga}</td><td class="num">${t.npxgd > 0 ? "+" : ""}${t.npxgd}</td><td>${t.pts - t.xpts > 2 ? '<span class="pill q운">운 좋음</span>' : t.xpts - t.pts > 2 ? '<span class="pill q분산">운 나쁨</span>' : '<span class="pill">적정</span>'}</td></tr>`).join("")}</tbody></table></div>`;
}
async function team(lg, id) {
  const d = await load(`teams/${lg}`); const t = d.teams.find((x) => String(x.id) === String(id));
  if (!t) { app.innerHTML = '<div class="empty">팀 없음</div>'; return; }
  const byF = {};
  t.recent.forEach((m) => { const f = m.opp_formation || "?"; const back = /^[35]/.test(f) ? "백3" : /^4/.test(f) ? "백4" : "?"; [back, f].forEach((k) => { const r = (byF[k] = byF[k] || { n: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }); const gf = +m.gf, ga = +m.ga; if (isNaN(gf)) return; r.n++; r.gf += gf; r.ga += ga; r[gf > ga ? "w" : gf === ga ? "d" : "l"]++; }); });
  app.innerHTML = `<p class="small"><a href="#league/${lg}">← ${LG_KO[lg] || lg}</a></p><h1>${esc(t.name)}</h1>
  <p class="sub">${t.games}경기 승점 ${t.pts} (xPts ${t.xpts}) · xG ${t.xg} / xGA ${t.xga} · npxGD ${t.npxgd > 0 ? "+" : ""}${t.npxgd}</p>
  <div class="row"><div class="card"><h3>경기별 xG · xGA</h3><div class="chart"><canvas id="c4"></canvas></div></div>
  <div class="card"><h3>포메이션(시간 비중)</h3>${t.formations.map((f) => `<div style="margin:6px 0"><div class="small">${esc(f.f)} · ${f.share}% · xG ${f.xg} / xGA ${f.xga}</div><div class="bar"><i style="width:${f.share}%;background:var(--s1)"></i></div></div>`).join("") || '<div class="empty">없음</div>'}
  <h3>상대 포메이션별 (ESPN 최근 ${t.recent.length}경기)</h3><div class="tbl"><table><thead><tr><th>상대</th><th class="num">경기</th><th>승무패</th><th class="num">득실</th></tr></thead><tbody>${Object.entries(byF).filter(([, r]) => r.n >= 2).sort((a, b) => b[1].n - a[1].n).map(([k, r]) => `<tr><td>${esc(k)}</td><td class="num">${r.n}</td><td>${r.w}승 ${r.d}무 ${r.l}패</td><td class="num">${r.gf}-${r.ga}</td></tr>`).join("")}</tbody></table></div></div></div>
  <div class="card"><h3>핵심 선수 (xG+xA 기여)</h3><div class="tbl"><table><thead><tr><th>선수</th><th>포지션</th><th class="num">경기</th><th class="num">분</th><th class="num">골</th><th class="num">xG</th><th class="num">xA</th><th class="num">기여</th></tr></thead><tbody>${t.players.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.pos)}</td><td class="num">${p.games}</td><td class="num">${p.min}</td><td class="num">${p.goals}</td><td class="num">${p.xg}</td><td class="num">${p.xa}</td><td class="num">${p.share}%</td></tr>`).join("")}</tbody></table></div></div>
  <div class="card"><h3>최근 경기 (ESPN)</h3><div class="tbl"><table><thead><tr><th>날짜</th><th>홈/원정</th><th>상대</th><th class="num">스코어</th><th class="num">슈팅(유효)</th><th>포메이션</th><th>상대 포메이션</th></tr></thead><tbody>${[...t.recent].reverse().map((m) => `<tr><td>${esc(m.date)}</td><td>${m.home ? "홈" : "원정"}</td><td>${esc(m.opp)}</td><td class="num">${esc(m.gf)}-${esc(m.ga)}</td><td class="num">${esc(m.shots)}(${esc(m.sot)}) : ${esc(m.shotsa)}(${esc(m.sota)})</td><td>${esc(m.formation)}</td><td>${esc(m.opp_formation)}</td></tr>`).join("")}</tbody></table></div></div>`;
  themeChart();
  chart($("#c4"), { type: "bar", data: { labels: t.history.map((h) => h.date.slice(5) + (h.ha === "h" ? " 홈" : " 원정")), datasets: [
    { label: "xG", data: t.history.map((h) => h.xg), backgroundColor: css("--s1"), borderRadius: 4, barPercentage: 0.7 },
    { label: "xGA", data: t.history.map((h) => h.xga), backgroundColor: css("--s2"), borderRadius: 4, barPercentage: 0.7 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { afterBody: (items) => { const h = t.history[items[0].dataIndex]; return `결과 ${h.gf}-${h.ga} ${h.res.toUpperCase()}`; } } } }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } }, y: { beginAtZero: true } } } });
}
// ---------- 라우팅
async function route() {
  reset();
  const h = (location.hash || "#home").slice(1).split("/");
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === (h[0].startsWith("league") || h[0] === "team" ? "leagues" : h[0])));
  try {
    if (h[0] === "recs") await recs(); else if (h[0] === "tickets") await tickets(); else if (h[0] === "process") await process();
    else if (h[0] === "leagues") await leagues(); else if (h[0] === "league") await leagues(h[1]); else if (h[0] === "team") await team(h[1], h[2]); else await home();
  } catch (e) { app.innerHTML = `<div class="empty">데이터를 불러오지 못했습니다 (${esc(e.message)})</div>`; }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
$("#theme").onclick = () => { const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); document.documentElement.dataset.theme = cur === "dark" ? "light" : "dark"; try { localStorage.setItem("theme", document.documentElement.dataset.theme); } catch (_) {} route(); };
try { const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; } catch (_) {}
route();
