"""업비트 모의 매매 봇. 실제 주문은 내지 않는다.
매일 09:00 KST 일봉이 닫힌 뒤 한 번 돌린다. 앙상블(SMA 20·50·100·200) 신호로 목표 비중을 정하고,
그 순간의 실제 호가창에 시장가 주문을 넣은 것처럼 체결가를 계산해 장부에 적는다.
사용법:
  python3 scripts/paper.py           # 오늘 몫 실행 (이미 돌렸으면 건너뜀)
  python3 scripts/paper.py --report  # 누적 성과 보기
"""
import csv, json, sys, time, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "paper"
STATE, TRADES, EQUITY = DIR / "state.json", DIR / "trades.csv", DIR / "equity.csv"
MARKETS = ["KRW-BTC", "KRW-ETH"]
CAPITAL = 1_000_000  # 마켓마다 절반씩, 서로 리밸런싱하지 않는다
FEE = 0.0005
SMAS = [20, 50, 100, 200]
KST = timezone(timedelta(hours=9))


def get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    for i in range(3):
        try:
            return json.load(urllib.request.urlopen(req, timeout=10))
        except Exception:
            if i == 2:
                raise
            time.sleep(2)


def closes(market):
    """마감된 일봉 종가를 오래된 순으로. 일봉은 09:00 KST 에 바뀌니 진행 중인 봉(날짜 = 9시간 전의 날짜)부터는 뺀다.
    방금 닫힌 봉이 응답에 없으면 예외를 낸다 — 하루 늦은 종가로 매매하지 않으려고."""
    rows, to = {}, ""
    for _ in range(2):
        batch = get(f"https://api.upbit.com/v1/candles/days?market={market}&count=200{to}")
        for c in batch:
            rows[c["candle_date_time_kst"][:10]] = c["trade_price"]
        to = f"&to={batch[-1]['candle_date_time_utc']}"
    cur = datetime.now(KST) - timedelta(hours=9)
    dates = [d for d in sorted(rows) if d < cur.strftime("%Y-%m-%d")]
    want = (cur - timedelta(days=1)).strftime("%Y-%m-%d")
    if not dates or dates[-1] != want:
        raise RuntimeError(f"{market} 일봉이 덜 올라왔다: 마지막 마감 봉 {dates[-1] if dates else '없음'}, 있어야 할 봉 {want}")
    return dates, [rows[d] for d in dates]


def signal(px):
    """종가가 위에 있는 이동평균 개수 / 4 → 0, 0.25, ..., 1"""
    return sum(px[-1] > sum(px[-n:]) / n for n in SMAS) / len(SMAS)


def fill(market, side, krw=None, qty=None):
    """실시간 호가창을 먹어 들어가는 시장가 체결. (평균가, 수량, 원화) 반환."""
    units = get(f"https://api.upbit.com/v1/orderbook?markets={market}")[0]["orderbook_units"]
    got_qty = got_krw = 0.0
    for u in units:
        price, size = (u["ask_price"], u["ask_size"]) if side == "buy" else (u["bid_price"], u["bid_size"])
        if side == "buy":
            take = min(krw - got_krw, price * size)
            got_krw += take
            got_qty += take / price
            if got_krw >= krw - 1e-9:
                break
        else:
            take = min(qty - got_qty, size)
            got_qty += take
            got_krw += take * price
            if got_qty >= qty - 1e-12:
                break
    mid = (units[0]["ask_price"] + units[0]["bid_price"]) / 2
    return got_krw / got_qty, got_qty, got_krw, mid


def load_state(dir_=DIR):
    state = dir_ / "state.json"
    if state.exists():
        return json.loads(state.read_text())
    return {"start": None, "last_run": None,
            "sleeves": {m: {"cash": CAPITAL / len(MARKETS), "qty": 0.0, "target": 0.0, "start_px": None} for m in MARKETS}}


def append(path, header, row):
    new = not path.exists()
    with path.open("a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(header)
        w.writerow(row)


def run(dir_=DIR, target_fn=None):
    """target_fn(market, dates, px) → 목표 비중. 없으면 앙상블 신호. 장부는 dir_ 에 따로 쌓인다."""
    STATE, TRADES, EQUITY = dir_ / "state.json", dir_ / "trades.csv", dir_ / "equity.csv"
    dir_.mkdir(exist_ok=True)
    st = load_state(dir_)
    now = datetime.now(KST)
    today = now.strftime("%Y-%m-%d")
    print(f"--- {now.isoformat(timespec='seconds')}")
    if now.hour < 9:
        print("09:00 KST 이전이라 어제 봉이 아직 안 닫혔다. 건너뜀.")
        return
    if st["last_run"] == today:
        print(f"{today} 이미 실행함. 건너뜀.")
        return

    total = 0.0
    for m in MARKETS:
        s = st["sleeves"][m]
        dates, px = closes(m)
        target = target_fn(m, dates, px) if target_fn else signal(px)
        if s["start_px"] is None:
            s["start_px"] = px[-1]
        if target != s["target"]:
            # 현재 평가액 기준 목표 수량과의 차이만큼 사고판다
            mid = fill(m, "buy", krw=1)[3]
            equity = s["cash"] + s["qty"] * mid
            want = equity * target
            have = s["qty"] * mid
            if want > have:
                krw = (want - have) / (1 + FEE)
                avg, q, k, mid = fill(m, "buy", krw=krw)
                s["qty"] += q
                s["cash"] -= k * (1 + FEE)
                side = "매수"
            else:
                q = min(s["qty"], (have - want) / mid) if target > 0 else s["qty"]
                avg, q, k, mid = fill(m, "sell", qty=q)
                s["qty"] -= q
                s["cash"] += k * (1 - FEE)
                side = "매도"
            sign = 1 if side == "매수" else -1
            slip = (avg / mid - 1) * sign  # 호가창 슬리피지
            drift = (avg / px[-1] - 1) * sign  # 09:00 종가 이후 실행 지연까지 포함
            append(TRADES, ["시각", "마켓", "구분", "목표비중_전", "목표비중_후", "신호종가", "중간가", "체결가", "수량", "원화", "수수료", "중간가대비_불리", "종가대비_불리"],
                   [now.isoformat(timespec="seconds"), m, side, s["target"], target, px[-1], round(mid), round(avg, 1), round(q, 8), round(k), round(k * FEE), f"{slip*100:.3f}%", f"{drift*100:.3f}%"])
            print(f"{m} {side} 비중 {s['target']:.2f}→{target:.2f}  {k:,.0f}원 @ {avg:,.0f} (슬리피지 {slip*100:+.3f}%, 신호 종가 대비 {drift*100:+.3f}%)")
            s["target"] = target
        else:
            print(f"{m} 유지 비중 {target:.2f}")
        mid = fill(m, "buy", krw=1)[3]
        value = s["cash"] + s["qty"] * mid
        hold = CAPITAL / len(MARKETS) * mid / s["start_px"]
        append(EQUITY, ["날짜", "마켓", "비중", "평가액", "보유시_평가액"], [today, m, target, round(value), round(hold)])
        total += value

    st["start"] = st["start"] or today
    st["last_run"] = today
    STATE.write_text(json.dumps(st, ensure_ascii=False, indent=2))
    print(f"총 평가액 {total:,.0f}원 (원금 {CAPITAL:,}원, {(total/CAPITAL-1)*100:+.2f}%)")


def report(dir_=DIR):
    TRADES, EQUITY = dir_ / "trades.csv", dir_ / "equity.csv"
    if not EQUITY.exists():
        print("아직 기록이 없다.")
        return
    rows = list(csv.DictReader(EQUITY.open()))
    last = {(r["날짜"], r["마켓"]): r for r in rows}  # 같은 날 여러 번 돌았으면 마지막 값
    by_day = {}
    for (day, _), r in last.items():
        d = by_day.setdefault(day, [0, 0])
        d[0] += float(r["평가액"])
        d[1] += float(r["보유시_평가액"])
    days = sorted(by_day)
    peak, mdd = 0, 0
    for d in days:
        peak = max(peak, by_day[d][0])
        mdd = min(mdd, by_day[d][0] / peak - 1)
    v, h = by_day[days[-1]]
    print(f"기간 {days[0]} ~ {days[-1]} ({len(days)}일)")
    print(f"봇     {v:,.0f}원 ({(v/CAPITAL-1)*100:+.2f}%), 최대 하락 {mdd*100:.1f}%")
    print(f"보유   {h:,.0f}원 ({(h/CAPITAL-1)*100:+.2f}%)")
    if TRADES.exists():
        t = list(csv.DictReader(TRADES.open()))
        avg = lambda col: sum(float(x[col].rstrip("%")) for x in t) / len(t)
        print(f"거래 {len(t)}회, 평균 슬리피지 {avg('중간가대비_불리'):+.3f}% (백테스트 가정 0.05%), 신호 종가 대비 {avg('종가대비_불리'):+.3f}%" if t else "거래 0회")


if __name__ == "__main__":
    report() if "--report" in sys.argv else run()
