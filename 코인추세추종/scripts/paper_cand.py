"""연구 최종 후보 선물 모의 매매 (RESEARCH.md '후보 모의 등록'). 실제 주문은 내지 않는다.
C1 볼린저 50/1.5 돌파 롱만, C2 7일 평균 펀딩 음수면 롱 — 봉인 판정 때 고정한 칸 그대로. 기준선은 선물 모의의 F0(paper_futures).
체결·펀딩·청산 계산은 paper_futures.py 와 같다. 방식·마켓마다 5,000 USDT. 매일 09:16 KST.
장부: paper_cand/state.json · trades.csv · equity.csv
사용법: python3 scripts/paper_cand.py [--report]
"""
import csv, json, statistics, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from paper import KST, append, get
from paper_futures import API, CAPITAL, FEE, MIN_TRADE, MMR, SYMBOLS, book, fill

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "paper_cand"
STATE, TRADES, EQUITY = DIR / "state.json", DIR / "trades.csv", DIR / "equity.csv"
NAMES = {"C1": "볼린저 50/1.5 돌파 롱만", "C2": "7일 평균 펀딩 음수면 롱"}
TRADE_COLS = ["시각", "방식", "마켓", "구분", "목표_전", "목표_후", "중간가", "체결가", "수량", "명목", "수수료", "중간가대비_불리"]
EQ_COLS = ["날짜", "방식", "마켓", "목표", "평가액", "펀딩누적"]


def closes(sym):
    """마감된 일봉(00:00 UTC) 종가. (마지막 신호 날짜, 종가 목록)"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    ks = [k for k in get(f"{API}/klines?symbol={sym}USDT&interval=1d&limit=1500")
          if datetime.fromtimestamp(k[0] / 1000, timezone.utc).strftime("%Y-%m-%d") < today]
    return datetime.fromtimestamp(ks[-1][0] / 1000, timezone.utc).strftime("%Y-%m-%d"), [float(k[4]) for k in ks]


def bollinger(c, n=50, k=1.5):
    """scripts/lab/indicators.py s_bollinger '돌파' 와 같은 상태 기계. 상단 위 롱·평균 아래 청산, 하단 아래 숏·평균 위 청산. 롱만은 음수를 0."""
    pos = 0
    for i in range(n - 1, len(c)):
        w = c[i - n + 1:i + 1]
        m, sd = sum(w) / n, statistics.stdev(w)
        if pos == 1 and c[i] < m:
            pos = 0
        elif pos == -1 and c[i] > m:
            pos = 0
        if pos <= 0 and c[i] > m + k * sd:
            pos = 1
        elif pos >= 0 and c[i] < m - k * sd:
            pos = -1
    return max(pos, 0)


def funding_mean(sym, day, w=7):
    """scripts/lab/others.py daily_funding 과 같다: 날짜 D = (펀딩 시각 − 1초)의 UTC 날짜. day 까지 w 일 평균(빠진 날은 0)."""
    end = datetime.strptime(day, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    xs = get(f"{API}/fundingRate?symbol={sym}USDT&startTime={int((end - timedelta(days=w + 1)).timestamp() * 1000)}&limit=1000")
    daily = {}
    for x in xs:
        d = (datetime.fromtimestamp(x["fundingTime"] / 1000, timezone.utc) - timedelta(seconds=1)).strftime("%Y-%m-%d")
        daily[d] = daily.get(d, 0.0) + float(x["fundingRate"])
    days = [(end - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(w)]
    return sum(daily.get(d, 0.0) for d in days) / w


def run():
    now = datetime.now(KST)
    today = now.strftime("%Y-%m-%d")
    print(f"--- {now.isoformat(timespec='seconds')}")
    st = json.loads(STATE.read_text()) if STATE.exists() else None
    if now.hour < 9 or (st and st["last_run"] == today):
        print("09:00 이전이거나 오늘 이미 실행함. 건너뜀.")
        return
    DIR.mkdir(exist_ok=True)
    now_ms = int(now.timestamp() * 1000)
    if st is None:
        st = {"start": today, "last_run": None, "last_ms": now_ms,
              "sleeves": {v: {s: {"wallet": CAPITAL, "qty": 0.0, "px": None, "liquidated": None} for s in SYMBOLS} for v in NAMES}}

    for s in SYMBOLS:
        day, c = closes(s)
        fm = funding_mean(s, day)
        sig = {"C1": float(bollinger(c)), "C2": 1.0 if fm < 0 else 0.0}
        asks, bids, mid = book(s)
        since = st["last_ms"] + 1
        funds = get(f"{API}/fundingRate?symbol={s}USDT&startTime={since}&limit=100")
        hours = get(f"{API}/klines?symbol={s}USDT&interval=1h&startTime={since}&limit=100")
        low = min([float(k[3]) for k in hours] or [mid])
        high = max([float(k[2]) for k in hours] or [mid])
        print(f"{s} 신호 {day} 종가 {c[-1]:,.2f} C1={sig['C1']:.0f} C2={sig['C2']:.0f} (7일 펀딩 평균 {fm * 100:+.4f}%) 중간가 {mid:,.2f}")

        for v in NAMES:
            sl = st["sleeves"][v][s]
            if sl["liquidated"]:
                append(EQUITY, EQ_COLS, [today, v, s, 0, 0, round(sl.get("funding", 0), 2)])
                continue
            q, px = sl["qty"], sl["px"]
            if q and px:
                worst = low if q > 0 else high
                if sl["wallet"] + q * (worst - px) <= MMR * abs(q) * worst:
                    print(f"  {v} {s} 청산 (구간 {'저가' if q > 0 else '고가'} {worst:,.2f})")
                    append(TRADES, TRADE_COLS, [now.isoformat(timespec="seconds"), v, s, "청산", sl.get("target", 0), 0, round(worst, 2), round(worst, 2), round(-q, 6), round(abs(q) * worst, 2), 0, ""])
                    sl.update(wallet=0.0, qty=0.0, liquidated=today)
                    append(EQUITY, EQ_COLS, [today, v, s, 0, 0, round(sl.get("funding", 0), 2)])
                    continue
                paid = sum(q * float(x["markPrice"] or mid) * float(x["fundingRate"]) for x in funds)
                sl["wallet"] -= paid
                sl["funding"] = sl.get("funding", 0) + paid
                sl["wallet"] += q * (mid - px)
            sl["px"] = mid

            target = sig[v]
            dq = target * sl["wallet"] / mid - q
            if abs(dq) * mid >= MIN_TRADE:
                avg = fill(asks if dq > 0 else bids, abs(dq))
                slip = (avg - mid) * dq
                fee = abs(dq) * avg * FEE
                sl["wallet"] -= slip + fee
                sl["qty"] = q + dq
                side = "매수" if dq > 0 else "매도"
                append(TRADES, TRADE_COLS, [now.isoformat(timespec="seconds"), v, s, side, sl.get("target", 0), target, round(mid, 2), round(avg, 2), round(dq, 6), round(abs(dq) * avg, 2), round(fee, 4),
                                            f"{(avg / mid - 1) * (1 if dq > 0 else -1) * 100:.4f}%"])
                print(f"  {v} {s} {side} 목표 {sl.get('target', 0):+.2f}→{target:+.2f} {abs(dq) * avg:,.2f} USDT @ {avg:,.2f}")
            sl["target"] = target
            append(EQUITY, EQ_COLS, [today, v, s, target, round(sl["wallet"], 2), round(sl.get("funding", 0), 2)])

    st["last_run"], st["last_ms"] = today, now_ms
    STATE.write_text(json.dumps(st, ensure_ascii=False, indent=2))
    for v in NAMES:
        tot = sum(st["sleeves"][v][s]["wallet"] for s in SYMBOLS)
        print(f"{v} {NAMES[v]} 평가액 {tot:,.2f} USDT ({(tot / (CAPITAL * len(SYMBOLS)) - 1) * 100:+.2f}%)")


def report():
    if not EQUITY.exists():
        print("아직 기록이 없다.")
        return
    last = {(r["날짜"], r["방식"], r["마켓"]): r for r in csv.DictReader(EQUITY.open())}
    days = sorted({k[0] for k in last})
    print(f"기간 {days[0]} ~ {days[-1]} ({len(days)}일)")
    for v in NAMES:
        vals = [sum(float(last[(d, v, s)]["평가액"]) for s in SYMBOLS if (d, v, s) in last) for d in days]
        peak, mdd = 0, 0
        for x in vals:
            peak = max(peak, x)
            mdd = min(mdd, x / peak - 1)
        print(f"{v} {NAMES[v]} {vals[-1]:,.2f} USDT ({(vals[-1] / (CAPITAL * len(SYMBOLS)) - 1) * 100:+.2f}%), 최대 하락 {mdd * 100:.1f}%")


if __name__ == "__main__":
    report() if "--report" in sys.argv else run()
