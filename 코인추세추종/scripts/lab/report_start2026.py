"""보고서의 '2026년에 시작했다면 — 현물 대 선물' 칸 (scripts/lab/start2026.py 결과 → HTML). report.py 가 부른다."""
import html
import json

import common as C


def e(x):
    return html.escape(str(x))


def section():
    p = C.OUT / "start2026.json"
    if not p.exists():
        return ""
    z = json.loads(p.read_text())
    rows = sorted(z["rows"].items(), key=lambda kv: -kv[1]["0.10%"]["잔고"])
    a, b = z["기간"]
    fx0, fx1 = z["원달러"]

    def row(k, r):
        x, h = r["0.10%"], r["0.25%"]
        return (f"<tr><th>{e(k)}</th><td>{e(r['묶음'])}</td><td>{x['잔고'] / 1e4:.1f}만<small> ({h['잔고'] / 1e4:.1f}만)</small></td>"
                f"<td>{x['MDD'] * 100:.0f}%</td><td>{x['변경']}</td></tr>")

    return ('<section class="card"><h4 style="margin-top:0">2026년에 시작했다면 — 현물 대 선물 (100만원)</h4>'
            f'<p class="note">{e(a)} 09:00 에 새로 시작해 {e(b)} 까지. 이미 정해 둔 방식만 다시 쟀다(판정 없음). 선물은 바이낸스 USDT 무기한·실제 펀딩비, '
            f'원/달러 {fx0:,.1f} → {fx1:,.1f} 를 곱해 원화로 봤다. 잔고는 편도 0.10%(괄호는 0.25%). '
            '2026 은 BTC · ETH 가 40% 안팎 내린 해라 숏을 잡는 방식이 앞섰고, 선물 롱만은 현물 봇보다 낮다. 7년 전체로는 현물 봇이 훨씬 높다(3,609만원 대 T1 1,004만원).</p>'
            '<div class="scroll"><table class="num"><thead><tr><th>방식</th><th>묶음</th><th>잔고</th><th>MDD</th><th>포지션 바꾼 횟수</th></tr></thead><tbody>'
            + "".join(row(k, r) for k, r in rows) + "</tbody></table></div></section>")
