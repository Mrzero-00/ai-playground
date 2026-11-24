"""보고서의 '현물 봇 + 하락장 선물 숏 조합' 칸 (scripts/lab/hybrid.py 결과 → HTML). report.py 가 부른다."""
import html
import json

import common as C

PERIODS = ["2020~2021", "2022~2026"]


def e(x):
    return html.escape(str(x))


def cell(st):
    return f"<td>{st['연복리'] * 100:+.0f}%<small> {st['샤프']:.2f} · {st['MDD'] * 100:.0f}%</small></td>"


def section():
    p = C.OUT / "hybrid.json"
    if not p.exists():
        return ""
    z = json.loads(p.read_text())
    R, years = z["rows"], list(next(iter(z["rows"].values()))["해"])

    def row(k):
        r = R[k]
        verdict = "—" if "통과" not in r else ('<span class="pill ok">통과</span>' if r["통과"] else '<span class="pill no">기각</span>')
        return (f"<tr><th>{e(k)} {e(z['names'][k])}</th><td>{r['전체']['잔고'] / 1e4:,.0f}만<small> ({r['0.25%']['전체']['잔고'] / 1e4:,.0f}만)</small></td>"
                f"{cell(r['전체'])}{''.join(cell(r['기간'][pn]) for pn in PERIODS)}<td>{verdict}</td></tr>")

    def yrow(k):
        cells = "".join(f"<td>{R[k]['해'][y] * 100:+.0f}%</td>" for y in years)
        return f"<tr><th>{e(k)} {e(z['names'][k])}</th>{cells}</tr>"

    return (f'<section class="card"><h4 style="margin-top:0">현물 봇 + 하락장 선물 숏 조합 ({e(z["window"][0])} ~ {e(z["window"][1])}, 100만원)</h4>'
            '<p class="note">롱은 업비트 현물 봇 그대로(펀딩비 없음), 숏은 바이낸스 선물 1배로 하락장 판별일 때만. 숏에 쓰는 돈은 USDT 라 원/달러를 곱했다. '
            '잔고는 편도 0.10%(괄호는 0.25%). 칸 = 연복리 · 샤프 · MDD. 판정은 두 기간 모두 현물 봇보다 샤프가 높고 MDD 5%p 이내·0.25% 에서도 — 통과 없음(2020~2021 에 숏이 잃어 모두 현물 봇보다 낮다). '
            'C1 은 두 거래소 사이에 돈이 바로 오간다고 본 이론값이다.</p>'
            '<div class="scroll"><table class="num"><thead><tr><th>조합</th><th>마지막 잔고</th><th>전체</th>' + "".join(f"<th>{pn}</th>" for pn in PERIODS)
            + "<th>판정</th></tr></thead><tbody>" + "".join(row(k) for k in R) + "</tbody></table></div>"
            '<p class="note">해마다 수익(2026 은 11-22 까지).</p><div class="scroll"><table class="num"><thead><tr><th>조합</th>'
            + "".join(f"<th>{y}</th>" for y in years) + "</tr></thead><tbody>" + "".join(yrow(k) for k in R) + "</tbody></table></div></section>")
