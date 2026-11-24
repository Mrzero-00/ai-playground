"""보고서의 '김치 프리미엄 헤지 매매' 칸 (scripts/lab/kimchi_hedge.py 결과 → HTML). report.py 가 부른다."""
import html
import json

import common as C

PERIODS = ["2020~2021", "2022~2026"]


def e(x):
    return html.escape(str(x))


def section():
    p = C.OUT / "kimchi_hedge.json"
    if not p.exists():
        return ""
    z = json.loads(p.read_text())
    R = z["rows"]
    years = list(next(iter(R.values()))["0.10%"]["해"])

    def row(k):
        r = R[k]
        a, h = r["0.10%"], r["0.25%"]
        verdict = '<span class="pill ok">통과</span>' if r["통과"] else '<span class="pill no">기각</span>'
        per = "".join(f"<td>{a['기간'][pn]['연'] * 100:+.1f}%<small> ({h['기간'][pn]['연'] * 100:+.1f}%)</small></td>" for pn in PERIODS)
        return (f"<tr><th>{e(k)} {e(z['names'][k])}</th><td>{a['원화']['잔고'] / 1e4:,.0f}만<small> ({h['원화']['잔고'] / 1e4:,.0f}만)</small></td>"
                f"<td>{a['환율 뺀']['연'] * 100:+.1f}%<small> ({h['환율 뺀']['연'] * 100:+.1f}%)</small></td><td>{a['환율 뺀']['샤프']:.2f}</td><td>{a['환율 뺀']['MDD'] * 100:.1f}%</td>"
                f"<td>{a['원화']['MDD'] * 100:.1f}%</td>{per}<td>{a['펀딩 연'] * 100:+.1f}%</td><td>{r['보유'] * 100:.0f}%</td><td>{r['왕복']} · {r['다시맞춤']}</td><td>{verdict}</td></tr>")

    def yrow(k):
        cells = "".join(f"<td>{R[k]['0.10%']['해 환율 뺀'][y] * 100:+.1f}%</td>" for y in years)
        return f"<tr><th>{e(k)} {e(z['names'][k])}</th>{cells}</tr>"

    return (f'<section class="card"><h4 style="margin-top:0">김치 프리미엄 헤지 매매 ({e(z["window"][0])} ~ {e(z["window"][1])}, 100만원)</h4>'
            '<p class="note">프리미엄(업비트 ÷ (바이낸스 현물 × 원/달러) − 1)이 낮을 때 업비트 현물 매수 + 바이낸스 선물 같은 수량 1배 숏, 높아지면 정리. '
            '총자금의 절반은 업비트 원화, 절반은 바이낸스 USDT. 선물이 ±50% 움직이면 크기를 다시 맞추고, 거래소 사이 이동은 그날 프리미엄만큼 비용. '
            f'잔고·수익은 편도 0.10%(괄호는 0.25%). 절반을 USDT 로 그냥 들고 있으면(환율만) {z["환율만"]["잔고"] / 1e4:,.0f}만원. '
            '판정은 환율을 뺀 수익이 두 기간 모두 +(0.25% 에서도)이고 샤프 1 초과. 입출금 중단·코인 이동 시간·두 거래소 동시 체결은 넣지 않았다.</p>'
            '<div class="scroll"><table class="num"><thead><tr><th>규칙</th><th>마지막 잔고 (원화)</th><th>환율 뺀 연 수익</th><th>샤프</th><th>낙폭 (환율 뺀)</th><th>낙폭 (원화)</th>'
            + "".join(f"<th>{pn} 환율 뺀</th>" for pn in PERIODS) + "<th>펀딩 (연)</th><th>보유한 날</th><th>왕복 · 크기 다시 맞춤</th><th>판정</th></tr></thead><tbody>"
            + "".join(row(k) for k in R) + "</tbody></table></div>"
            '<p class="note">해마다 환율을 뺀 수익(2026 은 11-22 까지).</p><div class="scroll"><table class="num"><thead><tr><th>규칙</th>'
            + "".join(f"<th>{y}</th>" for y in years) + "</tr></thead><tbody>" + "".join(yrow(k) for k in R) + "</tbody></table></div></section>")
