"""보고서의 '터틀식 손절 — 값 바꿔 보기' 칸 (scripts/lab/turtle_grid.py 결과 → HTML). report.py 가 부른다."""
import html
import json

import common as C

SPANS = ["2020~", "2023~"]
FRESH = "2026-01-01"


def e(x):
    return html.escape(str(x))


def section():
    p = C.OUT / "turtle_grid.json"
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
        f = r[FRESH]
        verdict = "—" if "통과" not in r else ('<span class="pill ok">통과</span>' if r["통과"] else '<span class="pill no">기각</span>')
        return (f"<tr><th>{e(k)}</th>{cells}<td>{r['진단']['손절']}</td><td>{f['0.10%'] / 1e4:.1f}만<small> ({f['0.25%'] / 1e4:.1f}만)</small></td><td>{verdict}</td></tr>")

    keys = [k for k, r in z["rows"].items() if r.get("다시") != "R1"]
    r1 = [r for r in z["rows"].values() if r.get("다시") == "R1" and r["간격"] == "30분"]
    head = "".join(f"<th>{e(sn)} 잔고</th><th>샤프</th><th>MDD</th>" for sn in SPANS)
    return ('<section class="card"><h4 style="margin-top:0">터틀식 손절 — 값을 바꿔도 고르게 좋은가 (가격 ≤ 평균 매수가 − 배수 × ATR 이면 전부 판다, 100만원)</h4>'
            '<p class="note">가장 좋은 값을 고르려는 것이 아니라 출처 값(2배 · 20일)의 이웃이 받쳐 주는지 본 것이다. 아래는 R2(손절 뒤 새 매수 신호까지 쉼). '
            f'2배 · 20일의 이웃 8칸 중 {z["이웃"]["R2"]["통과"]}칸, 18칸 중 {z["전체"]["R2"]["통과"]}칸 통과 — 배수 2.5배 이하에서는 기간과 상관없이 지금 봇을 넘는다. '
            f'R1(다음 09:00 에 다시 삼)은 18칸 중 {sum(r["통과"] for r in r1)}칸 통과 — 효과는 다시 사는 규칙에 달려 있다. '
            f'마지막에서 둘째 칸은 {FRESH} 에 100만원을 새로 넣었을 때의 잔고(같은 날 BTC · ETH 를 반반 사서 들고만 있었다면 {z["보유 " + FRESH] / 1e4:.1f}만원). '
            '잔고 · 샤프는 편도 0.10%(괄호는 0.25%). 하루 최악 손실은 모든 칸에서 −13.4% 그대로다.</p>'
            f'<div class="scroll"><table class="num"><thead><tr><th>배수 · ATR 기간 · 다시 사는 규칙</th>{head}<th>손절 횟수</th><th>{FRESH}~ 잔고</th><th>판정</th></tr></thead><tbody>'
            + "".join(row(k) for k in keys) + "</tbody></table></div></section>")
