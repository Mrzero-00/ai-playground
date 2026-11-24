"""보고서의 '살 때만 빠르게 — 확인 간격' 칸 (scripts/lab/fastbuy.py 결과 → HTML). report.py 가 부른다."""
import html
import json

import common as C

SPANS = ["2020~", "2023~"]


def e(x):
    return html.escape(str(x))


def section():
    p = C.OUT / "fastbuy.json"
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
        verdict = "—" if "통과" not in r else ('<span class="pill ok">통과</span>' if r["통과"] else '<span class="pill no">기각</span>')
        return f"<tr><th>{e(k)}</th>{cells}<td>{verdict}</td></tr>"

    head = "".join(f"<th>{e(sn)} 잔고</th><th>샤프</th><th>MDD</th><th>연 주문</th>" for sn in SPANS)
    return ('<section class="card"><h4 style="margin-top:0">살 때만 빠르게 — 확인 간격을 줄이면 (업비트 30분봉, 100만원)</h4>'
            '<p class="note">09:00 에는 지금 방식대로, 그 사이에는 확인 시각마다 늘리기만 한다. 잔고·샤프는 편도 0.10%(괄호는 0.25%). '
            '4시간까지는 좋아지고 그보다 촘촘하면 조금씩 줄어든다 — 30분마다 봐도 4시간보다 낫지 않고 주문만 는다.</p>'
            f'<div class="scroll"><table class="num"><thead><tr><th>확인 간격</th>{head}<th>판정</th></tr></thead><tbody>'
            + "".join(row(k) for k in z["rows"]) + "</tbody></table></div></section>")
