"""보고서의 '팔 때도 빠르게 — 줄이는 확인 간격' 칸 (scripts/lab/fastsell.py 결과 → HTML). report.py 가 부른다."""
import html
import json

import common as C

SPANS = ["2020~", "2023~"]


def e(x):
    return html.escape(str(x))


def section():
    p = C.OUT / "fastsell.json"
    if not p.exists():
        return ""
    z = json.loads(p.read_text())

    def row(k):
        r = z["rows"][k]
        cells = ""
        for sn in SPANS:
            a, h = r[sn]["0.10%"], r[sn]["0.25%"]
            cells += (f"<td>{a['잔고'] / 1e4:,.0f}만<small> ({h['잔고'] / 1e4:,.0f}만)</small></td><td>{a['샤프']:.2f}<small> ({h['샤프']:.2f})</small></td>"
                      f"<td>{a['MDD'] * 100:.0f}%</td><td>{a['연 주문']:.0f}</td>")
        d = r.get("진단")
        diag = " · ".join(f"{s} {v['장중 매도']}회 중 {v['더 비싸게 다시 삼'] * 100:.0f}%" for s, v in d.items()) if d else "—"
        verdict = "—" if "통과" not in r else ('<span class="pill ok">통과</span>' if r["통과"] else '<span class="pill no">기각</span>')
        return f"<tr><th>{e(k)}</th>{cells}<td>{e(diag)}</td><td>{verdict}</td></tr>"

    head = "".join(f"<th>{e(sn)} 잔고</th><th>샤프</th><th>MDD</th><th>연 주문</th>" for sn in SPANS)
    return ('<section class="card"><h4 style="margin-top:0">팔 때도 빠르게 — 줄이는 확인 간격을 더하면 (업비트 30분봉, 100만원)</h4>'
            '<p class="note">지금 봇(09:00 맞춤 + 4시간마다 늘리기만)에 줄이는 확인을 더하고 그 간격을 바꿨다. 잔고·샤프는 편도 0.10%(괄호는 0.25%), 판정 기준은 지금 봇. '
            '마지막에서 둘째 칸은 장중에 판 뒤 판 가격보다 비싸게 다시 산 비율(2020~). 모든 간격이 기각 — 촘촘할수록 팔았다가 더 비싸게 다시 사는 일이 늘어 잔고가 줄어든다.</p>'
            f'<div class="scroll"><table class="num"><thead><tr><th>줄이는 확인 간격</th>{head}<th>판 뒤 더 비싸게 다시 삼</th><th>판정</th></tr></thead><tbody>'
            + "".join(row(k) for k in z["rows"]) + "</tbody></table></div></section>")
