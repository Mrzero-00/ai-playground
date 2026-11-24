"""연구 보고서 (RESEARCH.md 루프 절차 3a). data/lab/<단계>/summary.json → data/lab/report.html (Artifact 로 올린다)
그리고 RESEARCH.md 의 결과 표를 갱신한다.
사용법: python3 scripts/lab/report.py
"""
import html, json, os, re
from datetime import datetime

import common as C
from run import STAGES

LABEL = {"tf": "봉", "K": "K", "W": "W", "shrink": "수렴", "flat": "수평", "target": "목표", "filt": "거르기", "entry": "진입", "side": "방향", "mode": "모드"}
TF = {"1d": "1일", "4h": "4시간", "1h": "1시간"}


def e(x):
    return html.escape(str(x))


def pct(x, sign=True):
    return "—" if x is None else f"{x * 100:{'+' if sign else ''}.1f}%"


def num(x):
    return "—" if x is None else f"{x:.2f}"


def cfg_text(c):
    if not c:
        return "쉼 (고를 칸 없음)"
    return " · ".join(TF.get(v, v) if k == "tf" else f"{LABEL.get(k, k)} {v}" for k, v in c.items())


def pill(ok, yes="통과", no="기각"):
    return f'<span class="pill {"ok" if ok else "no"}">{yes if ok else no}</span>'


def stage_state(stage):
    p = C.OUT / stage / "status.json"
    s = json.loads(p.read_text()) if p.exists() else {}
    if s.get("state") in ("running", "analyzing"):
        try:
            os.kill(s.get("pid"), 0)
        except (OSError, TypeError):
            s["state"] = "stopped"
    return s


def unit_section(res, u, i):
    cid = f"c{res['stage']}{i}"
    g = u["grid"]
    rows_main = [("워크포워드 (0.10%)", u["wf"], u["wf_hard"]), (f"기준선 {u['bench']}", u["bench_stats"], u["bench_hard"]), ("현물 봇", u["spot"], u["spot_hard"])]
    if u["bench"] == "F0":
        rows_main.append(("현물 봇 50% + 전략 50%", u["mix"], u["mix_hard"]))
    t_main = "".join(f"<tr><th>{e(n)}</th><td>{num(a['샤프'])}</td><td>{pct(a['연복리'])}</td><td>{pct(a['MDD'])}</td><td>{'—' if a.get('거래') is None else a['거래']}</td><td>{num(b['샤프'])}</td></tr>" for n, a, b in rows_main)
    crit = "".join(f"<li class=\"{'ok' if v else 'no'}\"><span class=\"mark\">{'○' if v else '×'}</span>{e(k)}</li>" for k, v in u["criteria"].items())
    picks = "".join(f"<tr><th>{e(p['from'][:7])}~</th><td class=\"cfg\">{e(cfg_text(p['cfg']))}</td><td>{num(p['train_sharpe'])}</td></tr>" for p in u["picks"])
    years = "".join(f"<tr><th>{e(y)}</th><td>{pct(v['전략'])}</td><td>{pct(v['기준선'])}</td><td>{pct(v['현물봇'])}</td></tr>" for y, v in u["by_year"].items())
    b = u["bear"]
    years += f"<tr class=\"sum\"><th>하락 구간 {b['날수']}일</th><td>{pct(b['전략'])}</td><td>{pct(b['기준선'])}</td><td>{pct(b['현물봇'])}</td></tr>"
    q = g["분위"] or {}
    dist = " · ".join(f"{k} {num(v)}" for k, v in q.items())
    marg = ""
    for key, vals in u["marginal"].items():
        cells = "".join(f"<span class=\"mv\"><b>{e(TF.get(v, v))}</b> {num(s['중앙값'])} <small>{s['양수'] * 100:.0f}%</small></span>" for v, s in vals.items())
        marg += f"<tr><th>{e(LABEL.get(key, key))}</th><td>{cells}</td></tr>"
    best, dflt = g["최고 칸"], g["기본값"]
    return f"""
<section class="unit" id="{e(res['stage'])}-{i}">
  <div class="unit-head"><h3>{e(res['name'])} · {e(u['name'])}</h3>{pill(u['passed'], '통과 · 참고용' if res.get('late') else '통과')}</div>
  <p class="lede">{u['cells']:,}칸을 돌렸다. 워크포워드 샤프 <b>{num(u['wf']['샤프'])}</b>, 같은 구간 기준선 {e(u['bench'])} <b>{num(u['bench_stats']['샤프'])}</b>.
  격자 칸 중 시험 구간 샤프가 0 보다 큰 칸 <b>{g['양수 비율'] * 100:.0f}%</b>, 기준선보다 높은 칸 <b>{g['기준선 초과 비율'] * 100:.1f}%</b>.</p>
  <div class="grid2">
    <div><h4>판정 기준</h4><ul class="crit">{crit}</ul></div>
    <div><h4>성적 ({e(res['window'][0])} ~ {e(res['window'][1])})</h4>
      <div class="scroll"><table class="num"><thead><tr><th></th><th>샤프</th><th>연복리</th><th>MDD</th><th>거래</th><th>0.25% 샤프</th></tr></thead><tbody>{t_main}</tbody></table></div>
      <p class="note">현물 봇과의 상관 {num(u['corr_spot'])}</p></div>
  </div>
  <h4>누적 수익 (워크포워드, 0.10%)</h4>
  <div class="chart" id="{cid}" data-key="{e(res['stage'])}:{i}"></div>
  <div class="grid2">
    <div><h4>해마다 고른 파라미터</h4><p class="note">그 해 전까지의 데이터로만 고른 칸. 해마다 바뀌면 안정된 규칙이 없다는 뜻이다.</p>
      <div class="scroll"><table class="num"><thead><tr><th>블록</th><th>고른 칸</th><th>훈련 샤프</th></tr></thead><tbody>{picks}</tbody></table></div>
      <p class="note">봉인 구간에 쓸 칸: {e(cfg_text(u['seal_pick']['cfg']))}</p></div>
    <div><h4>해마다 수익</h4>
      <div class="scroll"><table class="num"><thead><tr><th></th><th>전략</th><th>기준선</th><th>현물 봇</th></tr></thead><tbody>{years}</tbody></table></div>
      <p class="note">하락 구간 = 전날 BTC 종가가 200일선 아래인 날.</p></div>
  </div>
  <h4>격자 분포 (시험 구간 샤프)</h4>
  <p class="dist">{e(dist)}</p>
  <div class="scroll"><table class="num"><tbody>
    <tr><th>기본값</th><td class="cfg">{e(cfg_text(dflt['cfg']))}</td><td>샤프 {num(dflt['샤프'])} · 거래 {dflt['거래'] if dflt['거래'] is not None else '—'}</td></tr>
    <tr><th>최고 칸 (참고만)</th><td class="cfg">{e(cfg_text(best['cfg']))}</td><td>샤프 {num(best['샤프'])} · DSR {num(best['DSR'])}</td></tr>
  </tbody></table></div>
  <p class="note">최고 칸은 시험 구간을 보고 고른 것이라 쓰지 않는다. DSR 은 {u['cells']:,}번 시도한 것을 감안해 그 샤프가 진짜일 확률이다.</p>
  <h4>파라미터별 중앙값 샤프 <small>(양수 칸 비율)</small></h4>
  <div class="scroll"><table class="marg"><tbody>{marg}</tbody></table></div>
</section>"""


def build():
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    done, curves, overview, md, reported = [], {}, "", [], {}
    for stage in STAGES:
        st = stage_state(stage)
        p = C.OUT / stage / "summary.json"
        if st.get("state") == "done" and p.exists():
            res = json.loads(p.read_text())
            done.append(res)
            reported[stage] = st.get("finished")
    progress = ""
    for stage in STAGES:
        st = stage_state(stage)
        state = {"running": "돌리는 중", "analyzing": "판정 중", "done": "끝", "failed": "실패", "stopped": "멈춤"}.get(st.get("state"), "대기")
        prog = f" {st.get('done', 0)}/{st.get('total')}" if st.get("total") and st.get("state") == "running" else ""
        name = next((r["name"] for r in done if r["stage"] == stage), stage)
        progress += f"<li><b>{e(name)}</b> {e(state)}{e(prog)} <small>{e(st.get('updated', ''))}</small></li>"
    sections = ""
    for res in done:
        late = res.get("late", False)
        for i, u in enumerate(res["units"]):
            curves[f"{res['stage']}:{i}"] = u["curve"]
            overview += (f"<tr><th><a href=\"#{e(res['stage'])}-{i}\">{e(res['name'])}</a> <small>{e(u['name'])}{' · 참고용' if late else ''}</small></th><td>{u['cells']:,}</td>"
                         f"<td>{num(u['wf']['샤프'])} <small>/ {num(u['bench_stats']['샤프'])}</small></td><td>{pct(u['wf']['MDD'])}</td>"
                         f"<td>{num(u['wf_hard']['샤프'])}</td><td>{u['grid']['양수 비율'] * 100:.0f}%</td><td>{pill(u['passed'], '통과 · 참고용' if late else '통과')}</td></tr>")
            md.append(f"| {res['name']} | {u['name']} | {u['cells']:,} | {num(u['wf']['샤프'])} ({u['bench']} {num(u['bench_stats']['샤프'])}) | {pct(u['wf']['MDD'])} | "
                      f"{num(u['wf_hard']['샤프'])} | {u['grid']['양수 비율'] * 100:.0f}% | {'통과' if u['passed'] else '기각'}{' (참고용)' if late else ''} |")
            sections += unit_section(res, u, i)
        srcs = "".join(f"<li>{e(s)}</li>" for s in res["sources"])
        grid = "".join(f"<tr><th>{e(LABEL.get(k, k))}</th><td>{e(' · '.join(TF.get(str(v), str(v)) for v in vals))}</td></tr>" for k, vals in res["grid"].items())
        late_note = '<p class="note">봉인 해제 뒤 추가 — 참고용. 봉인 구간을 이미 연 뒤에 등록해 개발 판정만 했다. 통과해도 최종 후보가 될 수 없다.</p>' if late else ""
        sections = sections.replace(f'<section class="unit" id="{res["stage"]}-0">', f"""<section class="stage"><h2>{e(res['name'])}</h2>{late_note}
  <div class="grid2"><div><h4>출처</h4><ul class="src">{srcs}</ul></div><div><h4>격자 ({res['cells']:,}칸)</h4><div class="scroll"><table class="gridt"><tbody>{grid}</tbody></table></div></div></div></section>
<section class="unit" id="{res['stage']}-0">""", 1)
    hold, hp = "", C.OUT / "holdout.json"
    if hp.exists():
        h = json.loads(hp.read_text())
        rows = ""
        for i, u in enumerate(h["units"]):
            curves[f"holdout:{i}"] = u["curve"]
            extra = f"섞음 {num(u['섞음']['샤프'])} / 현물 봇 {num(u['현물봇']['샤프'])}" if u["route"] == "나" else f"0.25% {num(u['전략_0.25']['샤프'])} / {num(u['기준선_0.25']['샤프'])}"
            rows += (f"<tr><th>{e(u['name'])} <small>{e(u['unit'])} · 경로 {e(u['route'])}</small></th><td class=\"cfg\">{e(cfg_text(u['cfg']))}</td>"
                     f"<td>{num(u['전략']['샤프'])} <small>/ {num(u['기준선']['샤프'])}</small></td><td>{pct(u['전략']['연복리'])}</td><td>{pct(u['전략']['MDD'])}</td>"
                     f"<td>{u['전략']['거래']}</td><td>{e(extra)}</td><td>{pill(u['passed'], '최종 후보', '탈락')}</td></tr>")
        charts = "".join(f"<h4>{e(u['name'])} · {e(u['unit'])}</h4><div class=\"chart\" id=\"ch{i}\" data-key=\"holdout:{i}\"></div>" for i, u in enumerate(h["units"]))
        hold = (f"<section class=\"card\"><h4 style=\"margin-top:0\">봉인 구간 판정 ({e(h['window'][0])} ~ {e(h['window'][1])}, 연 날 {e(h['opened'][:16])})</h4>"
                f"<p class=\"note\">개발 단계를 통과한 것만, 2025-06-30 까지의 데이터로 고른 칸을 고정해 한 번 돌렸다. 경로 가 = 단독(샤프 > 기준선), 나 = 현물 봇 보완(섞은 샤프 > 현물 봇).</p>"
                f"<div class=\"scroll\"><table class=\"num\"><thead><tr><th>방법</th><th>고정한 칸</th><th>샤프 / 기준선</th><th>연복리</th><th>MDD</th><th>거래</th><th>참고</th><th>판정</th></tr></thead><tbody>{rows}</tbody></table></div>{charts}</section>")
    dsr, dp = "", C.OUT / "dsr.json"
    if dp.exists():  # 다중 검정 보정 (RESEARCH.md '다중 검정 보정 등록', scripts/lab/dsr.py)
        z, a = json.loads(dp.read_text()), 52 ** 0.5
        fam = "".join(f"<tr><th>{e(k)}</th><td>{f['N']}</td><td>{f['초과']['N_eff']:.0f}</td><td>{f['초과']['SR0'] * a:.2f}</td><td>{f['절대']['SR0'] * a:.2f}</td></tr>"
                      for k, f in z["families"].items())
        rows = "".join(f"<tr><th>{e(r['name'])} <small>{e(r['unit'])}{' · 참고용' if r['late'] else ''}</small></th><td>{num(r['절대']['연 SR'])}</td><td>{num(r['절대']['DSR'])}</td>"
                       f"<td>{num(r['초과']['연 SR'])}</td><td>{num(r['초과']['PSR'])}</td><td>{num(r['초과']['DSR'])}</td><td>{pill(r['보정 통과'], '보정 통과', '운과 구분 안 됨')}</td></tr>"
                       for r in sorted((r for r in z["units"] if r["passed"]), key=lambda r: -r["초과"]["DSR"]))
        best = max(z["units"], key=lambda r: r["초과"]["DSR"])
        dsr = (f"<section class=\"card\"><h4 style=\"margin-top:0\">다중 검정 보정 — 디플레이티드 샤프 ({e(z['made'][:16])})</h4>"
               f"<p class=\"note\">판정 단위 {len(z['units'])}개를 시험했으니 실력이 없어도 몇 개는 운으로 기준을 넘는다. 워크포워드 주간 수익 {z['T']}개로, 같은 모드 안에서 운으로 나올 가장 큰 샤프(SR0)를 빼고도 "
               f"기준선보다 나을 확률(초과 DSR)이 0.95 를 넘는지 본다(Bailey·López de Prado 2014). 초과는 전략 − 기준선 주간 수익이라, 덜 들고 있어 샤프만 높은 방법은 낮게 나온다. 개발·봉인 판정은 바꾸지 않는다. "
               f"전체에서 초과 DSR 이 가장 높은 단위는 {e(best['name'])} · {e(best['unit'])} ({num(best['초과']['DSR'])}).</p>"
               f"<div class=\"scroll\"><table class=\"num\"><thead><tr><th>모드 묶음</th><th>시험 수</th><th>유효 시험 수(초과)</th><th>운으로 나올 최고 초과 샤프(연)</th><th>운으로 나올 최고 샤프(연)</th></tr></thead><tbody>{fam}</tbody></table></div>"
               f"<div class=\"scroll\"><table class=\"num\"><thead><tr><th>개발 통과 단위</th><th>샤프(주간→연)</th><th>절대 DSR</th><th>초과 샤프(연)</th><th>초과 PSR</th><th>초과 DSR</th><th>보정</th></tr></thead><tbody>{rows}</tbody></table></div></section>")
    short, sp = "", C.OUT / "shortterm.json"
    if sp.exists():  # 단타 글 전략 (RESEARCH.md '단타 글 전략 등록', scripts/lab/shortterm.py)
        z = json.loads(sp.read_text())
        tfs = ["1분", "3분", "5분", "15분", "30분", "1시간", "2시간", "4시간", "12시간", "1일"]
        by = {}
        for c in z["cells"]:
            by.setdefault((c["rule"], c["param"], c["mode"]), {})[c["tf"]] = c
        def cell(c):
            a = c["0.10%"]["전체"]
            mark = " ✓" if c["통과"] else ""
            return f"<td title=\"샤프 {a['샤프']:.2f} · MDD {a['MDD'] * 100:.0f}% · 거래 {c['거래']:,} · 거래당 {(c['거래당'] or 0) * 100:.2f}%\">{a['연복리'] * 100:+.0f}%<small> {a['샤프']:.2f}</small>{mark}</td>"
        rows = "".join(f"<tr><th>{e(k[0])} <small>{e(k[1])} · {e(k[2])}</small></th>{''.join(cell(v[t]) for t in tfs)}</tr>" for k, v in by.items())
        bm = z["bench"]
        b10, bh = bm["현물 봇 0.10%"]["전체"], bm["그냥 보유"]["전체"]
        short = (f"<section class=\"card\"><h4 style=\"margin-top:0\">단타 글 전략 — 봉 길이 10가지 ({e(z['window'][0])} ~ {e(z['window'][1])}, 바이낸스 현물 1분봉)</h4>"
                 f"<p class=\"note\">미트레이드 글의 RSI 30/70·5/20 골든크로스·볼린저 20/2 돌파(손절 2·3%)와 티스토리 글의 하이킨아시 + EMA 200 + 스토캐스틱 RSI(익절·손절 두 해석, 롱만·롱숏). 칸 = 연복리 · 작은 글씨 샤프, 편도 0.10%. ✓ 는 판정 통과(현물 봇보다 샤프 높고 MDD 5%p 이내 · 0.25% 에서도 · 거래 30회+). "
                 f"같은 기간 현물 봇 {b10['연복리'] * 100:+.0f}% · 샤프 {b10['샤프']:.2f} · MDD {b10['MDD'] * 100:.0f}%, 그냥 보유 {bh['연복리'] * 100:+.0f}% · 샤프 {bh['샤프']:.2f}. 칸에 마우스를 올리면 MDD·거래 수·거래당 수익(비용 전).</p>"
                 f"<div class=\"scroll\"><table class=\"num\"><thead><tr><th>규칙</th>{''.join(f'<th>{t}</th>' for t in tfs)}</tr></thead><tbody>{rows}</tbody></table></div></section>")
    reg, rp = "", C.OUT / "regime.json"
    if rp.exists():  # 장 판별·전환 감지 (RESEARCH.md '장 판별·전환 감지 등록', scripts/lab/regime.py)
        z = json.loads(rp.read_text())
        g = "확인 (다른 코인 10개)"
        pc = lambda x: "—" if x is None else f"{x * 100:.0f}%"
        a3, a2 = z["A3"][g], z["A2"][g]["30%"]
        names = [n for n in a2 if a2[n]]
        rowsA = "".join(f"<tr><th>{e(n)}</th><td>{pc(a3[n]['균형 정확도']) if n in a3 else '—'}</td><td>{pc(a3[n]['전환 뒤 30일']) if n in a3 else '—'}</td>"
                        f"<td>{pc(a2[n]['균형 정확도'])}</td><td>{pc(a2[n]['전환 뒤 30일'])}</td><td>{pc(z['hold'][g][n]['연복리'])}</td><td>{num(z['hold'][g][n]['샤프'])}</td><td>{pc(z['hold'][g][n]['MDD'])}</td></tr>" for n in names)
        for n in ("사후 라벨 λ 30% (미래를 본 상한)", "그냥 보유"):
            h = z["hold"][g][n]
            rowsA += f"<tr><th>{e(n)}</th><td>—</td><td>—</td><td>—</td><td>—</td><td>{pc(h['연복리'])}</td><td>{num(h['샤프'])}</td><td>{pc(h['MDD'])}</td></tr>"
        b = z["B"][g]["30%"]
        def brow(side, n, r):
            mult = "—" if r["배수"] is None else f"{r['배수']:.2f}"
            lead = "—" if r["선행중앙"] is None else f"{r['선행중앙']:.0f}일"
            head = "바닥 (하락→상승)" if side == "바닥" else "꼭대기 (상승→하락)"
            return (f"<tr><th>{head} · {e(n)}</th><td>{r['켜짐']:,}</td><td>{pc(r['적중률'])}</td><td>{pc(r['기준'])}</td><td>{mult}</td>"
                    f"<td>{r['잡음']}/{r['전환']}</td><td>{lead}</td></tr>")
        rowsB = "".join(brow(side, n, r) for side in ("바닥", "꼭대기") for n, r in b[side].items())
        cand = ", ".join(z["후보"]) or "없음"
        reg = (f"<section class=\"card\"><h4 style=\"margin-top:0\">장 판별·전환 감지 — 확인용 코인 10개 (BNB·XRP·ADA·LTC·TRX·ETC·LINK·DOGE·XLM·SOL)</h4>"
               f"<p class=\"note\">정답은 지나고 나서 본 장(2상태: 고점·저점에서 30% 움직임, 3상태: 앞뒤 30일 수익). 판별기는 그날까지의 자료만, 등록한 기본값 그대로. 3상태는 늘 '상승'만 찍으면 균형 정확도 33%. "
               f"목표(3상태 균형 정확도 90%)에 닿은 판별기는 없다. '상승일 때만 보유'는 코인별 중앙값, 편도 0.10%.</p>"
               f"<div class=\"scroll\"><table class=\"num\"><thead><tr><th>판별기</th><th>3상태 균형 정확도</th><th>3상태 전환 뒤 30일</th><th>2상태 균형 정확도</th><th>2상태 전환 뒤 30일</th><th>상승일 때만 보유 연복리</th><th>샤프</th><th>MDD</th></tr></thead><tbody>{rowsA}</tbody></table></div>"
               f"<p class=\"note\">전환 신호(30% 기준): 적중 = 켜진 날이 새 장 시작 45일 안, 헛경보 = 아직 옛 장. 기준 = 같은 실시간 상태의 아무 날. 선행 = 처음 적중한 날이 30% 확인보다 며칠 먼저. 후보 조건(적중률 ≥ 기준 × 1.5 · 잡은 비율 ≥ 50% · 선행 ≥ 0): {e(cand)}.</p>"
               f"<div class=\"scroll\"><table class=\"num\"><thead><tr><th>신호</th><th>켜짐</th><th>적중률</th><th>기준</th><th>배수</th><th>잡은 전환</th><th>선행 중앙</th></tr></thead><tbody>{rowsB}</tbody></table></div></section>")
    loop, lp = "", C.OUT / "regime_loop.json"
    if lp.exists():  # 장 판별 루프 (RESEARCH.md '장 판별 루프 등록', scripts/lab/regime_loop.py)
        z = json.loads(lp.read_text())
        rs = sorted(((int(k), n, v["찾기"][n]["균형 정확도"], r["균형 정확도"]) for k, v in z["iters"].items() for n, r in v["확인"].items()), key=lambda t: (t[0], -t[3]))
        rows = "".join(f"<tr><th>{k}회차 · {e(n)}</th><td>{a * 100:.1f}%</td><td>{b * 100:.1f}%</td></tr>" for k, n, a, b in rs)
        tz = z.get("test")
        test = (f"확인 기간 최고 {e(tz['판별기'])} 로 시험 기간(2024-07 ~)을 한 번 열었다: 균형 정확도 {tz['균형 정확도'] * 100:.1f}% — 동전 던지기보다 낮다." if tz else "시험 기간은 아직 열지 않았다.")
        loop = (f"<section class=\"card\"><h4 style=\"margin-top:0\">장 판별 루프 — 10회, BTC·ETH, 2상태(30%) 균형 정확도</h4>"
                f"<p class=\"note\">목표: 확인 기간(2022 ~ 2024-06) 80% 이상, 시험 기간에서도 80% 이상. 찾기 2018-08 ~ 2021. 회차마다 바꾼 이유는 RESEARCH.md. 80% 에 닿은 판별기는 없다. {test}</p>"
                f"<div class=\"scroll\"><table class=\"num\"><thead><tr><th>판별기</th><th>찾기</th><th>확인</th></tr></thead><tbody>{rows}</tbody></table></div></section>")
    loop2, lp2 = "", C.OUT / "regime_loop2.json"
    if lp2.exists():  # 장 판별 루프 2 (RESEARCH.md '장 판별 루프 2 등록', scripts/lab/regime_loop2.py)
        z = json.loads(lp2.read_text())
        rs = [(int(k), n, v["찾기"][n]["균형 정확도"], r["균형 정확도"]) for k, v in z["iters"].items() for n, r in v["확인"].items()]
        rs.sort(key=lambda t: (t[0], -t[3]))
        rows = "".join(f"<tr><th>{k}회차 · {e(n)}</th><td>{a * 100:.1f}%</td><td>{b * 100:.1f}%</td></tr>" for k, n, a, b in rs)
        tz, rw = z.get("test"), z["iters"].get("4", {}).get("무작위 걸음")
        test = (f"확인 최고 {e(tz['판별기'])} 로 새 시험 기간(2017년 이전)을 한 번 열었다: 균형 {tz['균형 정확도'] * 100:.1f}%." if tz else "새 시험 기간은 아직 열지 않았다.")
        rwt = f" 정답 정의에서 계산한 위치 규칙은 예측할 거리가 없는 무작위 걸음에서도 {rw * 100:.1f}% 가 나온다." if rw else ""
        loop2 = (f"<section class=\"card\"><h4 style=\"margin-top:0\">장 판별 루프 2 — 10회, BTC·ETH, Coin Metrics 종가 2010~</h4>"
                 f"<p class=\"note\">찾기 2018~2021, 확인 2022 ~ 2026-11, 새 시험 BTC 2011~2017·ETH 2016~2017(처음 보는 기간). 종가만 쓰는 판별기, 2상태(30%) 균형 정확도. 80% 에 닿은 판별기는 없다. {test}{rwt}</p>"
                 f"<div class=\"scroll\"><table class=\"num\"><thead><tr><th>판별기</th><th>찾기</th><th>확인</th></tr></thead><tbody>{rows}</tbody></table></div></section>")
    total = sum(r["cells"] for r in done)
    passed = [f"{r['name']} · {u['name']}" for r in done for u in r["units"] if u["passed"] and not r.get("late")]
    late_ok = [f"{r['name']} · {u['name']}" for r in done for u in r["units"] if u["passed"] and r.get("late")]
    head = (f"지금까지 {len(done)}개 방법, {total:,}칸을 시험했다. " + (f"개발 단계 통과: {', '.join(passed)}." if passed else "개발 단계를 통과한 방법은 아직 없다.")
            + (f" 봉인 해제 뒤 추가(참고용) 개발 통과: {', '.join(late_ok)}." if late_ok else "")) if done else "첫 단계를 돌리는 중이다."
    seal = f"열림 ({json.loads(C.SEAL.read_text())['at'][:16]})" if C.SEAL.exists() else "닫힘 — 2025-07-01 이후 데이터는 마지막에 한 번만 연다"
    page = TEMPLATE.replace("__NOW__", now).replace("__HEAD__", e(head)).replace("__SEAL__", e(seal)).replace("__PROGRESS__", progress) \
        .replace("__OVERVIEW__", overview or '<tr><td colspan="7">아직 끝난 단계가 없다.</td></tr>').replace("__SECTIONS__", hold + loop2 + loop + reg + short + dsr + sections) \
        .replace("__DATA__", json.dumps(curves, ensure_ascii=False))
    (C.OUT / "report.html").write_text(page)
    (C.OUT / "report.json").write_text(json.dumps(reported, ensure_ascii=False))
    doc = C.ROOT / "RESEARCH.md"
    table = ("| 방법 | 판정 단위 | 칸 | 워크포워드 샤프 (기준선) | MDD | 0.25% 샤프 | 격자 양수 비율 | 판정 |\n|---|---|---|---|---|---|---|---|\n" + "\n".join(md)) if md else "(아직 없음)"
    s = doc.read_text()
    s = re.sub(r"<!-- RESULTS:START -->.*<!-- RESULTS:END -->", f"<!-- RESULTS:START -->\n{now} 기준. 개발 구간 {C.BLOCKS[0][0]} ~ {C.BLOCKS[-1][1]}, 봉인 구간 {seal}. 자세한 것은 보고서.\n\n{table}\n<!-- RESULTS:END -->", s, flags=re.S)
    doc.write_text(s)
    print(head)


TEMPLATE = """<title>코인 예측 방법 탐색</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* 연구 노트: 왼쪽 정렬 한 단, 표가 본문. 숫자는 고정폭 */
:root {
  --bg: #f6f7f8; --panel: #ffffff; --fg: #15191d; --muted: #5b6570; --line: #dfe3e7;
  --accent: #1f5f8b; --ok: #0f7a3d; --ok-bg: #e2f3e8; --no: #b3261e; --no-bg: #fbe7e5;
  --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a;
  --sans: "IBM Plex Sans KR", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #121518; --panel: #1a1e22; --fg: #e8ebee; --muted: #9aa5b0; --line: #2c3238;
  --accent: #6fb3e0; --ok: #5fd08a; --ok-bg: #173323; --no: #ff8a80; --no-bg: #3a1c1a;
  --s1: #3987e5; --s2: #d95926; --s3: #199e70; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #121518; --panel: #1a1e22; --fg: #e8ebee; --muted: #9aa5b0; --line: #2c3238;
  --accent: #6fb3e0; --ok: #5fd08a; --ok-bg: #173323; --no: #ff8a80; --no-bg: #3a1c1a;
  --s1: #3987e5; --s2: #d95926; --s3: #199e70; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font: 15px/1.6 var(--sans); }
main { max-width: 1040px; margin: 0 auto; padding-block: 28px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 28px; }
h1 { font-size: 26px; margin: 0; text-wrap: balance; }
h2 { font-size: 21px; margin: 0; padding-top: 8px; border-top: 2px solid var(--fg); }
h3 { font-size: 17px; margin: 0; }
h4 { font-size: 12px; letter-spacing: .06em; color: var(--muted); margin: 18px 0 6px; font-weight: 500; }
small { color: var(--muted); font-weight: 400; }
a { color: var(--accent); }
.meta { color: var(--muted); font-size: 13px; display: flex; flex-wrap: wrap; gap: 4px 18px; }
.lede { margin: 6px 0 0; max-width: 72ch; }
.note { color: var(--muted); font-size: 13px; margin: 6px 0 0; max-width: 72ch; }
.rules { margin: 0; padding-left: 18px; max-width: 76ch; }
.rules li { margin: 2px 0; }
.progress { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; }
.unit, .card { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 18px; min-width: 0; }
.unit-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 0 28px; }
.grid2 > div { min-width: 0; }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
thead th { color: var(--muted); font-weight: 500; font-size: 12px; }
table.num td { font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
table.num th, table.num thead th { white-space: nowrap; }
td.cfg { font-family: var(--sans) !important; white-space: normal !important; }
tr.sum th, tr.sum td { border-top: 1px solid var(--fg); }
.marg td { display: flex; flex-wrap: wrap; gap: 4px 14px; font-family: var(--mono); font-size: 12px; }
.marg th { width: 70px; }
.mv b { font-family: var(--sans); font-weight: 500; }
.dist { font-family: var(--mono); font-size: 13px; margin: 0; }
.pill { display: inline-block; font-size: 12px; font-weight: 700; padding: 1px 9px; border-radius: 999px; }
.pill.ok { color: var(--ok); background: var(--ok-bg); }
.pill.no { color: var(--no); background: var(--no-bg); }
.crit { list-style: none; margin: 0; padding: 0; font-size: 14px; }
.crit li { display: flex; gap: 8px; padding: 3px 0; }
.crit .mark { width: 1.2em; font-weight: 700; }
.crit li.ok .mark { color: var(--ok); } .crit li.no .mark { color: var(--no); }
.src { margin: 0; padding-left: 18px; font-size: 13px; }
.chart { position: relative; width: 100%; }
.chart svg { display: block; width: 100%; height: auto; overflow: visible; }
.chart .axis { fill: var(--muted); font: 11px var(--mono); }
.chart .grid { stroke: var(--line); stroke-width: 1; }
.legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
.legend i { display: inline-block; width: 14px; height: 2px; vertical-align: middle; margin-right: 6px; }
.tip { position: absolute; pointer-events: none; background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 6px 9px; font: 12px/1.5 var(--mono); box-shadow: 0 2px 8px rgba(0,0,0,.12); white-space: nowrap; }
.tip[hidden] { display: none !important; }
</style>
<main>
  <header style="display:grid;gap:8px">
    <h1>코인 예측 방법 탐색</h1>
    <div class="meta"><span>갱신 __NOW__</span><span>봉인 구간: __SEAL__</span></div>
    <p class="lede">__HEAD__</p>
  </header>
  <section class="card">
    <h4 style="margin-top:0">어떻게 판정하나</h4>
    <ul class="rules">
      <li>과거 데이터는 시험에만 쓴다. 방법과 기본값은 문헌·웹에서 가져오고, 파라미터 격자는 돌리기 전에 RESEARCH.md 에 적었다.</li>
      <li><b>워크포워드</b>: 2022, 2023, 2024, 2025 상반기마다 그 전까지의 데이터로만 파라미터를 골라 그 해에 적용했다. 이 성적이 판정의 중심이다.</li>
      <li><b>격자 분포</b>: 한 칸만 좋으면 우연이다. 칸의 절반 이상이 0 보다 나아야 한다.</li>
      <li>2025-07-01 이후는 봉인해 두고, 개발 단계를 통과한 방법만 마지막에 한 번 연다.</li>
      <li>기준선: 선물은 F0(지금 봇 규칙을 선물 롱만으로), 현물은 지금 실전 봇. 비용 편도 0.10%, 견고성 0.25%. 바이낸스 BTC·ETH 무기한 실제 가격·펀딩비.</li>
    </ul>
  </section>
  <section>
    <h4 style="margin-top:0">진행</h4>
    <ul class="progress">__PROGRESS__</ul>
  </section>
  <section class="card">
    <h4 style="margin-top:0">요약</h4>
    <div class="scroll"><table class="num"><thead><tr><th>방법</th><th>칸</th><th>워크포워드 샤프 / 기준선</th><th>MDD</th><th>0.25% 샤프</th><th>격자 양수</th><th>판정</th></tr></thead>
    <tbody>__OVERVIEW__</tbody></table></div>
  </section>
  __SECTIONS__
</main>
<script>
const CURVES = __DATA__;
const SERIES = [["전략", "--s1", "전략 (워크포워드)"], ["기준선", "--s2", "기준선"], ["현물봇", "--s3", "현물 봇"]];
function draw(el) {
  const d = CURVES[el.dataset.key]; if (!d) return;
  const W = Math.max(el.clientWidth, 280), H = Math.round(Math.min(300, Math.max(200, W * 0.38))), m = {l: 44, r: 12, t: 8, b: 24};
  const all = SERIES.flatMap(s => d[s[0]]), lo = Math.min(...all), hi = Math.max(...all);
  const y0 = Math.floor(lo * 10) / 10, y1 = Math.ceil(hi * 10) / 10, n = d.dates.length;
  const x = i => m.l + (W - m.l - m.r) * i / (n - 1), y = v => m.t + (H - m.t - m.b) * (1 - (v - y0) / (y1 - y0 || 1));
  const step = (y1 - y0) > 2 ? 0.5 : (y1 - y0) > 0.8 ? 0.2 : 0.1;
  let g = "";
  for (let v = Math.ceil(y0 / step) * step; v <= y1 + 1e-9; v += step) g += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${v.toFixed(1)}</text>`;
  let lastYear = "";
  d.dates.forEach((t, i) => { const yr = t.slice(0, 4); if (yr !== lastYear) { lastYear = yr; g += `<text class="axis" x="${x(i)}" y="${H - 6}" text-anchor="start">${yr}</text>`; } });
  const cs = getComputedStyle(document.documentElement);
  const paths = SERIES.map(s => `<path d="${d[s[0]].map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join("")}" fill="none" stroke="${cs.getPropertyValue(s[1])}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
  const legend = SERIES.map(s => `<span><i style="background:var(${s[1]})"></i>${s[2]}</span>`).join("");
  el.innerHTML = `<div class="legend">${legend}</div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="누적 수익">${g}<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(1)}" y2="${y(1)}" style="stroke:var(--muted)"/>${paths}<line id="${el.id}-x" stroke="var(--muted)" stroke-width="1" y1="${m.t}" y2="${H - m.b}" visibility="hidden"/>${SERIES.map((s, k) => `<circle id="${el.id}-d${k}" r="4" fill="var(${s[1]})" stroke="var(--panel)" stroke-width="2" visibility="hidden"/>`).join("")}<rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent"/></svg><div class="tip" hidden></div>`;
  const svg = el.querySelector("svg"), tip = el.querySelector(".tip"), cx = el.querySelector(`#${el.id}-x`);
  svg.addEventListener("pointermove", ev => {
    const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * W / r.width;
    const i = Math.max(0, Math.min(n - 1, Math.round((px - m.l) / (W - m.l - m.r) * (n - 1))));
    cx.setAttribute("x1", x(i)); cx.setAttribute("x2", x(i)); cx.setAttribute("visibility", "visible");
    SERIES.forEach((s, k) => { const c = el.querySelector(`#${el.id}-d${k}`); c.setAttribute("cx", x(i)); c.setAttribute("cy", y(d[s[0]][i])); c.setAttribute("visibility", "visible"); });
    tip.innerHTML = `${d.dates[i]}<br>` + SERIES.map(s => `${s[2]} ${((d[s[0]][i] - 1) * 100).toFixed(1)}%`).join("<br>");
    tip.hidden = false;
    const left = x(i) * r.width / W; tip.style.left = Math.min(left + 12, r.width - tip.offsetWidth) + "px"; tip.style.top = "28px";
  });
  svg.addEventListener("pointerleave", () => { tip.hidden = true; cx.setAttribute("visibility", "hidden"); el.querySelectorAll("circle").forEach(c => c.setAttribute("visibility", "hidden")); });
}
const charts = [...document.querySelectorAll(".chart")];
charts.forEach(draw);
let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => charts.forEach(draw), 150); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => charts.forEach(draw));
new MutationObserver(() => charts.forEach(draw)).observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]});
</script>
"""

if __name__ == "__main__":
    build()
