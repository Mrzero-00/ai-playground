"""보고서의 '판단 시간 창' 칸 (scripts/lab/window.py 결과 → HTML). report.py 가 부른다."""
import html
import json

import common as C


def e(x):
    return html.escape(str(x))


def section():
    p = C.OUT / "window.json"
    if not p.exists():
        return ""
    z = json.loads(p.read_text())
    spans = list(next(iter(z["rows"].values())))
    spans = [s for s in spans if s in ("2020~", "2023~")]

    def row(k):
        r = z["rows"][k]
        cells = ""
        for sn in spans:
            a, h = r[sn]["0.10%"], r[sn]["0.25%"]
            cells += (f"<td>{a['잔고'] / 1e4:,.0f}만<small> ({h['잔고'] / 1e4:,.0f}만)</small></td><td>{a['샤프']:.2f}</td><td>{a['MDD'] * 100:.0f}%</td>"
                      f"<td>{r[sn]['V0 와 다른 날'] * 100:.0f}%</td>")
        verdict = "—" if "통과" not in r else ('<span class="pill ok">통과</span>' if r["통과"] else '<span class="pill no">기각</span>')
        return f"<tr><th>{e(k)} {e(z['names'][k])}</th>{cells}<td>{verdict}</td></tr>"

    head = "".join(f"<th>{e(sn)} 잔고</th><th>샤프</th><th>MDD</th><th>지금 방식과 판단이 다른 날</th>" for sn in spans)
    return ('<section class="card"><h4 style="margin-top:0">판단 시간 창 — 08~10시 자료로 10시에 판단하면 (업비트 30분봉, 100만원)</h4>'
            '<p class="note">거래는 하루 한 번 그대로 두고 판단에 쓰는 가격만 바꿨다. 잔고는 편도 0.10%(괄호는 0.25%). '
            '두 시간 평균·다수결 모두 지금 방식(09:00 가격 하나)보다 나아지지 않았다 — 판단이 달라지는 날이 1 ~ 5% 뿐이다.</p>'
            f'<div class="scroll"><table class="num"><thead><tr><th>방식</th>{head}<th>판정</th></tr></thead><tbody>'
            + "".join(row(k) for k in z["rows"]) + "</tbody></table></div></section>")
