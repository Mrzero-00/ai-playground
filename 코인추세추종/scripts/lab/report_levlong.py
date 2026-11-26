"""보고서의 '상승장 레버리지 롱' 칸 (scripts/lab/levlong.py 결과 → HTML). report.py 가 부른다."""
import html
import json

import common as C

STARTS = ["2020-01-01", "2023-01-01", "2026-01-01"]


def e(x):
    return html.escape(str(x))


def section():
    p = C.OUT / "levlong.json"
    if not p.exists():
        return ""
    z = json.loads(p.read_text())

    def cell(r, st):
        x = r[st]["0.10%"]
        x = x.get("가", x)
        return f"<td>{x['잔고'] / 1e4:,.1f}만<small> ({x['MDD'] * 100:.0f}%)</small></td>"

    def row(k, r):
        liq = r["2020-01-01"]["0.10%"].get("가", {}).get("청산") if "배수" in r else None
        liq = " · ".join(f"{s} {d[0]}" for s, d in liq.items()) if liq else "—"
        verdict = "—" if "통과" not in r else ('<span class="pill ok">통과</span>' if r["통과"] else '<span class="pill no">기각</span>')
        fund = f"{r['펀딩'] * 100:.0f}%" if "펀딩" in r else "—"
        return f"<tr><th>{e(k)}</th>" + "".join(cell(r, st) for st in STARTS) + f"<td>{e(liq)}</td><td>{fund}</td><td>{verdict}</td></tr>"

    head = "".join(f"<th>{st[:4]}~ 잔고 (MDD)</th>" for st in STARTS)
    return ('<section class="card"><h4 style="margin-top:0">상승장 레버리지 롱 — 배수 1 · 2 · 3 · 5 (바이낸스 무기한, 원화 환산, 100만원)</h4>'
            '<p class="note">A 현물 봇 비중 × 배수, B 상승장(판별기 나)만 배수 롱, C 상승장 배수 롱 + 하락장 1배 숏. 날마다 같은 배수로 맞추고 그 거래 비용·실제 펀딩비를 넣었다. '
            '코인 몫 전부를 증거금으로 둔 격리 마진 청산(선물 저가·고가 기준). 코인마다 따로 잰다. 편도 0.10%. '
            '레버리지를 올린 9칸 모두 기각 — 펀딩비가 배수만큼 커지고(3배 연 23 ~ 32%), 3배 · 5배는 2020-03 · 2021-01 · 2021-05 급락에서 청산됐다. 2023 · 2026 시작에서도 현물 봇보다 낮다.</p>'
            f'<div class="scroll"><table class="num"><thead><tr><th>방식</th>{head}<th>청산 (2020~)</th><th>연 펀딩</th><th>판정</th></tr></thead><tbody>'
            + "".join(row(k, r) for k, r in z["rows"].items()) + "</tbody></table></div></section>")
