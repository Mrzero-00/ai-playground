"""보고서의 '장별 매매 전략 2차 — 선물' 칸 (scripts/lab/regime_futures.py 결과 → HTML). report.py 가 부른다."""
import html
import json

import common as C

PERIODS = ["2020~2021", "2022~2026"]


def e(x):
    return html.escape(str(x))


def cell(st):
    return "<td>—</td>" if not st else f"<td>{st['연복리'] * 100:+.0f}%<small> {st['샤프']:.2f} · {st['MDD'] * 100:.0f}%</small></td>"


def section():
    p = C.OUT / "regime_futures.json"
    if not p.exists():
        return ""
    z = json.loads(p.read_text())
    R = z["rows"]

    def name(k):
        if "|" not in k:
            return e(k)
        t, c = k.replace("참고: ", "").split("|")
        c, extra = (c.split(" ")[0], " 2배 (참고)") if " " in c else (c, "")
        return f"{e(t)} {e(z['names'][t])}{extra} <small>판별기 ({e(c)})</small>"

    def row(k):
        r = R[k]
        verdict = "—" if "통과" not in r else ('<span class="pill ok">통과</span>' if r["통과"] else '<span class="pill no">기각</span>')
        hard = f"{r['0.25%']['전체']['샤프']:.2f}" if "0.25%" in r else "—"
        liq = f" · 청산 {r['청산']}회" if r.get("청산") else ""
        return (f"<tr><th>{name(k)}</th>{cell(r['전체'])}{''.join(cell(r['기간'][pn]) for pn in PERIODS)}<td>{hard}</td>"
                f"<td>{r['변경']:,}{liq}</td><td>{r['롱'] * 100:.0f} / {r['숏'] * 100:.0f}%</td><td>{r['펀딩'] * 100:+.1f}%</td><td>{verdict}</td></tr>")

    order = [k for k in R if "|" not in k] + [k for c in z["classifiers"] for k in R if k.endswith("|" + c)] + [k for k in R if k.startswith("참고")]
    years = list(next(iter(R.values()))["해"])

    def yrow(k):
        cells = "".join(f"<td>{R[k]['해'][y] * 100:+.0f}%</td>" for y in years)
        return f"<tr><th>{name(k)}</th>{cells}</tr>"

    yrows = "".join(yrow(k) for k in ("F0 (현물 봇 비중을 선물 롱으로)", "선물 롱 보유", "T1|나", "T2|나", "T3|나", "T4|나", "T5|나"))
    cls = " · ".join(f"({e(k)}) {e(v)}" for k, v in z["classifiers"].items())
    today = " · ".join(f"{e(s)} {e(t['나']['상태'])} → {'롱' if t['나']['T1'] > 0 else ('숏' if t['나']['T1'] < 0 else '포지션 없음')}" for s, t in z["today"].items())
    return (f'<section class="card"><h4 style="margin-top:0">장별 매매 전략 2차 — 선물 자동매매 가정 ({e(z["window"][0])} ~ {e(z["window"][1])}, 바이낸스 무기한, 1배)</h4>'
            f'<p class="note">장 판별기 {cls}. 상승장 롱 · 하락장 숏 · 횡보장은 쉬거나 박스권 매매. 실제 펀딩비 반영, 편도 0.10%. 칸 = 연복리 · 작은 글씨 샤프·MDD. '
            f'판정은 두 기간 모두 F0 보다 샤프가 높고 MDD 5%p 이내·0.25% 에서도·포지션 변경 30회+ — 통과 없음(2020~2021 강세장에서 롱 위주인 F0 가 더 높았다). '
            f'규칙대로면 오늘 T1 포지션: {today}.</p>'
            '<div class="scroll"><table class="num"><thead><tr><th>전략</th><th>전체</th>' + "".join(f"<th>{pn}</th>" for pn in PERIODS)
            + '<th>0.25% 샤프</th><th>포지션 변경</th><th>롱 / 숏인 날</th><th>펀딩(연, + 는 낸 것)</th><th>판정</th></tr></thead><tbody>'
            + "".join(row(k) for k in order) + "</tbody></table></div>"
            '<p class="note">해마다 수익(2026 은 11-22 까지).</p><div class="scroll"><table class="num"><thead><tr><th>전략</th>'
            + "".join(f"<th>{y}</th>" for y in years) + f"</tr></thead><tbody>{yrows}</tbody></table></div></section>")
