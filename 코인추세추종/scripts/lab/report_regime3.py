"""보고서의 '3상태 장 판별 루프' 칸 (scripts/lab/regime3.py 결과 → HTML). report.py 가 부른다."""
import html
import json
import math
from datetime import date

import common as C

PERIODS = ["2011~2017", "2018~2021", "2022~2026"]
GNAME = {2: "강한 상승장", 1: "상승장", 0: "횡보장", -1: "하락장", -2: "강한 하락장"}
W, HT, ML, MR, MT, MB = 1000, 250, 52, 8, 8, 36


def e(x):
    return html.escape(str(x))


def pc(x, sign=False):
    return "—" if x is None else (f"{x * 100:+.0f}%" if sign else f"{x * 100:.1f}%")


def fill(g):
    """상승은 --s2(따뜻한 색), 하락은 --s1(찬 색), 강할수록 진하게. 횡보는 칠하지 않는다."""
    if g in (0, 9):
        return None
    return f'fill="var({"--s2" if g > 0 else "--s1"})" fill-opacity="{0.36 if abs(g) == 2 else 0.16}"'


def svg(ch, title):
    d0, d1 = date.fromisoformat(ch["dates"][0]), date.fromisoformat(ch["dates"][-1])
    span = (d1 - d0).days + 1
    lo, hi = math.log(min(ch["price"])), math.log(max(ch["price"]))
    x = lambda d: ML + (date.fromisoformat(d) - d0).days / span * (W - ML - MR)
    y = lambda p: MT + (hi - math.log(p)) / (hi - lo) * (HT - MT - MB)
    out = [f'<svg viewBox="0 0 {W} {HT}" role="img" aria-label="{e(title)} 가격과 판별한 장">']
    for a, b, g in ch["판별"]:
        f = fill(g)
        if f:
            w = max(x(b) - x(a) + (W - ML - MR) / span, 0.8)
            out.append(f'<rect x="{x(a):.1f}" y="{MT}" width="{w:.1f}" height="{HT - MT - MB}" {f}><title>{a} ~ {b} {GNAME[g]}</title></rect>')
    k = 10 ** math.floor(math.log10(math.exp(lo)))
    ticks = [m * k * s for s in (1, 10, 100, 1000) for m in (1, 2, 5) if math.exp(lo) <= m * k * s <= math.exp(hi)]
    for t in ticks:
        out.append(f'<line class="grid" x1="{ML}" x2="{W - MR}" y1="{y(t):.1f}" y2="{y(t):.1f}"/><text class="axis" x="{ML - 6}" y="{y(t) + 4:.1f}" text-anchor="end">{t:,.0f}</text>')
    for yr in range(d0.year + (1 if (d0.month, d0.day) != (1, 1) else 0), d1.year + 1):
        xx = x(f"{yr}-01-01")
        out.append(f'<line class="grid" x1="{xx:.1f}" x2="{xx:.1f}" y1="{MT}" y2="{HT - MB}"/><text class="axis" x="{xx + 3:.1f}" y="{HT - 4}">{yr}</text>')
    pts = " ".join(f"{x(d):.1f},{y(p):.1f}" for d, p in zip(ch["dates"], ch["price"]))
    out.append(f'<polyline points="{pts}" fill="none" stroke="var(--fg)" stroke-width="1.6" stroke-linejoin="round"/>')
    sy = HT - MB + 4
    out.append(f'<rect x="{ML}" y="{sy}" width="{W - ML - MR}" height="9" fill="var(--line)" fill-opacity="0.6"/>')
    for a, b, g in ch["정답"]:
        if g in (0, 9):
            continue
        col, op = ("--s2" if g > 0 else "--s1"), (1 if abs(g) == 2 else 0.6)
        w = max(x(b) - x(a) + (W - ML - MR) / span, 0.8)
        out.append(f'<rect x="{x(a):.1f}" y="{sy}" width="{w:.1f}" height="9" fill="var({col})" fill-opacity="{op}"><title>정답 {a} ~ {b} {GNAME[g]}</title></rect>')
    out.append("</svg>")
    return "".join(out)


def section():
    p = C.OUT / "regime3.json"
    if not p.exists():
        return ""
    z = json.loads(p.read_text())
    rows = ""
    for k, v in sorted(z["iters"].items(), key=lambda t: int(t[0])):
        for n, r in v["methods"].items():
            rc = r["2022~2026"]["상태별"]
            rows += (f"<tr><th>{k}회차 · {e(n)}</th>" + "".join(f"<td>{pc(r[pn]['일치'])}</td>" for pn in PERIODS)
                     + f"<td>{pc(r['최저 일치'])}</td><td>{rc['1'] * 100:.0f} · {rc['0'] * 100:.0f} · {rc['-1'] * 100:.0f}%</td><td>{pc(r['2022~2026']['5단계'])}</td><td>{pc(r.get('최저 여유 정답 일치'))}</td></tr>")
    one = next(iter(z["iters"]["0"]["methods"].values()))
    share = " · ".join(f"{pn} {one[pn]['정답 비율']['1'] * 100:.0f}/{one[pn]['정답 비율']['0'] * 100:.0f}/{one[pn]['정답 비율']['-1'] * 100:.0f}%" for pn in PERIODS)
    body = (f'<section class="card"><h4 style="margin-top:0">3상태 장 판별 루프 — 상승·하락·횡보 + 정도 5단계 (BTC·ETH)</h4>'
            f'<p class="note">정답(지나고 본 장) = 그날을 가운데 둔 60일 움직임 ÷ 그 기간의 출렁임(z). z ≥ 1 상승장, ≤ −1 하락장, 사이 횡보장, |z| ≥ 2 는 강한 장. '
            f'정답 비율(상승/횡보/하락): {e(share)}. 정답의 절반(뒤 30일)은 그날 알 수 없어, 예측할 거리가 없는 무작위 가격에서도 최선이 73.3%(늘 횡보 68.3%)다. '
            f'성공 조건은 세 기간 모두 80% 이상이고 세 상태 각각 50% 이상 — 아직 없다.</p>')
    if z.get("today"):
        t = " · ".join(f"{s} {v['이름']} ({v['시작']} 부터, 지난 30일 z {v['지난 30일 z']:+.2f})" for s, v in z["today"].items())
        body += f'<p class="lede"><b>오늘 ({e(next(iter(z["today"].values()))["날짜"])}) 판별:</b> {e(t)} <small>— 판별기: {e(z["best"])}</small></p>'
    if z.get("chart"):
        body += ('<div class="legend"><span><i style="height:10px;background:var(--s2);opacity:.36"></i>강한 상승장</span><span><i style="height:10px;background:var(--s2);opacity:.16"></i>상승장</span>'
                 '<span><i style="height:10px;background:transparent;border:1px solid var(--line)"></i>횡보장</span><span><i style="height:10px;background:var(--s1);opacity:.16"></i>하락장</span>'
                 '<span><i style="height:10px;background:var(--s1);opacity:.36"></i>강한 하락장</span><span><i style="background:var(--fg)"></i>가격 (로그 눈금, USD)</span>'
                 '<span>바탕 = 그날 판별 · 아래 띠 = 지나고 본 정답 (마지막 30일은 아직 없음)</span></div>')
        for s, ch in z["chart"].items():
            body += f'<h4>{e(s)}</h4><div class="chart">{svg(ch, s)}</div>'
    body += ('<div class="scroll"><table class="num"><thead><tr><th>판별기</th>' + "".join(f"<th>{pn}</th>" for pn in PERIODS)
             + f'<th>세 기간 최저</th><th>상승 · 횡보 · 하락 맞힌 비율 (2022~2026)</th><th>5단계 일치 (2022~2026)</th><th>보조: 여유를 둔 정답, 세 기간 최저</th></tr></thead><tbody>{rows}</tbody></table></div>')
    if z.get("use"):
        srcs = list(z["use"])
        head = "".join(f'<th>{e(src)}<br><small>상승 / 횡보 / 하락</small></th>' for src in srcs)
        urows = ""
        for name in ("보유", "현물 봇", "볼린저 평균회귀", "돈치안 돌파"):
            urows += f"<tr><th>{e(name)}</th>" + "".join("<td>" + " / ".join(pc(z["use"][src][name][st]["전체"], True) for st in ("1", "0", "-1")) + "</td>" for src in srcs) + "</tr>"
        urows += "<tr><th>그 상태인 날의 비율</th>" + "".join("<td>" + " / ".join(f"{z['use'][src]['날 비율'][st] * 100:.0f}%" for st in ("1", "0", "-1")) + "</td>" for src in srcs) + "</tr>"
        body += ('<p class="note">쓸모 확인: 그날 판별한 상태별로 다음 날 수익(연 환산, 편도 0.10%, 전체 기간)이 실제로 다른가. 정답 열은 미래를 본 값이라 상한이다.</p>'
                 f'<div class="scroll"><table class="num"><thead><tr><th>전략</th>{head}</tr></thead><tbody>{urows}</tbody></table></div>')
    return body + "</section>"
