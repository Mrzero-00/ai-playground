"""운영 리포트. 실전·모의 장부와 현재 신호를 정적 페이지(report/index.html)로 만들고 Vercel 에 올린다.
launchd com.coin-trend.report 가 실전 봇(09:07) 뒤 09:20 에 돈다 (13:20·21:20 재시도).
사용법:
  python3 scripts/report.py            # 페이지 생성 + 배포
  python3 scripts/report.py --no-deploy
"""
import csv, html, json, os, subprocess, sys
from datetime import datetime, timedelta
from pathlib import Path

import live_binance as LB
from live import history
from paper import KST, MARKETS, SMAS, closes, signal

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "report"
VERCEL = os.environ.get("VERCEL_BIN", str(Path.home() / ".nvm/versions/node/v22.23.1/bin/vercel"))
SLIP_ASSUMED = 0.05  # 백테스트 편도 슬리피지 가정(%)


def rows(path):
    return list(csv.DictReader(path.open())) if path.exists() else []


def daily(path, value_cols):
    """같은 날 여러 줄이면 마켓별 마지막 값을 날짜별로 합친다."""
    last = {(r["날짜"], r["마켓"]): r for r in rows(path)}
    by_day = {}
    for (day, _), r in last.items():
        d = by_day.setdefault(day, [0.0] * len(value_cols))
        for i, c in enumerate(value_cols):
            d[i] += float(r[c])
    return [(d, *by_day[d]) for d in sorted(by_day)]


def mdd(values):
    peak, worst = 0, 0.0
    for v in values:
        peak = max(peak, v)
        worst = min(worst, v / peak - 1)
    return worst


def signals():
    out = []
    for m in MARKETS:
        dates, px = closes(m)
        smas = {n: sum(px[-n:]) / n for n in SMAS}
        out.append({"market": m, "date": dates[-1], "close": px[-1], "target": signal(px),
                    "smas": {n: {"value": v, "gap": px[-1] / v - 1} for n, v in smas.items()}})
    return out


def slip_avg(trades, col):
    vals = [float(t[col].rstrip("%")) for t in trades if t.get(col)]
    return sum(vals) / len(vals) if vals else None


def collector():
    base = ROOT / "data" / "collect"
    log = base / "logs" / "collect.log"
    last = log.read_text().strip().splitlines()[-1] if log.exists() else "기록 없음"
    kinds = {}
    for d in sorted(p for p in base.iterdir() if p.is_dir() and p.name != "logs" and not p.name.startswith(".")) if base.exists() else []:
        files = sorted(d.glob("*.csv.gz"))
        kinds[d.name] = {"days": len(files), "mb": sum(f.stat().st_size for f in files) / 1e6}
    return last, kinds


def chart(series, labels, colors, w=640, h=200):
    """여러 선을 같은 축에 그리는 인라인 SVG. series = [[값, ...], ...]"""
    n = max(len(s) for s in series)
    if n < 2:
        return '<p class="muted">기록이 이틀 이상 쌓이면 그래프가 나온다.</p>'
    lo = min(min(s) for s in series)
    hi = max(max(s) for s in series)
    pad = (hi - lo) * 0.1 or hi * 0.01
    lo, hi = lo - pad, hi + pad
    x = lambda i: 40 + i * (w - 50) / (n - 1)
    y = lambda v: 10 + (hi - v) * (h - 30) / (hi - lo)
    lines = "".join(
        f'<polyline fill="none" stroke="{c}" stroke-width="2" points="{" ".join(f"{x(i):.1f},{y(v):.1f}" for i, v in enumerate(s))}"/>'
        for s, c in zip(series, colors))
    axis = "".join(f'<text x="36" y="{y(v) + 4:.1f}" text-anchor="end">{v / 1e4:,.0f}만</text>' for v in (lo + pad, hi - pad))
    legend = " ".join(f'<span><i style="background:{c}"></i>{html.escape(l)}</span>' for l, c in zip(labels, colors))
    return f'<svg viewBox="0 0 {w} {h}" class="chart">{axis}{lines}</svg><div class="legend">{legend}</div>'


def compare(start):
    """ml.py 가 남긴 표본 외 일간 수익으로, start 에 100만원(BTC·ETH 50만씩) 넣었을 때 평가액."""
    path = ROOT / "data/ml/oos_daily.csv"
    if not path.exists():
        return ""
    d = list(csv.DictReader(path.open()))
    d = [r for r in d if r["date"] >= start]
    names = [("앙상블", "앙상블 (실전 봇)", "var(--c2)"), ("L-A", "ML 거르기", "var(--c4)"), ("보유", "그냥 보유", "var(--c3)")]
    series, summary = [], []
    for key, label, _ in names:
        eq = {m: 500_000.0 for m in MARKETS}
        line = []
        for r in d:
            for m in MARKETS:
                eq[m] *= 1 + float(r[f"{key}_{m}"])
            line.append(sum(eq.values()))
        series.append(line)
        summary.append(f"<tr><td>{label}</td><td>{line[-1]:,.0f}원</td><td>{pct(line[-1] / 1e6 - 1, 0)}</td><td>{pct(mdd(line), 0)}</td></tr>")
    svg = chart(series, [n[1] for n in names], [n[2] for n in names])
    table = "<table><tr><th>전략</th><th>평가액</th><th>수익률</th><th>MDD</th></tr>" + "".join(summary) + "</table>"
    return f'{svg}<div class="muted">{d[0]["date"]} ~ {d[-1]["date"]}</div>{table}'


def futures_table():
    path = ROOT / "paper_futures/equity.csv"
    if not path.exists():
        return '<p class="muted">09:15 첫 실행 뒤부터 기록이 쌓인다.</p>'
    last = {(r["날짜"], r["방식"], r["마켓"]): r for r in csv.DictReader(path.open())}
    day = max(k[0] for k in last)
    names = {"F0": "롱만", "F1": "대칭 롱/숏", "F2": "롱 + 전부 아래면 숏", "F3": "2배 롱"}
    body = ""
    for v, label in names.items():
        rs = [last[(day, v, s)] for s in ("BTC", "ETH") if (day, v, s) in last]
        val = sum(float(r["평가액"]) for r in rs)
        fund = sum(float(r["펀딩누적"]) for r in rs)
        tgt = " / ".join(f'{float(r["목표"]):+.2f}' for r in rs)
        body += f"<tr><td>{v} {label}</td><td>{tgt}</td><td>{val:,.2f}</td><td>{pct(val / 10000 - 1)}</td><td>{fund:+.2f}</td></tr>"
    return f'<div class="scroll"><table><tr><th>방식</th><th>목표 BTC / ETH</th><th>평가액 USDT</th><th>수익률</th><th>펀딩 누적(+ 냄)</th></tr>{body}</table></div><div class="muted">{day} 기준</div>'


def cand_table():
    """연구 최종 후보 선물 모의(RESEARCH.md 후보 모의 등록) — 같은 날 선물 모의 F0 와 나란히."""
    path = ROOT / "paper_cand/equity.csv"
    if not path.exists():
        return '<p class="muted">09:16 첫 실행 뒤부터 기록이 쌓인다.</p>'
    last = {(r["날짜"], r["방식"], r["마켓"]): r for r in csv.DictReader(path.open())}
    start, day = min(k[0] for k in last), max(k[0] for k in last)
    fp = ROOT / "paper_futures/equity.csv"
    f0 = {(r["날짜"], r["마켓"]): r for r in csv.DictReader(fp.open()) if r["방식"] == "F0"} if fp.exists() else {}
    names = {"C1": "볼린저 50/1.5 돌파 롱만", "C2": "7일 평균 펀딩 음수면 롱"}
    body = ""
    for v, label in names.items():
        rs = [last[(day, v, s)] for s in ("BTC", "ETH") if (day, v, s) in last]
        val = sum(float(r["평가액"]) for r in rs)
        tgt = " / ".join(f'{float(r["목표"]):+.0f}' for r in rs)
        body += f"<tr><td>{v} {label}</td><td>{tgt}</td><td>{val:,.2f}</td><td>{pct(val / 10000 - 1)}</td></tr>"
    a = [f0.get((start, s)) for s in ("BTC", "ETH")]
    b = [f0.get((day, s)) for s in ("BTC", "ETH")]
    if all(a) and all(b):
        r0 = sum(float(r["평가액"]) for r in b) / sum(float(r["평가액"]) for r in a) - 1
        tgt = " / ".join(f'{float(r["목표"]):+.2f}' for r in b)
        body += f"<tr><td>F0 기준선 (같은 기간)</td><td>{tgt}</td><td>—</td><td>{pct(r0)}</td></tr>"
    return (f'<div class="scroll"><table><tr><th>후보</th><th>목표 BTC / ETH</th><th>평가액 USDT</th><th>수익률</th></tr>{body}</table></div>'
            f'<div class="muted">{start} ~ {day}</div>')


def binance():
    """바이낸스 봇 장부 (실전이면 live_binance, 아니면 드라이런 장부): (이름, 장부, 기록, 거래)."""
    st = json.loads(LB.STATE.read_text()) if LB.STATE.exists() else {}
    return "바이낸스 " + ("실전" if LB.LIVE else "드라이런"), st, LB.history(), rows(LB.TRADES)


def binance_html(st, tr):
    if not st:
        return '<p class="muted">아직 장부가 없다. 다음 09:07 에 시작한다.</p>'
    body = ""
    for c, s in st["sleeves"].items():
        sig = s.get("signal", {})
        g = sig.get("regime")
        w = "—" if s.get("w") is None else f"{s['w']:.2f}"
        body += (f'<tr><td>{c}</td><td>{w}</td><td>{LB.REGIME_NAME.get(g, "—")}</td>'
                 f'<td>{s["qty"]:.6f}</td><td>{s["short"]:.3f}</td><td>{s["cash"]:,.2f}</td><td>{s["margin"]:,.2f}</td><td>{s.get("funding", 0):+.4f}</td></tr>')
    table = (f'<div class="scroll"><table><tr><th>코인</th><th>현물 비중</th><th>장</th><th>현물 수량</th><th>숏 수량</th><th>현금 USDT</th>'
             f'<th>증거금 USDT</th><th>펀딩 누적</th></tr>{body}</table></div>')
    cols = ["시각", "코인", "구분", "사유", "가격", "수량", "USDT", "수수료", "상태"]
    rows_ = "".join("<tr>" + "".join(f"<td>{html.escape(str(t.get(k, '')))}</td>" for k in cols) + "</tr>" for t in reversed(tr[-30:]))
    trades = f'<div class="scroll"><table><tr>{"".join(f"<th>{k}</th>" for k in cols)}</tr>{rows_}</table></div>' if tr else '<p class="muted">아직 거래 없음.</p>'
    return table + "<p class=\"muted\">현물 비중 = 바이낸스 현물 종가가 위에 있는 이동평균(20·50·100·200일) 수 ÷ 4. 장 = 선물 종가 지난 30일 z + 문턱 여유. 하락장이면 쉬는 돈 (1 − 비중) 만큼 1배 숏.</p>" + trades


def health(now, live_st, col_last):
    """작업마다 (이름, 정상 여부, 설명). 알림은 보내지 않으니 봇이 살아 있는지는 이 줄로 본다."""
    today = now.strftime("%Y-%m-%d")
    # 09:15 작업까지 끝난 뒤부터 오늘 몫을 기대한다
    due = today if (now.hour, now.minute) >= (9, 16) else (now - timedelta(days=1)).strftime("%Y-%m-%d")
    out = []
    _, bst, _, _ = binance()
    last = bst.get("last_run")  # 매매일 = UTC 날짜 (09:00 KST 에 바뀐다)
    err = LB.BASE / "logs" / "live_binance.err"
    erred = err.exists() and err.stat().st_size > 0 and datetime.fromtimestamp(err.stat().st_mtime, KST).strftime("%Y-%m-%d") == today
    why = [f"마지막 실행 {last or '없음'}" + (", 오늘 오류 기록 있음" if erred else "")] if not last or last < due else []
    why += bst.get("check", {}).get("notes", [])
    why += [f"{c} 주문·이체 확인이 끝나지 않음" for c, s in bst.get("sleeves", {}).items() if s.get("pending")]
    if LB.STOP.exists():
        why.append("정지 상태(STOP 파일)")
    out.append(("바이낸스", not why, " · ".join(why) or f"{last} 실행 ({'실전' if LB.LIVE else '드라이런'})" + (" (오류 뒤 재시도로 끝남)" if erred else "")))
    for name, folder in [("업비트 실전", "live"), ("모의", "paper"), ("ML 모의", "paper_ml"), ("선물 모의", "paper_futures"), ("후보 모의", "paper_cand")]:
        stop = ROOT / folder / "STOP"
        if folder == "live" and stop.exists() and "사용자 결정" in stop.read_text():  # 일부러 멈춘 것은 문제가 아니다
            out.append((name, True, "정지 — " + stop.read_text().strip()[:60]))
            continue
        st = ROOT / folder / "state.json"
        last = json.loads(st.read_text()).get("last_run") if st.exists() else None
        err = ROOT / folder / "logs" / f"{folder}.err"
        erred = err.exists() and err.stat().st_size > 0 and datetime.fromtimestamp(err.stat().st_mtime, KST).strftime("%Y-%m-%d") == today
        why = []
        if not last or last < due:
            why.append(f"마지막 실행 {last or '없음'}" + (", 오늘 오류 기록 있음" if erred else ""))
        if folder == "live":
            why += live_st.get("check", {}).get("notes", [])
            why += [f"{m} 주문 확인이 끝나지 않음" for m, s in live_st.get("sleeves", {}).items() if s.get("pending")]
            if (ROOT / "live/STOP").exists():
                why.append("정지 상태(STOP 파일)")
        out.append((name, not why, " · ".join(why) or f"{last} 실행" + (" (오류 뒤 재시도로 끝남)" if erred else "")))

    try:
        age = (now - datetime.strptime(col_last[:16], "%Y-%m-%d %H:%M").replace(tzinfo=KST)).total_seconds() / 60
    except ValueError:
        age = None
    out.append(("수집", age is not None and age <= 25 and "수집 완료" in col_last, col_last))

    log = ROOT / "data/collect/logs/push_data.log"
    line = log.read_text().strip().splitlines()[-1] if log.exists() and log.stat().st_size else "기록 없음"
    try:
        fresh = now - datetime.fromisoformat(line.split()[1]) < timedelta(hours=26)
    except (IndexError, ValueError):
        fresh = False
    out.append(("데이터 푸시", fresh and "푸시 완료" in line, line.lstrip("- ")))
    return out


def pct(v, digits=2):
    return "—" if v is None else f"{v * 100:+.{digits}f}%"


def build():
    now = datetime.now(KST)
    live_hist = history()  # (날짜, 평가액, 넣은 돈, 입출금 뺀 지수)
    live_eq = [(d, idx) for d, _, _, idx in live_hist]
    paper_eq = daily(ROOT / "paper/equity.csv", ["평가액", "보유시_평가액"])
    live_tr = rows(ROOT / "live/trades.csv")
    paper_tr = rows(ROOT / "paper/trades.csv")
    ml_eq = daily(ROOT / "paper_ml/equity.csv", ["평가액", "보유시_평가액"])
    ml_tr = rows(ROOT / "paper_ml/trades.csv")
    ml_log = ROOT / "paper_ml/logs/paper_ml.log"
    ml_lines = [l for l in ml_log.read_text().splitlines() if "× [p=" in l][-2:] if ml_log.exists() else []
    live_st = json.loads((ROOT / "live/state.json").read_text()) if (ROOT / "live/state.json").exists() else {}
    stop = (ROOT / "live/STOP").read_text().strip() if (ROOT / "live/STOP").exists() else None
    sig = signals()
    col_last, col_kinds = collector()

    checks = health(now, live_st, col_last)
    pills = "".join(f'<span class="pill {"ok" if ok else "bad"}" title="{html.escape(d)}">{n} {"정상" if ok else "확인 필요"}</span>' for n, ok, d in checks)
    issues = "".join(f"<li><b>{n}</b> — {html.escape(d)}</li>" for n, ok, d in checks if not ok)
    health_html = f'<div class="health">{pills}</div>' + (
        f'<ul class="issues">{issues}</ul>' if issues else
        f'<p class="muted">작업이 모두 제때 돌았다{"." if "check" not in live_st else ", 실전 장부와 업비트 계좌도 맞는다."}</p>')
    flows = rows(ROOT / "live/flows.csv")

    cards = []
    bname, bst, bhist, btr = binance()
    if bhist:
        _, v, b, _ = bhist[-1]
        cards.append((f"{bname} 평가액", f"{v:,.2f} USDT", f"넣은 돈 {b:,.2f} 대비 {pct(v / b - 1)} · 최대 하락 {pct(mdd([r[3] for r in bhist]), 1)}"))
    if live_hist:
        _, v, b, _ = live_hist[-1]
        cards.append(("실전 평가액", f"{v:,.0f}원", f"넣은 돈 {b:,.0f}원 대비 {pct(v / b - 1)} · 최대 하락 {pct(mdd([r[1] for r in live_eq]), 1)}"))
    if paper_eq:
        v, h = paper_eq[-1][1], paper_eq[-1][2]
        cards.append(("모의 평가액", f"{v:,.0f}원", f"원금 대비 {pct(v / 1e6 - 1)} · 그냥 보유 {pct(h / 1e6 - 1)}"))
    if ml_eq:
        v = ml_eq[-1][1]
        cards.append(("ML 거르기 모의", f"{v:,.0f}원", f"원금 대비 {pct(v / 1e6 - 1)} · {ml_eq[0][0]} 시작, 3개월 병행 검증"))
    s_live = slip_avg(paper_tr, "중간가대비_불리")
    cards.append(("모의 평균 슬리피지", "—" if s_live is None else f"{s_live:+.3f}%", f"백테스트 가정 {SLIP_ASSUMED:.2f}% · 거래 {len(paper_tr)}회"))
    cards.append(("실전 거래", f"{len(live_tr)}회", "정지 상태: " + (stop if stop else "정상 가동")))

    card_html = "".join(f'<div class="card"><div class="k">{k}</div><div class="v">{v}</div><div class="s">{html.escape(s)}</div></div>' for k, v, s in cards)

    sig_rows = ""
    for s in sig:
        gaps = "".join(f'<td class="{"up" if g["gap"] > 0 else "down"}">{pct(g["gap"], 1)}</td>' for g in s["smas"].values())
        sig_rows += f'<tr><td>{s["market"][4:]}</td><td>{s["close"]:,.0f}</td>{gaps}<td><b>{s["target"]:.2f}</b></td></tr>'
    sig_head = "".join(f"<th>SMA{n}</th>" for n in SMAS)

    # 실전·모의를 각자 시작값 100 으로 맞춰 같은 축에 그린다
    days = sorted(set(d for d, *_ in live_eq) | set(d for d, *_ in paper_eq) | set(d for d, *_ in ml_eq))
    norm = lambda eq, i: (lambda m: [m[d] / eq[0][i] * 100 for d in days if d in m])({r[0]: r[i] for r in eq})
    series, labels, colors = [], [], []
    if live_eq:
        series.append(norm(live_eq, 1)); labels.append("실전"); colors.append("var(--c1)")
    if paper_eq:
        series.append(norm(paper_eq, 1)); labels.append("모의"); colors.append("var(--c2)")
        series.append(norm(paper_eq, 2)); labels.append("그냥 보유"); colors.append("var(--c3)")
    if ml_eq:
        series.append(norm(ml_eq, 1)); labels.append("ML 거르기 모의"); colors.append("var(--c4)")
    eq_chart = chart([[v * 1e4 for v in s] for s in series], labels, colors) if series else ""

    def trade_table(tr, cols):
        if not tr:
            return '<p class="muted">아직 거래 없음. 신호가 바뀌는 날 매매한다(연 9회 안팎).</p>'
        head = "".join(f"<th>{c}</th>" for c in cols)
        body = "".join("<tr>" + "".join(f"<td>{html.escape(str(t.get(c, '')))}</td>" for c in cols) + "</tr>" for t in reversed(tr[-30:]))
        return f'<div class="scroll"><table><tr>{head}</tr>{body}</table></div>'

    col_rows = "".join(f"<tr><td>{k}</td><td>{v['days']}일</td><td>{v['mb']:.1f}MB</td></tr>" for k, v in col_kinds.items())

    page = f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>코인 추세추종 리포트</title>
<style>
:root{{--bg:#f7f7f5;--fg:#1c1c1c;--muted:#6b6b6b;--card:#fff;--line:#e3e3df;--up:#c0392b;--down:#2763c4;--c1:#e0761f;--c2:#3a7bd5;--c3:#9a9a9a;--c4:#2a9d6b;--ok:#2a9d6b;--bad:#c0392b}}
@media (prefers-color-scheme:dark){{:root{{--bg:#141414;--fg:#ececec;--muted:#9a9a9a;--card:#1f1f1f;--line:#333;--up:#ff6b5a;--down:#6ea2ff;--c1:#ff9a3c;--c2:#6ea2ff;--c3:#777;--c4:#4cc28d;--ok:#4cc28d;--bad:#ff6b5a}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif}}
main{{max-width:880px;margin:0 auto;padding:24px 16px 48px}}h1{{font-size:22px;margin:0 0 4px}}h2{{font-size:16px;margin:32px 0 10px}}
.muted,.s{{color:var(--muted);font-size:13px}}.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:18px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}}.k{{font-size:13px;color:var(--muted)}}.v{{font-size:22px;font-weight:700;margin:2px 0}}
table{{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;font-size:13px;font-variant-numeric:tabular-nums}}
th,td{{padding:7px 9px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}}th:first-child,td:first-child{{text-align:left}}th{{color:var(--muted);font-weight:500}}
.scroll{{overflow-x:auto}}.up{{color:var(--up)}}.down{{color:var(--down)}}
.chart{{width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px}}.chart text{{fill:var(--muted);font-size:11px}}
.legend{{display:flex;gap:14px;font-size:13px;color:var(--muted);margin-top:6px}}.legend i{{display:inline-block;width:10px;height:3px;margin-right:5px;vertical-align:middle}}
.health{{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}}.pill{{font-size:12px;padding:3px 10px;border-radius:99px;border:1px solid var(--line);background:var(--card)}}
.pill.ok::before{{content:"● ";color:var(--ok)}}.pill.bad{{border-color:var(--bad);color:var(--bad);font-weight:600}}.pill.bad::before{{content:"▲ "}}
.issues{{margin:8px 0 0;padding-left:18px;font-size:13px}}.health+.muted{{margin:8px 0 0}}
.banner{{background:#b93226;color:#fff;padding:10px 14px;border-radius:10px;margin-bottom:14px;font-weight:600}}
</style></head><body><main>
<div id="stale" class="banner" hidden></div>
<h1>코인 추세추종 리포트</h1>
<div class="muted">바이낸스 BTC·ETH 현물 봇 + 하락장 숏 · 업비트 봇은 2026-11-26 정지 · 갱신 {now:%Y-%m-%d %H:%M} KST</div>
{health_html}
<div class="cards">{card_html}</div>

<h2>{bname} — 현물 봇 + 하락장 숏 (2026-11-26 사용자 결정으로 업비트에서 옮김)</h2>
{binance_html(bst, btr)}

<h2>업비트 신호 ({sig[0]['date']} 종가 기준, 업비트 봇은 정지)</h2>
<div class="scroll"><table><tr><th>마켓</th><th>종가</th>{sig_head}<th>목표 비중</th></tr>{sig_rows}</table></div>
<p class="muted">각 이평선 대비 종가 위치. 위에 있는 이평선 수 ÷ 4 가 목표 비중. 0 에 가까운 칸이 다음에 뒤집힐 후보.</p>

<h2>평가액 추이 (시작 = 100)</h2>
{eq_chart}

<h2>실전 거래</h2>
{trade_table(live_tr, ["시각", "마켓", "구분", "목표비중_전", "목표비중_후", "체결가", "원화", "수수료", "상태"])}

{f'<h2>실전 입출금</h2>{trade_table(flows, ["시각", "금액", "넣은돈_합계", "직전_평가액"])}' if flows else ""}

<h2>모의 거래</h2>
{trade_table(paper_tr, ["시각", "마켓", "구분", "목표비중_후", "체결가", "원화", "중간가대비_불리", "종가대비_불리"])}

<h2>ML 거르기 모의 (ML.md L-A)</h2>
<p class="muted">앙상블 비중 × [로지스틱 회귀의 '5일 뒤 오를 확률' &gt; 0.5]. 사전 등록 6개 중 유일하게 통과, 실전 전 3개월 병행 검증 중. 2027-02-17 판정: 모의 앙상블보다 수익률·MDD 나쁘지 않음 · 슬리피지 0.05% 이내 · 빠진 날 없음 → 셋 다 만족하면 실전 전환.</p>
{"".join(f'<p class="muted">{html.escape(l)}</p>' for l in ml_lines)}
{trade_table(ml_tr, ["시각", "마켓", "구분", "목표비중_전", "목표비중_후", "체결가", "원화", "중간가대비_불리"])}

<h2>선물 모의 (FUTURES.md, 바이낸스 무기한, 방식마다 10,000 USDT)</h2>
{futures_table()}
<p class="muted">백테스트 표본 외(2023~)에서 F1~F3 모두 F0 보다 샤프가 높지 않았다(F0 0.86 · F1 0.65 · F2 0.83 · F3 0.86). 실제 펀딩·체결 기록용. 실전 검토는 현물 3개월 검증 뒤.</p>

<h2>연구 후보 모의 (RESEARCH.md 후보 모의 등록, 방식마다 10,000 USDT)</h2>
{cand_table()}
<p class="muted">83개 방법 중 봉인 구간까지 통과한 2개. 다중 검정 보정으로는 운과 구분되지 않아 모의로 앞으로 검증한다. 중간 점검 2027-02-24(운영만), 판정 2027-05-24: F0 이상 수익 · MDD 5%p 이내 · 체결 불리 0.05% 이내 · 빠진 날 없음.</p>

<h2>전략 비교: 2025-01 에 100만원을 넣었다면</h2>
{compare("2025-01-01")}

<h2>전략 비교: 2023-01 에 100만원을 넣었다면</h2>
{compare("2023-01-01")}
<p class="muted">워크포워드 표본 외 백테스트, 편도 비용 0.10%. ML 은 2022년까지의 데이터로만 학습한 뒤 매달 다시 학습했다. 2023년 이전은 학습 데이터가 너무 짧아 ML 비교를 하지 않는다.</p>

<h2>백테스트 기준선 (표본 외 2023~)</h2>
<table><tr><th>방식</th><th>연복리</th><th>샤프</th><th>MDD</th></tr>
<tr><td>앙상블 (현행)</td><td>+43%</td><td>1.43</td><td>-26%</td></tr>
<tr><td>ML 거르기 L-A (워크포워드)</td><td>+49%</td><td>1.77</td><td>-18%</td></tr>
<tr><td>BTC+ETH 그냥 보유</td><td>+31%</td><td>0.82</td><td>-57%</td></tr></table>
<p class="muted">실전·모의가 이 숫자에서 크게 벗어나면 비용 가정이나 실행 방식을 다시 본다. 몇 달은 쌓여야 비교가 의미 있다.</p>

<h2>ML 데이터 수집</h2>
<div class="scroll"><table><tr><th>항목</th><th>쌓인 날</th><th>용량</th></tr>{col_rows}</table></div>
<p class="muted">최근 로그: {html.escape(col_last)}</p>
</main>
<script>(function(){{var h=(Date.now()-{int(now.timestamp() * 1000)})/36e5;if(h>15){{var e=document.getElementById("stale");e.hidden=false;
e.textContent="이 리포트는 "+Math.floor(h)+"시간째 갱신되지 않았다. 하루 세 번(09:20·13:20·21:20) 갱신되는 페이지다. 맥이 꺼져 있다면 봇도 매매하지 못하고 있다.";}}}})();</script>
</body></html>"""
    OUT.mkdir(exist_ok=True)
    (OUT / "index.html").write_text(page)
    print(f"{now:%Y-%m-%d %H:%M} 리포트 생성 {OUT / 'index.html'}")


def deploy():
    r = subprocess.run([VERCEL, "deploy", "--prod", "--yes"], cwd=OUT, capture_output=True, text=True,
                       env={**os.environ, "PATH": f"{Path(VERCEL).parent}:{os.environ.get('PATH', '')}"})
    if r.returncode != 0:
        print(f"배포 실패: {r.stderr.strip()[-500:]}")
        return
    url = [l.split()[-1] for l in (r.stdout + r.stderr).splitlines() if "Aliased" in l or "Production" in l][-1:]
    print("배포 완료", *url)


if __name__ == "__main__":
    build()
    if "--no-deploy" not in sys.argv:
        deploy()
