"""운영 리포트. 실전·모의 장부와 현재 신호를 정적 페이지(report/index.html)로 만들고 Vercel 에 올린다.
launchd com.coin-trend.report 가 실전 봇(09:07) 뒤 09:20 에 돈다 (13:20·21:20 재시도).
사용법:
  python3 scripts/report.py            # 페이지 생성 + 배포
  python3 scripts/report.py --no-deploy
"""
import csv, html, json, os, subprocess, sys
from datetime import datetime
from pathlib import Path

from live import BUDGET
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
    for d in sorted(p for p in base.iterdir() if p.is_dir() and p.name != "logs") if base.exists() else []:
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


def pct(v, digits=2):
    return "—" if v is None else f"{v * 100:+.{digits}f}%"


def build():
    now = datetime.now(KST)
    live_eq = daily(ROOT / "live/equity.csv", ["평가액"])
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

    cards = []
    if live_eq:
        start = BUDGET
        v = live_eq[-1][1]
        cards.append(("실전 평가액", f"{v:,.0f}원", f"시작 대비 {pct(v / start - 1)} · 최대 하락 {pct(mdd([r[1] for r in live_eq]), 1)}"))
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
:root{{--bg:#f7f7f5;--fg:#1c1c1c;--muted:#6b6b6b;--card:#fff;--line:#e3e3df;--up:#c0392b;--down:#2763c4;--c1:#e0761f;--c2:#3a7bd5;--c3:#9a9a9a;--c4:#2a9d6b}}
@media (prefers-color-scheme:dark){{:root{{--bg:#141414;--fg:#ececec;--muted:#9a9a9a;--card:#1f1f1f;--line:#333;--up:#ff6b5a;--down:#6ea2ff;--c1:#ff9a3c;--c2:#6ea2ff;--c3:#777;--c4:#4cc28d}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif}}
main{{max-width:880px;margin:0 auto;padding:24px 16px 48px}}h1{{font-size:22px;margin:0 0 4px}}h2{{font-size:16px;margin:32px 0 10px}}
.muted,.s{{color:var(--muted);font-size:13px}}.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:18px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}}.k{{font-size:13px;color:var(--muted)}}.v{{font-size:22px;font-weight:700;margin:2px 0}}
table{{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;font-size:13px;font-variant-numeric:tabular-nums}}
th,td{{padding:7px 9px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}}th:first-child,td:first-child{{text-align:left}}th{{color:var(--muted);font-weight:500}}
.scroll{{overflow-x:auto}}.up{{color:var(--up)}}.down{{color:var(--down)}}
.chart{{width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px}}.chart text{{fill:var(--muted);font-size:11px}}
.legend{{display:flex;gap:14px;font-size:13px;color:var(--muted);margin-top:6px}}.legend i{{display:inline-block;width:10px;height:3px;margin-right:5px;vertical-align:middle}}
</style></head><body><main>
<h1>코인 추세추종 리포트</h1>
<div class="muted">업비트 BTC·ETH · SMA 20·50·100·200 앙상블 · 갱신 {now:%Y-%m-%d %H:%M} KST</div>
<div class="cards">{card_html}</div>

<h2>오늘 신호 ({sig[0]['date']} 종가 기준)</h2>
<div class="scroll"><table><tr><th>마켓</th><th>종가</th>{sig_head}<th>목표 비중</th></tr>{sig_rows}</table></div>
<p class="muted">각 이평선 대비 종가 위치. 위에 있는 이평선 수 ÷ 4 가 목표 비중. 0 에 가까운 칸이 다음에 뒤집힐 후보.</p>

<h2>평가액 추이 (시작 = 100)</h2>
{eq_chart}

<h2>실전 거래</h2>
{trade_table(live_tr, ["시각", "마켓", "구분", "목표비중_전", "목표비중_후", "체결가", "원화", "수수료", "상태"])}

<h2>모의 거래</h2>
{trade_table(paper_tr, ["시각", "마켓", "구분", "목표비중_후", "체결가", "원화", "중간가대비_불리", "종가대비_불리"])}

<h2>ML 거르기 모의 (ML.md L-A)</h2>
<p class="muted">앙상블 비중 × [로지스틱 회귀의 '5일 뒤 오를 확률' &gt; 0.5]. 사전 등록 6개 중 유일하게 통과, 실전 전 3개월 병행 검증 중.</p>
{"".join(f'<p class="muted">{html.escape(l)}</p>' for l in ml_lines)}
{trade_table(ml_tr, ["시각", "마켓", "구분", "목표비중_전", "목표비중_후", "체결가", "원화", "중간가대비_불리"])}

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
</main></body></html>"""
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
