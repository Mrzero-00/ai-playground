/* 승부예측 대시보드 — 읽기 전용. data/*.json 만 읽는다. */
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const cache = {};
const BUST = Date.now();          // 로드할 때마다 새 토큰 — 브라우저·CDN 캐시를 지나친다
async function load(name) {
  if (cache[name]) return cache[name];
  const r = await fetch(`data/${name}.json?t=${BUST}`, { cache: "no-store" });
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
const won = (n) => n >= 100000000 ? (n/100000000).toFixed(1).replace(/\.0$/,"") + "억" : n >= 10000 ? Math.round(n/10000).toLocaleString() + "만" : n.toLocaleString();
function carryText(t) {
  if (!t) return "";
  const bits = [];
  if (t.carry_n > 0) bits.push(`<b class="carry">${t.carry_n}번 이월</b> ${t.carry_amt ? won(t.carry_amt) + "원" : ""}`);
  else if (t.carry_n === 0 && t.carry_at) bits.push('<span class="m">이월 없음</span>');
  if (t.sales) bits.push(`판매 ${won(t.sales)}원`);
  if (t.top_prize) bits.push(`1등 예상 ${won(t.top_prize)}원`);
  return bits.length ? " · " + bits.join(" · ") : "";
}
function totoCard(t, past) {
  const showRes = t.legs.some((l) => l.hit === "0" || l.hit === "1");
  const cell = (l, k) => {
    const mine = l.pick === k;
    const act = l.actual || "";
    const cls = act && act === k ? (act === l.pick ? " act-ok" : " act-no") : "";
    return `<td class="ck${cls}">${mine ? `<span class="ok">✓</span>${l.prob ? ` <span class="ln">${l.prob}%</span>` : ""}` : ""}</td>`;
  };
  const rows = t.legs.map((l) => `<tr>
    <td class="gm"><span class="m">${esc(l.no)}.</span> ${esc(l.game)}<div class="m">${esc(l.time.slice(5, 16))}${l.league ? " · " + esc(l.league) : ""}</div></td>
    <td class="ck an">${l.analyzed ? '<span class="ok">☑</span>' : '<span class="m">☐</span>'}</td>
    ${["승", "무", "패"].map((k) => cell(l, k)).join("")}
    ${showRes ? `<td class="num">${esc(l.score || "")}</td><td>${l.hit !== "" ? pill(l.hit) : '<span class="pill wait">대기</span>'}</td>` : ""}
  </tr>`).join("");
  return `<div class="card combo"><div class="chead"><b>${esc(t.round)}회 승무패 · ${esc(t.title)}</b>
    <span class="small">${t.n}경기 · 분석 ${t.analyzed_n}/${t.n}${t.done ? ` · ${t.hits}/${t.done} 적중` : ""}</span><span class="sp"></span>
    ${t.current ? `<span class="pill wait">진행</span>` : t.scored ? (t.hits >= 13 ? '<span class="pill hit">' : '<span class="pill miss">') + esc(t.result || `${t.hits}/${t.n}`) + "</span>" : '<span class="pill wait">채점 중</span>'}</div>
    <div class="small">${closeText(t.close)}${carryText(t)}</div>
    <div class="tbl"><table class="combo-tbl"><thead><tr>
      <th>경기</th><th class="ck">분석</th><th class="ck">승</th><th class="ck">무</th><th class="ck">패</th>
      ${showRes ? '<th class="num">결과</th><th>적중</th>' : ""}</tr></thead><tbody>${rows}</tbody></table>
    ${showRes ? '<div class="tnote"><span class="ok">✓</span> 내 마킹 · <span class="sw act-ok"></span> 실제 결과(맞음) · <span class="sw act-no"></span> 실제 결과(빗나감)</div>' : `<div class="tnote">☑ 분석 완료 · <span class="ok">✓</span> 내 마킹(옆 숫자는 내 확률)${t.analyzed_n < t.n ? ` · 나머지 ${t.n - t.analyzed_n}경기는 마감 2시간 전에 분석합니다` : ""}</div>`}</div>
    ${t.legs.filter((l) => l.why && !past).map((l) => `<div class="note"><div class="nh">${esc(l.no)}. ${esc(l.game)} — <b>${esc(l.pick)}</b></div>
      <div class="why"><span class="lbl">근거</span> ${esc(l.why)}</div></div>`).join("")}</div>`;
}

function pickCells(l, past) {
  const t = (l.type || "");
  const isUO = t.includes("언더오버") || /^(언더|오버)$/.test(l.pick);
  const line = (t.match(/`([^`]+)`/) || [])[1] || "";
  const act = past ? (l.actual || "") : "";           // 실제 결과 칸은 배경색으로 칠한다
  const tint = (k) => (act && act === k ? (act === l.pick ? " act-ok" : " act-no") : "");
  if (isUO) {
    const extra = act && act !== l.pick ? ` <span class="am">실제 ${esc(act)}</span>` : "";
    return `<td colspan="3" class="ck${act ? (act === l.pick ? " act-ok" : " act-no") : ""}"><b>${esc(l.pick)}</b> ${esc(line)}${extra}</td>`;
  }
  const mark = (k) => l.pick === k ? `<span class="ok">✓</span>${line && k !== "무" ? ` <span class="ln">${esc(line)}</span>` : ""}` : "";
  return ["승", "무", "패"].map((k) => `<td class="ck${tint(k)}">${mark(k)}</td>`).join("");
}
function comboTable(c, past) {
  const rows = c.legs.map((l) => `<tr>
    <td class="gm">${esc(l.game)}<div class="m">${esc(l.time.slice(5, 16))} · ${esc((l.type || "").replace(/`[^`]*`/, "").trim())}</div></td>
    ${pickCells(l, past)}
    <td class="num">${l.odds ?? "-"}</td>
    ${past ? `<td class="num">${esc(l.result || "-")}</td><td>${l.hit !== "" ? pill(l.hit) : '<span class="pill wait">대기</span>'}</td>` : ""}
  </tr>`).join("");
  return `<div class="tbl"><table class="combo-tbl"><thead><tr>
    <th>경기</th><th class="ck">승</th><th class="ck">무</th><th class="ck">패</th><th class="num">배당</th>
    ${past ? '<th class="num">결과</th><th>적중</th>' : ""}</tr></thead><tbody>${rows}</tbody></table>
    ${past ? '<div class="tnote"><span class="ok">✓</span> 내가 고른 방향 · <span class="sw act-ok"></span> 실제 결과(맞음) · <span class="sw act-no"></span> 실제 결과(빗나감)</div>' : ""}</div>`;
}
function legNotes(c, past) {
  return c.legs.map((l) => {
    const rv = l.review || {};
    const why = l.why || "";
    const rev = past && (rv.quad || rv.내용 || rv.content || rv.판정 || rv.배울점);
    if (!why && !rev && !l.risk) return "";
    return `<div class="note"><div class="nh">${esc(l.game)} — <b>${esc(l.pick)}</b> ${esc((l.type || "").replace(/`[^`]*`/, "").trim())}</div>
      ${why ? `<div class="why"><span class="lbl">추천 이유</span> ${esc(why)}</div>` : ""}
      ${l.risk && !past ? `<div class="why warn"><span class="lbl">변수</span> ${esc(l.risk)}</div>` : ""}
      ${rev ? `<div class="why"><span class="lbl">회고</span> ${quadPill(rv.quad)} ${esc(rv.판정 || "")} ${esc(rv.내용 || rv.content || "")}${rv.배울점 ? ` · 배울 점: ${esc(rv.배울점)}` : ""}</div>` : ""}
    </div>`;
  }).join("");
}
function comboCard(c, past) {
  const st = past ? (c.scored ? pill(c.hit) : '<span class="pill wait">결과 대기</span>') : '<span class="pill wait">진행</span>';
  return `<div class="card combo">
    <div class="chead"><b>${esc(c.round)}회 · ${esc(c.title)}</b>
      <span class="small">${c.n}폴더 · <b>${c.odds}배</b>${c.prob ? " · 적중 예상 " + pct(c.prob) : ""}</span>
      ${c.track === "도파민" ? '<span class="pill q운">도파민</span>' : ""}<span class="sp"></span>${st}${c.bought ? ' <span class="pill">실구매</span>' : ""}</div>
    <div class="small">${closeText(c.close)}</div>
    ${comboTable(c, past)}
    ${legNotes(c, past)}</div>`;
}

async function now() {
  const s = await load("summary"), r = await load("recommendations");
  app.innerHTML = `
  <h1>추천 조합</h1><p class="sub">${esc(s.mode)} · 갱신 ${esc(s.updated)}</p>
  <div class="grid two">
    <div class="tile big"><div class="k">단일 경기 방향 적중률</div><div class="v">${pct(s.dir_rate,1)}</div>
      <div class="d">분석한 ${s.dir_n}경기 · 목표 100%</div>
      <div class="d ref">같은 경기 시장 ${pct(s.dir_market,1)} <span class="gap ${s.dir_edge>=0?"up":"down"}">${s.dir_edge>=0?"+":""}${(s.dir_edge*100).toFixed(1)}p</span> <span class="m">참고선</span></div></div>
    <div class="tile big"><div class="k">조합 추천 적중률</div><div class="v">${pct(s.combo_rate,1)}</div>
      <div class="d">추천 ${s.combos_scored}조합 중 ${s.combos_hit}개 적중 · 목표 100%</div>
      <div class="d ref">추천 다리 ${pct(s.leg_rate,1)} (${s.legs_scored}다리)</div></div>
  </div>
  <div class="grid">
    <div class="tile"><div class="k">과정 점수</div><div class="v">${pct(s.process_score)}</div><div class="d">내용이 예측 쪽이었던 비율 · ${s.process_n}경기</div></div>
    <div class="tile"><div class="k">대조군(자동 채움)</div><div class="v">${pct(s.base_rate,1)}</div><div class="d">분석 없이 모델만 ${s.base_n}경기 · 분석이 더한 몫 ${((s.dir_rate-s.base_rate)*100).toFixed(1)}p</div></div>
    <div class="tile"><div class="k">추천 조합 총계</div><div class="v">${s.combos_total}</div><div class="d">진행 ${r.current.length} · 채점 ${s.combos_scored}</div></div>
  </div>
  ${s.edge_series && s.edge_series.length ? `<details class="card hblk"><summary><b>회차별 추이</b> <span class="small">방향 적중률과 참고선</span></summary>
    <div class="tbl"><table><thead><tr><th>회차</th><th class="num">분석 경기</th><th class="num">방향 적중률</th><th class="num">시장(참고)</th></tr></thead><tbody>
    ${s.edge_series.map((e)=>`<tr><td>${esc(e.round)}회</td><td class="num">${e.n}</td><td class="num"><b>${(e.me*100).toFixed(1)}%</b></td><td class="num m">${(e.market*100).toFixed(1)}%</td></tr>`).join("")}
    </tbody></table></div></details>` : ""}
  ${s.edge_by_league && s.edge_by_league.length ? `<details class="card hblk"><summary><b>리그별 방향 적중률</b> <span class="small">15경기 이상</span></summary>
    <div class="tbl"><table><thead><tr><th>리그</th><th class="num">경기</th><th class="num">방향 적중률</th><th class="num">시장(참고)</th></tr></thead><tbody>
    ${s.edge_by_league.map((e)=>`<tr><td>${esc(e.league)}</td><td class="num">${e.n}</td><td class="num"><b>${(e.me*100).toFixed(1)}%</b></td><td class="num m">${(e.market*100).toFixed(1)}%</td></tr>`).join("")}
    </tbody></table></div></details>` : ""}
  <h2>현재 진행 중</h2>
  ${r.current.filter((c)=>c.track!=="도파민").length ? r.current.filter((c)=>c.track!=="도파민").map((c) => comboCard(c, false)).join("") : '<div class="empty">진행 중인 코어 조합이 없습니다. 다음 블록 분석 시각에 추가됩니다.</div>'}
  ${(() => {
    const cur = (r.toto || []).filter((t) => t.current);
    if (cur.length) return `<h2>현재 진행 중 — 승무패</h2>` + cur.map((t) => totoCard(t, false)).join("");

    const pin = (r.toto || []).find((t) => t.pinned);
    if (pin) return `<h2>승무패 — 직전 회차 <span class="small">다음 회차가 열리면 교체됩니다</span></h2>` + totoCard(pin, true);
    return `<h2>현재 진행 중 — 승무패</h2><div class="empty">진행 중인 승무패 마킹이 없습니다. 마감 2시간 전 분석 뒤 올라옵니다.</div>`;
  })()}`;
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
async function history() {
  const hs = await load("history");
  const rounds = [...new Set(hs.map((h) => h.round))];
  app.innerHTML = `<h1>분석 기록</h1><p class="sub">추천이 나오지 않은 블록도 남깁니다. 무엇을 분석했고, 내 확률이 시장과 어땠고, 왜 뺐는지 블록마다 볼 수 있습니다.</p>
  <div class="filters"><select id="h-round"><option value="">전체 회차</option>${rounds.map((x) => `<option>${esc(x)}</option>`).join("")}</select>
  <select id="h-kind"><option value="">전체</option><option value="rec">추천 있음</option><option value="none">추천 없음</option><option value="done">분석 완료</option><option value="wait">예정</option></select></div>
  <div id="hlist"></div>`;
  const render = () => {
    const fr = $("#h-round").value, fk = $("#h-kind").value;
    const xs = hs.filter((h) => (!fr || h.round === fr) &&
      (!fk || (fk === "rec" ? h.combos.length : fk === "none" ? !h.combos.length && h.analyzed : fk === "done" ? h.state === "분석완료" : h.state !== "분석완료")));
    $("#hlist").innerHTML = xs.length ? xs.map(blockCard).join("") : '<div class="empty">없음</div>';
  };
  $("#h-round").onchange = $("#h-kind").onchange = render; render();
}
function blockCard(h) {
  const badge = h.combos.length
    ? h.combos.map((c) => `<span class="pill ${c.scored ? (c.hit ? "hit" : "miss") : "wait"}">${esc(c.title)} ${c.n}폴더 ${c.odds}배</span>`).join(" ")
    : (h.state === "분석완료" ? (h.analyzed ? '<span class="pill">추천 없음</span>' : '<span class="pill">분석 제외</span>') : '<span class="pill wait">예정</span>');
  const rows = h.games.map((g) => `<tr>
    <td class="mono">${esc(g.time.slice(0, 11))}</td><td>${esc(g.game)}<div class="m small">${esc(g.league)}</div></td>
    <td>${esc(g.mine) || '<span class="m">미분석</span>'}</td><td class="m">${esc(g.market)}</td>
    <td>${g.mine && g.market ? (g.agree ? '<span class="pill">일치</span>' : '<span class="pill q운">갈림</span>') : ""}</td>
    <td>${esc(g.result)} ${g.hit !== "" ? pill(g.hit) : ""}</td>
    <td class="small">${esc(g.why)}${g.skip ? `<div class="m">제외: ${esc(g.skip)}</div>` : ""}</td></tr>`).join("");
  return `<details class="card hblk"${h.combos.length ? " open" : ""}>
    <summary><b>${esc(h.round)}회 · ${esc(h.block)}</b>
      <span class="small">${esc(h.sports)} · 경기 ${h.n}${h.analyzed ? ` · 분석 ${h.analyzed}` : ""}${h.done ? ` · 1순위 ${h.hits}/${h.done}` : ""}</span>
      <span class="sp"></span>${badge}</summary>
    <div class="small hmeta">분석 ${esc(h.at)} · 마감 ${esc(h.close)}${h.memo ? ` · ${esc(h.memo)}` : ""}</div>
    <div class="tbl"><table><thead><tr><th>시각</th><th>경기</th><th>내 확률</th><th>시장</th><th></th><th>결과</th><th>근거 / 제외 이유</th></tr></thead><tbody>${rows}</tbody></table></div>
  </details>`;
}

function mdLite(t) {
  const esc2 = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const lines = t.split("\n"); const out = []; let tbl = [];
  const flush = () => { if (!tbl.length) return;
    const rows = tbl.filter((r) => !/^\|[\s|:-]+\|$/.test(r.trim()));
    const cells = rows.map((r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => esc2(c.trim())));
    if (cells.length) out.push(`<div class="tbl"><table><thead><tr>${cells[0].map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${cells.slice(1).map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    tbl = []; };
  for (const ln of lines) {
    if (ln.trim().startsWith("|")) { tbl.push(ln); continue; }
    flush();
    const h = ln.match(/^(#{1,4})\s+(.*)$/);
    if (h) { const lv = Math.min(h[1].length + 1, 5); out.push(`<h${lv}>${esc2(h[2])}</h${lv}>`); continue; }
    if (/^[-*]\s+/.test(ln.trim())) { out.push(`<li>${esc2(ln.trim().replace(/^[-*]\s+/, ""))}</li>`); continue; }
    if (!ln.trim()) { out.push(""); continue; }
    out.push(`<p>${esc2(ln)}</p>`);
  }
  flush();
  return out.join("\n").replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>");
}
async function retro(file) {
  const rs = await load("retros");
  if (file) {
    const r = rs.find((x) => x.file === decodeURIComponent(file));
    if (!r) { app.innerHTML = '<div class="empty">문서 없음</div>'; return; }
    app.innerHTML = `<p class="small"><a href="#retro">← 회고 목록</a></p>
      <h1>${esc(r.title)}</h1><p class="sub">${esc(r.kind)} · ${esc(r.date)}</p>
      <div class="card doc">${mdLite(r.body)}</div>`;
    return;
  }
  const s = await load("summary"), rec = await load("recommendations");
  const done = rec.past.filter((c) => c.scored);
  const rounds = [...new Set([...done.map((c) => c.round), ...rs.map((x) => x.round).filter(Boolean)])]
    .sort((a, b) => (parseInt(b) || 0) - (parseInt(a) || 0));
  app.innerHTML = `<h1>회고</h1><p class="sub">회차마다 추천한 조합을 그대로 놓고, 적중 여부와 회고 내용을 아래에 적습니다. 결과가 아니라 경기 내용(슈팅·xG·실제 선발)이 예측 쪽이었는지로 실력·운·분산·오판을 나눕니다.</p>
  <div class="grid">
    <div class="tile"><div class="k">과정 점수</div><div class="v">${pct(s.process_score)}</div><div class="d">내용이 예측 쪽이었던 비율 · ${s.process_n}경기</div></div>
    <div class="tile"><div class="k">조합 성공률</div><div class="v">${pct(s.combo_rate)}</div><div class="d">${s.combos_hit}/${s.combos_scored} 코어 조합</div></div>
    <div class="tile"><div class="k">다리 적중률</div><div class="v">${pct(s.leg_rate)}</div><div class="d">${s.legs_scored}다리 채점</div></div>
    <div class="tile"><div class="k">회고 문서</div><div class="v">${rs.length}</div><div class="d">심층·경기별 내용 회고</div></div>
  </div>
  <div class="filters"><select id="r-round"><option value="">전체 회차</option>${rounds.map((x) => `<option>${esc(x)}회</option>`).join("")}</select>
  <select id="r-state"><option value="">전체 조합</option><option value="hit">적중</option><option value="miss">실패</option></select></div>
  <div id="rlist"></div>`;
  const render = () => {
    const fr = ($("#r-round").value || "").replace("회", ""), fs = $("#r-state").value;
    const xs = rounds.filter((x) => !fr || x === fr).map((rd) => {
      const cs = done.filter((c) => c.round === rd && (!fs || (fs === "hit" ? c.hit : !c.hit)));
      const ds = rs.filter((x) => x.round === rd);
      return { rd, cs, ds };
    }).filter((g) => g.cs.length || (g.ds.length && !fs));
    $("#rlist").innerHTML = xs.map((g) => {
      const hit = g.cs.filter((c) => c.hit).length;
      return `<section class="rround"><h2>${esc(g.rd)}회 <span class="small">조합 ${hit}/${g.cs.length} 적중${g.ds.length ? ` · 회고 문서 ${g.ds.length}건` : ""}</span></h2>
      ${g.cs.length ? g.cs.map((c) => comboCard(c, true)).join("") : '<div class="empty">채점된 조합 없음</div>'}
      ${g.ds.map((d) => `<details class="card hblk"><summary><b>${esc(d.title)}</b> <span class="pill">${esc(d.kind)}</span><span class="sp"></span><span class="small">${esc(d.date)} · ${Math.round(d.chars / 100) / 10}천자</span></summary>
        <div class="doc">${mdLite(d.body)}</div></details>`).join("")}</section>`;
    }).join("") || '<div class="empty">없음</div>';
  };
  $("#r-round").onchange = $("#r-state").onchange = render; render();
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
    if (h[0] === "past") await past(); else if (h[0] === "history") await history();
    else if (h[0] === "retro") await retro(h[1]); else if (h[0] === "teams") await teams(h[1], h[2]); else await now();
  } catch (e) { app.innerHTML = `<div class="empty">데이터를 불러오지 못했습니다 (${esc(e.message)})</div>`; }
  window.scrollTo(0, 0);
}
async function stamp() {
  try { const s = await load("summary"); const el = $("#stamp"); if (el) el.textContent = "갱신 " + s.updated.slice(5); } catch (_) {}
}
$("#refresh").onclick = (e) => {   // 다시 그리기가 아니라 실제 페이지 리로드
  e.currentTarget.classList.add("spin");
  setTimeout(() => location.reload(), 120);   // 데이터는 no-store 로 받으므로 리로드면 항상 최신
};
window.addEventListener("hashchange", route);
$("#theme").onclick = () => { const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); document.documentElement.dataset.theme = cur === "dark" ? "light" : "dark"; try { localStorage.setItem("theme", document.documentElement.dataset.theme); } catch (_) {} };
try { const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; } catch (_) {}
route().then(stamp);
