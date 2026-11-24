"""보고서의 '4시간마다 확인' 칸 (scripts/lab/fourhour.py 결과 → HTML). report.py 가 부른다."""
import html
import json

import common as C

SPANS = ["2020~", "2023~"]


def e(x):
    return html.escape(str(x))


def section():
    p = C.OUT / "fourhour.json"
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
        return f"<tr><th>{e(k)} {e(z['names'][k])}</th>{cells}<td>{verdict}</td></tr>"

    head = "".join(f"<th>{e(sn)} 잔고</th><th>샤프</th><th>MDD</th><th>연 주문</th>" for sn in SPANS)
    return ('<section class="card"><h4 style="margin-top:0">4시간마다 확인 — 01·05·09·13·17·21시 (업비트 30분봉, 100만원)</h4>'
            '<p class="note">잔고·샤프는 편도 0.10%(괄호는 0.25%). 판정은 두 구간 모두 샤프가 지금 방식보다 높고 MDD 가 나쁘지 않으며 0.25% 에서도. '
            "'늘릴 때만 4시간마다'(W4)만 통과했지만 차이가 작다(샤프 +0.03 ~ +0.06, 0.25% 의 2023~ 는 거의 같다). 다섯 중 하나라 우연일 수 있어 모의로 확인할 대상이다.</p>"
            f'<div class="scroll"><table class="num"><thead><tr><th>방식</th>{head}<th>판정</th></tr></thead><tbody>'
            + "".join(row(k) for k in z["rows"]) + "</tbody></table></div></section>")
