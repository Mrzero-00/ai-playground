"""보고서의 '손절 규칙 — 여러 형태' 칸 (scripts/lab/stoploss.py 결과 → HTML). report.py 가 부른다."""
import html
import json

import common as C

SPANS = ["2020~", "2023~"]


def e(x):
    return html.escape(str(x))


def section():
    p = C.OUT / "stoploss.json"
    if not p.exists():
        return ""
    z = json.loads(p.read_text())

    def row(k):
        r = z["rows"][k]
        cells = ""
        for sn in SPANS:
            a, h = r[sn]["0.10%"], r[sn]["0.25%"]
            cells += (f"<td>{a['잔고'] / 1e4:,.0f}만<small> ({h['잔고'] / 1e4:,.0f}만)</small></td><td>{a['샤프']:.2f}<small> ({h['샤프']:.2f})</small></td>"
                      f"<td>{a['MDD'] * 100:.0f}%</td>")
        f, d = r["폭락"], r["진단"]
        stops = f"{d['손절']}회 · {d['더 비싸게 다시 삼'] * 100:.0f}%" if d["손절"] and d["더 비싸게 다시 삼"] is not None else "—"
        verdict = "—" if "통과" not in r else ('<span class="pill ok">통과</span>' if r["통과"] else '<span class="pill no">기각</span>')
        return (f"<tr><th>{e(k)}</th>{cells}<td>{r['2020~']['0.10%']['연 주문']:.0f}</td><td>{f['하루 최악'] * 100:.1f}%</td><td>{f['−10% 이하 날']}</td>"
                f"<td>{e(stops)}</td><td>{verdict}</td></tr>")

    head = "".join(f"<th>{e(sn)} 잔고</th><th>샤프</th><th>MDD</th>" for sn in SPANS)
    return ('<section class="card"><h4 style="margin-top:0">손절 규칙 — 여러 형태 (지금 봇에 손절을 더하면, 업비트 30분봉, 100만원)</h4>'
            '<p class="note">손절 확인은 30분마다, 조건에 닿으면 그 코인을 전부 판다. R1 은 다음 09:00 에 다시 사고, R2 는 일 단위 비중이 새로 늘어나는 날까지 쉰다. '
            '잔고·샤프는 편도 0.10%(괄호는 0.25%), 하루 최악과 −10% 이하 날은 2020~ 의 09:00 ~ 09:00 수익. 손절 칸은 횟수와 손절가보다 비싸게 다시 산 비율. '
            '26칸 중 2칸만 통과 — 매수가 기준 손절은 해가 작지만 최악의 날을 줄이지 못하고, 고점·속도·저점 기준은 수익을 크게 깎는다. '
            '2024-12-03 밤의 순간 급락에서는 손절이 바닥에서 팔아 하루 −18.9% 가 났다(손절 없으면 +0.2%).</p>'
            f'<div class="scroll"><table class="num"><thead><tr><th>손절 규칙 · 다시 사는 규칙</th>{head}<th>연 주문</th><th>하루 최악</th><th>−10% 이하 날</th><th>손절</th><th>판정</th></tr></thead><tbody>'
            + "".join(row(k) for k in z["rows"]) + "</tbody></table></div></section>")
